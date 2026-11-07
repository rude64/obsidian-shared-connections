"use strict";
const {Plugin, ItemView, PluginSettingTab, Setting, Notice} = require('obsidian');
const {buildGraph} = require('./graph');
const VIEW = 'shared-connections-graph';
const DEFAULTS = {sourceFolder:'',minimumSources:2,includeUnresolved:true};
const {mountNetwork} = require('./network');
const {filterGraph,compileQuery} = require('./filters');
const VIEW_DEFAULTS={query:'',keepNeighbors:true,conceptColor:'#d32f2f',sourceColor:'#218739',nodeSize:1,linkWidth:1,textThreshold:1.1,arrows:false,centerForce:1,repelForce:1,linkForce:1,linkDistance:85,groups:[]};
class SharedView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin=plugin; }
  getViewType() { return VIEW; }
  getDisplayText() { return 'Shared Connections'; }
  getIcon() { return 'git-fork'; }
  async onOpen() { this.options={...VIEW_DEFAULTS,...this.plugin.settings.graphOptions,groups:(this.plugin.settings.graphOptions?.groups||[]).map(g=>({...g}))};this.render(); }
  async onClose() { this.network?.dispose(); this.contentEl.empty(); }
  render() {
    this.network?.dispose(); this.network=null;
    const root=this.contentEl; root.empty(); root.addClass('shared-connections');
    const toolbar=root.createDiv({cls:'sc-toolbar'});
    toolbar.createEl('button',{text:'Refresh'}).onclick=()=>this.render();
    toolbar.createEl('button',{text:'Fit graph'}).onclick=()=>this.network?.fit();
    toolbar.createEl('button',{text:'Graph controls'}).onclick=()=>{this.controlsOpen=!this.controlsOpen;controls.open=this.controlsOpen;};
    const controls=root.createEl('details',{cls:'sc-controls'});controls.open=!!this.controlsOpen;controls.createEl('summary',{text:'Filters · Groups · Display · Forces'});controls.addEventListener('toggle',()=>{this.controlsOpen=controls.open;});
    this.buildControls(controls);
    let graph=buildGraph(this.app.vault.getMarkdownFiles(),this.app.metadataCache,this.plugin.settings);
    try{graph=filterGraph(graph,this.options,path=>{const file=this.app.vault.getAbstractFileByPath(path);if(!file)return [];const cache=this.app.metadataCache.getFileCache(file);const tags=(cache?.tags||[]).map(t=>t.tag);const front=cache?.frontmatter?.tags;if(Array.isArray(front))tags.push(...front.filter(t=>typeof t==='string'));else if(typeof front==='string')tags.push(...front.split(/[,\s]+/));return tags;});}catch(error){root.createEl('p',{text:error.message,cls:'sc-error'});return;}
    root.createEl('p',{text:`${graph.concepts.length} shared concepts · ${graph.nodes.length} notes and concepts · ${graph.sourceCount} source notes scanned`});
    root.createEl('p',{cls:'sc-help',text:'Node colors can be changed in Display. Dashed: missing notes. Click a node to open it. Scroll to zoom; drag nodes to rearrange or the background to pan. Hover to highlight connections and show names.'});
    if (!graph.nodes.length) {
      root.createEl('p',{text:'No shared concepts found. Check the source folder and minimum source count in settings, or wait for Obsidian to finish indexing.'}); return;
    }
    this.network=mountNetwork(root,graph,node=>{
      if(node.missing){new Notice('This concept has no note yet: '+node.path);return;}
      void this.app.workspace.openLinkText(node.path,'',true);
    },this.options);
    const details=root.createEl('details');details.createEl('summary',{text:'Shared concepts and referring articles'});
    let populated=false;
    details.addEventListener('toggle',()=>{if(!details.open||populated)return;populated=true;
    const list=details.createEl('ul');
    for (const concept of graph.concepts) {
      const li=list.createEl('li');li.createEl('strong',{text:`${concept.path} (${concept.sources.size})`});
      const children=li.createEl('ul');
      for(const source of concept.sources) {const link=children.createEl('li').createEl('a',{text:source,href:'#'});link.onclick=e=>{e.preventDefault();void this.app.workspace.openLinkText(source,'',true);};}
    }
    });
  }
  async persist(){this.plugin.settings.graphOptions={...this.options};await this.plugin.saveData(this.plugin.settings);}
  buildControls(root){
    const section=name=>{const el=root.createEl('details');el.open=true;el.createEl('summary',{text:name});return el;};
    const filters=section('Filters');
    const query=new Setting(filters).setName('Search nodes').setDesc('Words, "quoted phrases", path:, file:, tag:, -exclude and OR. Other Obsidian search operators are not supported.');
    query.addText(text=>{text.setPlaceholder('tag:heritage OR path:"Castles"').setValue(this.options.query);const apply=()=>{try{compileQuery(text.getValue());this.options.query=text.getValue();void this.persist();this.render();}catch(error){new Notice(error.message);}};text.inputEl.addEventListener('keydown',e=>{if(e.key==='Enter')apply();});query.addButton(b=>b.setButtonText('Apply').onClick(apply));});
    new Setting(filters).setName('Keep direct neighbors').setDesc('Show the articles and concepts directly linked to search matches. The minimum reference count is calculated before this display filter.').addToggle(t=>t.setValue(this.options.keepNeighbors).onChange(v=>{this.options.keepNeighbors=v;void this.persist();this.render();}));
    new Setting(filters).setName('Source folder').setDesc('Only notes in this vault-relative folder count as referring articles. Empty means all Markdown notes.').addText(t=>{t.setValue(this.plugin.settings.sourceFolder);t.inputEl.addEventListener('change',()=>{this.plugin.settings.sourceFolder=t.getValue().trim().replace(/^\/+|\/+$/g,'');void this.plugin.saveSettings();});});
    new Setting(filters).setName('Minimum referring articles').addDropdown(d=>{for(const n of [2,3,4,5,10])d.addOption(String(n),String(n));d.setValue(String(this.plugin.settings.minimumSources)).onChange(v=>{this.plugin.settings.minimumSources=Number(v);void this.plugin.saveSettings();});});
    new Setting(filters).setName('Existing files only').addToggle(t=>t.setValue(!this.plugin.settings.includeUnresolved).onChange(v=>{this.plugin.settings.includeUnresolved=!v;void this.plugin.saveSettings();}));
    const groups=section('Groups');groups.createEl('p',{text:'First matching group determines node color. Uses the same search syntax as the node filter.'});
    this.options.groups.forEach((group,index)=>{const row=new Setting(groups).setName('Group '+(index+1));row.addText(t=>{t.setValue(group.query);t.inputEl.addEventListener('change',()=>{try{compileQuery(t.getValue());group.query=t.getValue();void this.persist();this.render();}catch(error){new Notice(error.message);}});});row.addColorPicker(c=>c.setValue(group.color).onChange(v=>{group.color=v;void this.persist();this.network?.setOptions(this.options);}));row.addButton(b=>b.setButtonText('Remove').onClick(()=>{this.options.groups.splice(index,1);void this.persist();this.render();}));});
    new Setting(groups).addButton(b=>b.setButtonText('New group').onClick(()=>{this.options.groups.push({query:'',color:'#d97b42'});void this.persist();this.render();}));
    const display=section('Display'),forces=section('Forces');
    for(const [name,key] of [['Shared concept color','conceptColor'],['Source article color','sourceColor']])new Setting(display).setName(name).setDesc('Matching color groups take priority over this default color.').addColorPicker(c=>c.setValue(this.options[key]).onChange(v=>{this.options[key]=v;void this.persist();this.network?.setOptions(this.options);}));
    const slider=(parent,name,key,min,max,step)=>new Setting(parent).setName(name).addSlider(t=>t.setLimits(min,max,step).setValue(this.options[key]).setDynamicTooltip().onChange(v=>{this.options[key]=v;void this.persist();this.network?.setOptions(this.options);}));
    slider(display,'Node size','nodeSize',.5,3,.1);slider(display,'Link thickness','linkWidth',.2,3,.1);slider(display,'Label zoom threshold','textThreshold',.2,4,.1);
    new Setting(display).setName('Arrows').addToggle(t=>t.setValue(this.options.arrows).onChange(v=>{this.options.arrows=v;void this.persist();this.network?.setOptions(this.options);}));
    slider(forces,'Center force','centerForce',0,3,.1);slider(forces,'Repel force','repelForce',.2,3,.1);slider(forces,'Link force','linkForce',.1,3,.1);slider(forces,'Link distance','linkDistance',30,250,5);
    new Setting(root).addButton(b=>b.setButtonText('Reset graph controls').onClick(()=>{this.options={...VIEW_DEFAULTS,groups:[]};void this.persist();this.render();}));
  }

}
class Settings extends PluginSettingTab {
  constructor(app,plugin) {super(app,plugin);this.plugin=plugin;}
  display() {
    const el=this.containerEl;el.empty();
    new Setting(el).setName('Source folder').setDesc('Vault-relative folder containing your articles, including subfolders. Leave empty to count all Markdown notes. Folder names are case-sensitive.').addText(text=>text.setPlaceholder('Articles').setValue(this.plugin.settings.sourceFolder).onChange(async value=>{this.plugin.settings.sourceFolder=value.trim().replace(/^\/+|\/+$/g,'');await this.plugin.saveSettings();}));
    new Setting(el).setName('Minimum referring articles').setDesc('A concept must be linked from at least this many different source notes. Repeated links in one article count once.').addDropdown(drop=>{for(const n of [2,3,4,5,10])drop.addOption(String(n),String(n));drop.setValue(String(this.plugin.settings.minimumSources)).onChange(async value=>{this.plugin.settings.minimumSources=Number(value);await this.plugin.saveSettings();});});
    new Setting(el).setName('Include missing concepts').setDesc('Include links to notes that have not been created. Missing targets are matched by their exact link path, ignoring headings and the .md extension.').addToggle(toggle=>toggle.setValue(this.plugin.settings.includeUnresolved).onChange(async value=>{this.plugin.settings.includeUnresolved=value;await this.plugin.saveSettings();}));
  }
}
module.exports=class SharedConnections extends Plugin {
  async onload() {
    const saved=await this.loadData();this.settings={...DEFAULTS,...saved};
    if(typeof this.settings.sourceFolder!=='string')this.settings.sourceFolder='';
    if(![2,3,4,5,10].includes(this.settings.minimumSources))this.settings.minimumSources=2;
    this.registerView(VIEW,leaf=>new SharedView(leaf,this));
    this.addSettingTab(new Settings(this.app,this));
    this.addCommand({id:'open-shared-connections',name:'Open shared connections',callback:()=>this.openGraph()});
    this.addRibbonIcon('git-fork','Open shared connections',()=>this.openGraph());
    this.registerEvent(this.app.metadataCache.on('resolved',()=>this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete',()=>this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename',()=>this.scheduleRefresh()));
    this.app.workspace.onLayoutReady(()=>this.refresh());
    this.register(()=>{clearTimeout(this.refreshTimer);for(const leaf of this.app.workspace.getLeavesOfType(VIEW))leaf.view.network?.dispose();});
  }
  scheduleRefresh(){clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>this.refresh(),350);}
  refresh(){for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof SharedView)leaf.view.render();}
  async saveSettings(){await this.saveData(this.settings);this.scheduleRefresh();}
  async openGraph(){let leaf=this.app.workspace.getLeavesOfType(VIEW)[0];if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:VIEW,active:true});}this.app.workspace.revealLeaf(leaf);}
};

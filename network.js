"use strict";
const {compileQuery} = require('./filters');
// Spatial hashing bounds repulsion work for large vaults; springs use real graph edges.
function createSimulation(graph, options={}) {
  let settings={centerForce:1,repelForce:1,linkForce:1,linkDistance:85,...options};
  const radius=Math.max(140,Math.sqrt(graph.nodes.length)*23);
  const nodes=graph.nodes.map((n,i)=>{const angle=i*2.399963229728653,r=radius*Math.sqrt((i+.5)/graph.nodes.length);return {...n,x:Math.cos(angle)*r,y:Math.sin(angle)*r,vx:0,vy:0,degree:0};});
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const edges=graph.edges.map(e=>{const a=byId.get(e.source),b=byId.get(e.target);a.degree++;b.degree++;return {a,b};});
  let iteration=0;
  function step() {
    const alpha=Math.max(.02,Math.pow(.985,iteration++)),cell=120,grid=new Map();
    for(const n of nodes){const key=Math.floor(n.x/cell)+','+Math.floor(n.y/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(n);n.vx-=n.x*.0007*settings.centerForce*alpha;n.vy-=n.y*.0007*settings.centerForce*alpha;}
    for(const n of nodes){const gx=Math.floor(n.x/cell),gy=Math.floor(n.y/cell);for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const b of grid.get(x+','+y)||[]){if(n===b)continue;let dx=n.x-b.x,dy=n.y-b.y;const d2=dx*dx+dy*dy;if(d2>cell*cell)continue;if(d2<.01){dx=.1;dy=.1;}const f=Math.min(3,85*settings.repelForce/Math.max(16,d2))*alpha;n.vx+=dx*f;n.vy+=dy*f;}}
    for(const {a,b} of edges){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-settings.linkDistance)*.025*settings.linkForce*alpha;const fx=dx/d*f,fy=dy/d*f;a.vx+=fx/Math.sqrt(a.degree);a.vy+=fy/Math.sqrt(a.degree);b.vx-=fx/Math.sqrt(b.degree);b.vy-=fy/Math.sqrt(b.degree);}
    for(const n of nodes){if(n.fixed){n.vx=n.vy=0;continue;}n.vx*=.65;n.vy*=.65;n.x+=Math.max(-15,Math.min(15,n.vx));n.y+=Math.max(-15,Math.min(15,n.vy));}
    return iteration<360;
  }
  return {nodes,edges,step,setOptions(value){settings={...settings,...value};iteration=0;},reheat(){iteration=0;}};
}
function mountNetwork(host,graph,openNote,options={}) {
  let settings={nodeSize:1,linkWidth:1,textThreshold:1.1,arrows:false,conceptColor:'#d32f2f',sourceColor:'#218739',...options};
  let groupTests=[];
  function updateGroups(){groupTests=(settings.groups||[]).filter(g=>g.query.trim()).map(g=>{try{return {test:compileQuery(g.query),color:g.color};}catch{return null;}}).filter(Boolean);}
  updateGroups();
  const doc=host.ownerDocument,win=doc.defaultView;
  const canvas=doc.createElement('canvas');canvas.className='sc-canvas';canvas.setAttribute('aria-label','Shared connections graph. Use the list below for keyboard navigation.');host.appendChild(canvas);
  const ctx=canvas.getContext('2d'),sim=createSimulation(graph,settings);
  let width=900,height=650,zoom=1,dx=0,dy=0,hover=null,drag=null,frame=0,running=true,disposed=false;
  let palette={},autoFit=true;
  function colors(){const style=win.getComputedStyle(host);palette={text:style.getPropertyValue('--text-normal').trim()||'#444',muted:style.getPropertyValue('--text-muted').trim()||'#888',blue:style.getPropertyValue('--color-blue').trim()||'#448aff',edge:style.getPropertyValue('--text-faint').trim()||'#aaa'};}
  const screen=n=>({x:n.x*zoom+dx,y:n.y*zoom+dy});
  function fit(){if(!sim.nodes.length)return;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const n of sim.nodes){x0=Math.min(x0,n.x);x1=Math.max(x1,n.x);y0=Math.min(y0,n.y);y1=Math.max(y1,n.y);}zoom=Math.min(2,(width-100)/Math.max(100,x1-x0),(height-100)/Math.max(100,y1-y0));dx=width/2-(x0+x1)/2*zoom;dy=height/2-(y0+y1)/2*zoom;}
  function draw(){ctx.clearRect(0,0,width,height);const neighbors=new Set();if(hover){neighbors.add(hover);for(const {a,b} of sim.edges){if(a===hover)neighbors.add(b);if(b===hover)neighbors.add(a);}}
    ctx.lineWidth=.65*settings.linkWidth;
    for(const {a,b} of sim.edges){const selected=hover&&(a===hover||b===hover);ctx.globalAlpha=hover?(selected?.8:.045):.19;ctx.strokeStyle=selected?palette.blue:palette.edge;const p=screen(a),q=screen(b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();if(settings.arrows){const angle=Math.atan2(q.y-p.y,q.x-p.x),offset=8*settings.nodeSize;const x=q.x-Math.cos(angle)*offset,y=q.y-Math.sin(angle)*offset;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(angle-.45)*6,y-Math.sin(angle-.45)*6);ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(angle+.45)*6,y-Math.sin(angle+.45)*6);ctx.stroke();}}
    ctx.globalAlpha=1;const labels=[];
    for(const n of sim.nodes){const p=screen(n);if(p.x< -30||p.x>width+30||p.y< -30||p.y>height+30)continue;const r=Math.max(2,Math.min(8,(2+Math.sqrt(n.degree)*.55)*Math.sqrt(zoom)))*settings.nodeSize;ctx.globalAlpha=hover&&!neighbors.has(n)?.18:1;ctx.fillStyle=groupTests.find(g=>g.test(n))?.color||(n.concept?settings.conceptColor:settings.sourceColor);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();if(n.missing){ctx.strokeStyle=palette.text;ctx.setLineDash([2,2]);ctx.stroke();ctx.setLineDash([]);}if(n===hover||(!hover&&zoom>settings.textThreshold)||neighbors.has(n))labels.push({n,p,r});}
    ctx.globalAlpha=1;ctx.font='12px sans-serif';ctx.textBaseline='middle';const occupied=new Set();labels.sort((a,b)=>(b.n===hover)-(a.n===hover)||b.n.degree-a.n.degree);
    let count=0;for(const {n,p,r} of labels){if(count>100&&n!==hover)continue;const label=n.path.split('/').pop().replace(/\.md$/i,'');const text=label.length>55?label.slice(0,52)+'…':label;const w=ctx.measureText(text).width;const x=p.x+r+5,y=p.y;let cells=[];for(let xx=Math.floor(x/60);xx<=Math.floor((x+w)/60);xx++)for(let yy=Math.floor((y-7)/16);yy<=Math.floor((y+7)/16);yy++)cells.push(xx+','+yy);if(n!==hover&&cells.some(c=>occupied.has(c)))continue;cells.forEach(c=>occupied.add(c));ctx.fillStyle=palette.text;ctx.fillText(text,x,y);count++;}
  }
  function tick(){frame=0;if(disposed)return;if(running){for(let i=0;i<2;i++)running=sim.step();if(autoFit)fit();}draw();if(running)frame=win.requestAnimationFrame(tick);}
  function wake(){if(!frame&&!disposed)frame=win.requestAnimationFrame(tick);}
  function location(e){const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
  function hit(p){let nearest=null,best=144;for(const n of sim.nodes){const q=screen(n),d=(p.x-q.x)**2+(p.y-q.y)**2;if(d<best){best=d;nearest=n;}}return nearest;}
  canvas.addEventListener('wheel',e=>{e.preventDefault();autoFit=false;const p=location(e),next=Math.max(.03,Math.min(10,zoom*Math.exp(-e.deltaY*.001)));dx=p.x-(p.x-dx)*next/zoom;dy=p.y-(p.y-dy)*next/zoom;zoom=next;wake();},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;autoFit=false;const p=location(e),node=hit(p);drag={...p,dx,dy,node,moved:false};if(node)node.fixed=true;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{const p=location(e);if(drag){if(Math.hypot(p.x-drag.x,p.y-drag.y)>4)drag.moved=true;if(drag.node){drag.node.x=(p.x-dx)/zoom;drag.node.y=(p.y-dy)/zoom;sim.reheat();running=true;}else{dx=drag.dx+p.x-drag.x;dy=drag.dy+p.y-drag.y;}}else{hover=hit(p);canvas.title=hover?hover.path+(hover.missing?' (not created)':''):'';canvas.style.cursor=hover?'pointer':'grab';}wake();});
  function release(e,cancelled=false){if(!drag)return;const previous=drag;drag=null;if(previous.node){previous.node.fixed=false;if(!cancelled&&!previous.moved)openNote(previous.node);}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);wake();}
  canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));canvas.addEventListener('pointerleave',()=>{if(!drag){hover=null;wake();}});
  const resize=new win.ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);const ratio=win.devicePixelRatio||1;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);colors();if(autoFit)fit();wake();});resize.observe(canvas);
  const theme=new win.MutationObserver(()=>{colors();wake();});theme.observe(doc.body,{attributes:true,attributeFilter:['class','style']});
  colors();fit();wake();
  return {setOptions(value){settings={...settings,...value};updateGroups();sim.setOptions(settings);running=true;wake();},fit(){autoFit=true;fit();wake();},dispose(){disposed=true;resize.disconnect();theme.disconnect();if(frame)win.cancelAnimationFrame(frame);}};
}
module.exports={createSimulation,mountNetwork};

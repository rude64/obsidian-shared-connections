"use strict";
function inFolder(path, folder) {
  const prefix = folder.trim().replace(/^\/+|\/+$/g, "");
  return !prefix || path.startsWith(prefix + "/");
}
function buildGraph(files, cache, settings) {
  const sources = new Set(files.filter(f => inFolder(f.path, settings.sourceFolder)).map(f => f.path));
  const markdown = new Set(files.map(f => f.path));
  const targets = new Map();
  function add(source, id, path, missing) {
    if (!sources.has(source) || source === path) return;
    if (!targets.has(id)) targets.set(id, { id, path, missing, sources: new Set() });
    targets.get(id).sources.add(source);
  }
  for (const source of sources) {
    for (const target of Object.keys(cache.resolvedLinks[source] || {})) {
      if (markdown.has(target)) add(source, 'file:' + target, target, false);
    }
    if (settings.includeUnresolved) {
      for (const raw of Object.keys(cache.unresolvedLinks[source] || {})) {
        // Aliases are already removed by Obsidian. Headings/blocks do not define separate concepts.
        const target = raw.split('#')[0].replace(/\.md$/i, '');
        if (target) add(source, 'missing:' + target, target, true);
      }
    }
  }
  const concepts = [...targets.values()].filter(t => t.sources.size >= settings.minimumSources);
  concepts.sort((a,b) => b.sources.size - a.sources.size || a.path.localeCompare(b.path));
  const nodes = new Map();
  const edges = [];
  for (const target of concepts) {
    if (!nodes.has(target.id)) nodes.set(target.id, {id:target.id, path:target.path, missing:target.missing, concept:true});
    else nodes.get(target.id).concept = true;
    for (const source of [...target.sources].sort()) {
      const id = 'file:' + source;
      if (!nodes.has(id)) nodes.set(id, {id,path:source,missing:false,concept:false});
      edges.push({source:id,target:target.id});
    }
  }
  return {nodes:[...nodes.values()],edges,concepts,sourceCount:sources.size};
}
module.exports = {buildGraph, inFolder};

"use strict";
// Deliberately small, documented query language; not Obsidian's complete search grammar.
function compileQuery(query) {
  const tokens=String(query||'').match(/(?:[^\s"]|"[^"]*")+/g)||[];
  if((String(query||'').match(/"/g)||[]).length%2)throw new Error('Close the quotation marks in your query.');
  const groups=[[]];
  for(let token of tokens){if(token==='OR'){if(!groups.at(-1).length)throw new Error('OR needs a term on both sides.');groups.push([]);continue;}if(token==='AND')continue;
    let exclude=token.startsWith('-');if(exclude)token=token.slice(1);
    let field='text',value=token;const colon=token.indexOf(':');if(colon>=0){field=token.slice(0,colon);value=token.slice(colon+1);if(!['path','file','tag'].includes(field))throw new Error('Supported fields: path:, file:, tag:.');}
    value=value.replace(/"/g,'').toLowerCase();if(!value)throw new Error('Enter a value after the filter prefix.');
    groups.at(-1).push(node=>{let match;if(field==='tag'){const wanted=value.replace(/^#/,'');match=(node.tags||[]).some(t=>{const tag=t.replace(/^#/,'').toLowerCase();return tag===wanted||tag.startsWith(wanted+'/');});}else{const text=field==='file'?node.path.split('/').pop():node.path;match=text.toLowerCase().includes(value);}return exclude?!match:match;});
  }
  if(tokens.length&&!groups.at(-1).length)throw new Error('OR needs a term on both sides.');
  return node=>groups.some(group=>group.every(test=>test(node)));
}
function filterGraph(graph,options,tagsForPath=()=>[]) {
  const nodes=graph.nodes.map(n=>({...n,tags:tagsForPath(n.path)}));
  const match=compileQuery(options.query);
  let selected=new Set(nodes.filter(match).map(n=>n.id));
  if(options.query.trim()&&options.keepNeighbors){const matches=new Set(selected);for(const e of graph.edges){if(matches.has(e.source))selected.add(e.target);if(matches.has(e.target))selected.add(e.source);}}
  let edges=graph.edges.filter(e=>selected.has(e.source)&&selected.has(e.target));
  const connected=new Set(edges.flatMap(e=>[e.source,e.target]));
  const visible=nodes.filter(n=>selected.has(n.id)&&connected.has(n.id));
  const ids=new Set(visible.map(n=>n.id));
  return {...graph,nodes:visible,edges,concepts:graph.concepts.filter(c=>ids.has(c.id))};
}
module.exports={compileQuery,filterGraph};

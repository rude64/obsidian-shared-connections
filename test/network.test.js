const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSimulation}=require('../network');
const fixture={nodes:Array.from({length:50},(_,i)=>({id:String(i),path:'Note '+i})),edges:Array.from({length:49},(_,i)=>({source:String(i),target:String(i+1)}))};
test('force layout stays finite and spreads nodes in both dimensions',()=>{const sim=createSimulation(fixture);for(let i=0;i<360;i++)sim.step();assert.ok(sim.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));assert.ok(Math.max(...sim.nodes.map(n=>n.x))-Math.min(...sim.nodes.map(n=>n.x))>50);assert.ok(Math.max(...sim.nodes.map(n=>n.y))-Math.min(...sim.nodes.map(n=>n.y))>50);assert.equal(sim.step(),false);sim.reheat();assert.equal(sim.step(),true);});
test('dragged nodes stay fixed while the simulation moves their neighbors',()=>{const sim=createSimulation(fixture);const node=sim.nodes[0];node.fixed=true;const {x,y}=node;for(let i=0;i<20;i++)sim.step();assert.equal(node.x,x);assert.equal(node.y,y);});
test('empty and single-node graphs settle safely',()=>{for(const graph of [{nodes:[],edges:[]},{nodes:[{id:'one'}],edges:[]}]){const sim=createSimulation(graph);for(let i=0;i<360;i++)sim.step();assert.ok(sim.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));}});

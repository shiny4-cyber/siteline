import {blocked,walkableEdge,visible} from './map.js';
// Build once. Radius-tested edges and chest visibility avoid doorframe traps.
export const graph=[];
for(let z=-19;z<=19;z+=2)for(let x=-15;x<=15;x+=2){
  if(!blocked(x,z,0.48))graph.push({x,z,edges:[]});
}
for(let i=0;i<graph.length;i++)for(let j=i+1;j<graph.length;j++){
  const a=graph[i],b=graph[j];
  if(Math.hypot(a.x-b.x,a.z-b.z)<=3.05&&walkableEdge(a.x,a.z,b.x,b.z)&&visible(a.x,a.z,b.x,b.z)){
    a.edges.push(j);b.edges.push(i);
  }
}
const n=graph.length,g=new Float64Array(n),f=new Float64Array(n),parent=new Int32Array(n),closed=new Uint8Array(n),open=new Uint8Array(n),reverse=new Int32Array(n);
export function nearestNode(x,z){
  let best=0,dist=Infinity;
  for(let i=0;i<n;i++){const a=graph[i],d=(a.x-x)**2+(a.z-z)**2;if(d<dist){dist=d;best=i;}}
  return best;
}
export function findPath(start,end,out){
  out.length=0;g.fill(Infinity);f.fill(Infinity);parent.fill(-1);closed.fill(0);open.fill(0);
  g[start]=0;f[start]=0;open[start]=1;
  for(let k=0;k<n;k++){
    let current=-1,best=Infinity;
    for(let i=0;i<n;i++)if(open[i]&&f[i]<best){current=i;best=f[i];}
    if(current<0)return out;
    if(current===end){let count=0;while(current!==-1){reverse[count++]=current;current=parent[current];}while(count)out.push(reverse[--count]);return out;}
    open[current]=0;closed[current]=1;
    const a=graph[current];
    for(let j=0;j<a.edges.length;j++){
      const id=a.edges[j];if(closed[id])continue;const b=graph[id],cost=g[current]+Math.hypot(a.x-b.x,a.z-b.z);
      if(cost<g[id]){parent[id]=current;g[id]=cost;f[id]=cost+Math.hypot(b.x-graph[end].x,b.z-graph[end].z);open[id]=1;}
    }
  }
  return out;
}

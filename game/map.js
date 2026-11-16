// Relay station layout: two exterior lanes, a two-door hall and a transformer yard.
// Coordinates are shared by rendering, collision, navigation and the tactical map.
export const SITES = Object.freeze([
  {id:'alpha', name:'RELAY A', short:'A', x:0, z:-10, radius:3.2, accent:'#e08a4a'},
  {id:'bravo', name:'TRANSFORMER B', short:'B', x:-12, z:2.5, radius:3.0, accent:'#7fd3c8'},
]);
export const SITE = SITES[0];
export function siteFor(seed){
  return SITES[Math.abs(seed|0)%SITES.length];
}
export const SOLIDS = [
  {x:-18,z:0,w:1,d:44,h:5,kind:'boundary'},
  {x:18,z:0,w:1,d:44,h:5,kind:'boundary'},
  {x:0,z:22,w:36,d:1,h:5,kind:'boundary'},
  {x:0,z:-22,w:36,d:1,h:5,kind:'boundary'},
  // Central splitter forces a choice between the west arcade and east freight lane.
  {x:0,z:7,w:9,d:11,h:4,kind:'splitter'},
  // Hall south wall: a wide west-facing approach door at x=-3.
  {x:-6.5,z:-5,w:3,d:0.6,h:4.8,kind:'hall'},
  {x:3.5,z:-5,w:9,d:0.6,h:4.8,kind:'hall'},
  {x:-8,z:-11,w:0.6,d:12,h:4.8,kind:'hall'},
  {x:0,z:-17,w:16,d:0.6,h:4.8,kind:'hall'},
  // East door at z=-10.
  {x:8,z:-6.5,w:0.6,d:3,h:4.8,kind:'hall'},
  {x:8,z:-14.5,w:0.6,d:5,h:4.8,kind:'hall'},
  {x:-12,z:9,w:3,d:2.5,h:1.6,kind:'crate'},
  {x:-14,z:-1,w:2.6,d:3,h:2.1,kind:'crate'},
  {x:-9.8,z:-10,w:2,d:3,h:1.5,kind:'crate'},
  {x:12,z:4,w:3,d:4,h:2.5,kind:'cargo'},
  {x:14,z:-7,w:2.4,d:3,h:1.5,kind:'crate'},
  {x:4,z:-12,w:2.5,d:2,h:1.3,kind:'console'},
  {x:-4.5,z:-13,w:2,d:2,h:1.4,kind:'crate'},
  // Transformer yard cover around site B.
  {x:-15.5,z:4.5,w:1.8,d:1.8,h:1.2,kind:'crate'},
  {x:-9.5,z:6.5,w:1.6,d:2.4,h:1.1,kind:'crate'},
];
export const COVER = [[-10,7],[-12,-3],[-6,-13],[2,-12],[12,-9],[10,2],[-5,-3],[6,-15],[-13,5],[-10,4]];
export function blocked(x,z,r=0.3,solids=SOLIDS,y=0){
  for(let i=0;i<solids.length;i++){
    const b=solids[i];
    if(y>=b.h) continue;
    const dx=Math.max(Math.abs(x-b.x)-b.w/2,0), dz=Math.max(Math.abs(z-b.z)-b.d/2,0);
    if(dx*dx+dz*dz<r*r) return true;
  }
  return false;
}
export function moveBody(b,dx,dz,solids=SOLIDS){
  // Substeps prevent tunnelling even when driven by an unusually large debug step.
  const n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/0.12));
  for(let k=0;k<n;k++){
    if(!blocked(b.x+dx/n,b.z,b.radius,solids,b.y)) b.x+=dx/n;
    if(!blocked(b.x,b.z+dz/n,b.radius,solids,b.y)) b.z+=dz/n;
  }
}
export function rayBox(ox,oy,oz,dx,dy,dz,minX,minY,minZ,maxX,maxY,maxZ){
  let lo=0,hi=1e6;
  if(Math.abs(dx)<1e-9){if(ox<minX||ox>maxX)return Infinity;}
  else{let a=(minX-ox)/dx,b=(maxX-ox)/dx;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);}
  if(Math.abs(dy)<1e-9){if(oy<minY||oy>maxY)return Infinity;}
  else{let a=(minY-oy)/dy,b=(maxY-oy)/dy;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);}
  if(Math.abs(dz)<1e-9){if(oz<minZ||oz>maxZ)return Infinity;}
  else{let a=(minZ-oz)/dz,b=(maxZ-oz)/dz;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);}
  return hi>=lo?lo:Infinity;
}
export function wallDistance(ox,oy,oz,dx,dy,dz,solids=SOLIDS){
  let near=Infinity;
  for(let i=0;i<solids.length;i++){
    const b=solids[i],d=rayBox(ox,oy,oz,dx,dy,dz,b.x-b.w/2,0,b.z-b.d/2,b.x+b.w/2,b.h,b.z+b.d/2);
    if(d<near)near=d;
  }
  return near;
}
export function visible(ax,az,bx,bz,height=1.4){
  const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz);
  return d<0.001||wallDistance(ax,height,az,dx/d,0,dz/d)>d-0.01;
}
export function walkableEdge(ax,az,bx,bz){
  const d=Math.hypot(bx-ax,bz-az),n=Math.ceil(d/0.2);
  for(let i=0;i<=n;i++)if(blocked(ax+(bx-ax)*i/n,az+(bz-az)*i/n,0.38))return false;
  return true;
}
// Defensive anchors hang off the active site, so both layouts get their own holds.
export function siteHolds(site){
  return [
    [site.x-2.2,site.z-2.0],
    [site.x+2.0,site.z-2.6],
    [site.x+3.6,site.z+1.4],
    [site.x-3.4,site.z+2.2],
  ];
}

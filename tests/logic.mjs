import assert from 'node:assert/strict';
const rows = [];
export async function test(name, run) {
  try { await run(); rows.push({test:name,result:'PASS'}); }
  catch(e) { rows.push({test:name,result:'FAIL',detail:e.message}); }
}
await test('Collision: a moving capsule cannot cross a solid wall', async()=>{
  const {moveBody} = await import('../game/map.js');
  const body={x:0,z:2,y:0,radius:0.3};
  for(let i=0;i<200;i++) moveBody(body,0,-0.04,[{x:0,z:0,w:4,d:1,h:3}]);
  assert.ok(body.z>=0.799,`wall crossed: ${body.z}`);
});
await test('Navigation: visibility edges and A* reach both hall doors', async()=>{
  const {graph,nearestNode,findPath} = await import('../game/nav.js');
  const {walkableEdge} = await import('../game/map.js');
  for(const a of graph)for(const j of a.edges)assert.ok(walkableEdge(a.x,a.z,graph[j].x,graph[j].z));
  for(const start of [[-11,18],[12,18],[12,-10]]){
    const path=[];findPath(nearestNode(...start),nearestNode(0,-10),path);
    assert.ok(path.length>1,'site unreachable');
    assert.equal(path.at(-1),nearestNode(0,-10));
  }
});
await test('Combat: body hit, head multiplier, magazine and reload', async()=>{
  const {createState,spawnRound} = await import('../game/state.js');
  const {fire,reload,tickWeapon,traceBody,applyDamage} = await import('../game/combat.js');
  const s=createState();spawnRound(s);s.phase='live';
  const p=s.player,b=s.actors[0];
  b.x=0;b.z=0;b.y=0;b.armour=0;
  assert.equal(traceBody(0,1.65,5,0,0,-1,b).part,'head');
  assert.equal(traceBody(0,0.8,5,0,0,-1,b).part,'body');
  applyDamage(s,b,25,'head',p);assert.equal(b.hp,0);assert.equal(b.alive,false);
  p.x=-11;p.z=18;p.yaw=0;p.mag=1;p.reserve=59;p.reload=0;p.cooldown=0;
  assert.ok(fire(s,p),'rifle failed to fire');assert.equal(p.mag,0);
  tickWeapon(p,1);assert.equal(fire(s,p),false,'fired with an empty magazine');
  assert.equal(reload(p),true);assert.ok(p.reload>0);tickWeapon(p,3);
  assert.equal(p.mag,30);assert.equal(p.reserve,29);
});
await test('Objective: plant, fuse detonation, round restart and buy', async()=>{
  const {createState,spawnRound} = await import('../game/state.js');
  const {buy,advance} = await import('../game/sim.js');
  const {SITE} = await import('../game/map.js');
  const s=createState();spawnRound(s,{nobots:true});s.player.x=SITE.x;s.player.z=SITE.z;
  s.player.money=3000;
  assert.equal(buy(s,'armour'),true);assert.equal(s.player.armour,100);
  assert.equal(buy(s,'grenade'),true);assert.equal(s.player.grenades,2);
  assert.equal(buy(s,'dmr'),true);assert.equal(s.player.weapon,'dmr');
  advance(s,13);assert.equal(s.phase,'live');
  s.input.plant=true;advance(s,4);assert.ok(s.bomb,'bomb not planted');assert.equal(s.bomb.state,'armed');
  advance(s,41);assert.equal(s.phase,'roundEnd');assert.equal(s.score.attack,1);assert.equal(s.winner,'attack');
  advance(s,6);assert.equal(s.phase,'buy');assert.equal(s.round,2);assert.ok(s.player.money>=1400);
});
console.table(rows);
if(rows.some(r=>r.result==='FAIL')) process.exitCode=1;

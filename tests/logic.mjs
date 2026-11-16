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
  assert.equal(buy(s,'grenade'),true);assert.equal(s.player.stock.frag,2);
  assert.equal(buy(s,'dmr'),true);assert.equal(s.player.weapon,'dmr');
  advance(s,13);assert.equal(s.phase,'live');
  s.input.plant=true;advance(s,4);assert.ok(s.bomb,'bomb not planted');assert.equal(s.bomb.state,'armed');
  advance(s,41);assert.equal(s.phase,'roundEnd');assert.equal(s.score.attack,1);assert.equal(s.winner,'attack');
  advance(s,6);assert.equal(s.phase,'buy');assert.equal(s.round,2);assert.ok(s.player.money>=1400);
});
await test('Variety: per-seed site, five weapons, three grenade types', async()=>{
  const {createState,spawnRound,WEAPONS,GRENADES} = await import('../game/state.js');
  const {buy} = await import('../game/sim.js');
  const a=createState(0),b=createState(1);
  assert.notEqual(a.site.id,b.site.id,'match seed must pick between the two sites');
  assert.equal(a.site.id,'alpha');assert.equal(b.site.id,'bravo');
  spawnRound(b,{seed:1});assert.equal(b.site.id,'bravo');
  assert.equal(b.actors.filter(x=>x.team==='defend').length,4);
  const s=createState();spawnRound(s,{nobots:true});s.player.money=8000;
  assert.equal(buy(s,'shotgun'),true);assert.equal(s.player.mag,WEAPONS.shotgun.mag);
  assert.equal(buy(s,'lmg'),true);assert.equal(s.player.mag,WEAPONS.lmg.mag);
  assert.equal(buy(s,'grenade:smoke'),true);assert.equal(s.player.stock.smoke,1);
  assert.equal(buy(s,'grenade:flash'),true);assert.equal(s.player.stock.flash,1);
  assert.equal(GRENADES.smoke.duration>0&&GRENADES.flash.blind>0,true);
});
await test('Grenades: smoke blocks bot sight, flash blinds, frag damages', async()=>{
  const {createState,spawnRound} = await import('../game/state.js');
  const {explode,smokeBlocks} = await import('../game/combat.js');
  const {scanTarget} = await import('../game/bots.js');
  const s=createState();spawnRound(s);s.phase='live';
  const p=s.player,def=s.actors.find(a=>a.team==='defend');
  p.x=0;p.z=0;def.x=-3;def.z=-6;def.yaw=Math.PI;
  assert.equal(scanTarget(s,def),p,'baseline line of sight must see the player');
  explode(s,-3,-3,'smoke');
  assert.equal(smokeBlocks(s,def.x,def.z,p.x,p.z),true);
  assert.equal(scanTarget(s,def),null,'smoke must cut bot perception');
  s.smokes.length=0;
  explode(s,-3,-4.5,'flash');
  assert.ok(def.blind>0,'flash must blind a defender in line of sight');
  assert.equal(scanTarget(s,def),null);
  const hp=def.hp;
  explode(s,def.x,def.z,'frag');
  assert.ok(def.hp<hp,'frag must damage a defender at ground zero');
});
await test('Economy: round income escalates with the round and loss streak', async()=>{
  const {createState,spawnRound,roundOver} = await import('../game/state.js');
  const s=createState();spawnRound(s,{nobots:true});s.phase='live';
  const first=s.player.money;
  roundOver(s,'attack','defenders eliminated');
  const win1=s.summary.income;
  s.phase='live';s.round=3;
  roundOver(s,'attack','defenders eliminated');
  const win3=s.summary.income;
  assert.ok(win3>win1,`round 3 win (${win3}) must beat round 1 (${win1})`);
  assert.ok(s.player.money>first);
  s.phase='live';s.round=4;s.streak.defend=2;
  roundOver(s,'attack','defenders eliminated');
  assert.ok(s.summary.income>=win3);
  assert.ok(s.economy.lossCap>s.economy.lossBase);
});
await test('Modes: site rush is three no-economy rounds and ends the match', async()=>{
  const {createState,spawnRound,roundOver} = await import('../game/state.js');
  const {buy} = await import('../game/sim.js');
  const s=createState(0,'rush');spawnRound(s,{nobots:true,seed:0});
  assert.equal(s.mode.id,'rush');assert.equal(s.phase,'live');assert.equal(s.mode.rounds,3);
  assert.equal(s.player.money,0);assert.equal(buy(s,'rifle'),false,'rush must not sell weapons');
  for(let i=0;i<3;i++){s.phase='live';roundOver(s,'attack','defenders eliminated');if(s.phase==='roundEnd'){s.phase='live';s.round++;}}
  assert.equal(s.phase,'matchEnd','three rounds must end the match');
  assert.equal(s.matchWinner,'attack');assert.equal(s.score.attack,3);
  const std=createState(0,'standard');spawnRound(std,{nobots:true});
  assert.equal(std.mode.id,'standard');assert.equal(std.mode.rounds,0);
});
console.table(rows);
if(rows.some(r=>r.result==='FAIL')) process.exitCode=1;

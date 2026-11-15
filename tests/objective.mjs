import assert from 'node:assert/strict';
import test from 'node:test';
import {createState,spawnRound,STEP} from '../game/state.js';
import {tick} from '../game/sim.js';

function fixture(nobots=true){
  const s=createState();spawnRound(s,{nobots});s.phase='live';s.phaseTimer=115;
  s.player.x=0;s.player.z=-10;
  s.bomb={x:0,z:-10,timer:40,state:'armed',defuse:0};
  return s;
}
function steps(s,n){for(let i=0;i<n;i++)tick(s,STEP);}

test('attacker cannot defuse its own armed charge even with a kit',()=>{
  const s=fixture();s.player.hasDefuse=true;s.input.defuse=true;
  assert.equal(s.player.team,'attack');
  steps(s,610);
  assert.equal(s.winner,null,'attacker input must not award a defender win');
  assert.equal(s.phase,'live');assert.equal(s.bomb.state,'armed');
  assert.equal(s.bomb.defuse,0);assert.ok(s.bomb.timer<35);
});

test('armed bomb survives a double wipe and detonates for attack',()=>{
  const s=fixture(false);s.player.alive=false;
  for(const b of s.actors)b.alive=false;
  s.bomb.timer=30;
  tick(s,STEP);
  assert.equal(s.phase,'live','double wipe must not stop an armed bomb');
  assert.equal(s.winner,null);assert.equal(s.bomb.state,'armed');
  steps(s,3600);
  assert.equal(s.winner,'attack');assert.equal(s.winReason,'charge detonated');
  assert.equal(s.score.attack,1);assert.equal(s.score.defend,0);
});

test('synthetic defender with kit completes an uninterrupted defuse',()=>{
  const s=fixture();s.player.team='defend';s.player.hasDefuse=true;s.input.defuse=true;
  steps(s,610);
  assert.equal(s.winner,'defend');assert.equal(s.winReason,'charge defused');
  assert.equal(s.bomb.state,'defused');assert.equal(s.score.defend,1);
});

for(const interrupt of ['release','distance','death','kit']){
  test(`player defuse resets on ${interrupt}`,()=>{
    const s=fixture();s.player.team='defend';s.player.hasDefuse=true;s.input.defuse=true;
    steps(s,240);assert.ok(s.bomb.defuse>1.9);
    if(interrupt==='release')s.input.defuse=false;
    if(interrupt==='distance')s.player.x=3;
    if(interrupt==='death')s.player.alive=false;
    if(interrupt==='kit')s.player.hasDefuse=false;
    tick(s,STEP);assert.equal(s.bomb.defuse,0);assert.equal(s.winner,null);
    s.player.alive=true;s.player.x=0;s.player.hasDefuse=true;s.input.defuse=true;
    steps(s,400);assert.equal(s.winner,null,'partial attempts must not accumulate');
    steps(s,210);assert.equal(s.winner,'defend');
  });
}

for(const eliminated of ['attack','defend','both']){
  test(`no bomb: ${eliminated} elimination retains original result`,()=>{
    const s=fixture(false);s.bomb=null;
    if(eliminated!=='defend')s.player.alive=false;
    for(const b of s.actors)if(b.team===eliminated||eliminated==='both')b.alive=false;
    tick(s,STEP);
    assert.equal(s.winner,eliminated==='attack'?'defend':'attack');
    assert.equal(s.winReason,eliminated==='attack'?'attackers eliminated':'defenders eliminated');
  });
}

test('no bomb: timeout still awards defenders',()=>{
  const s=fixture();s.bomb=null;s.phaseTimer=0;
  tick(s,STEP);assert.equal(s.winner,'defend');assert.equal(s.winReason,'time expired');
});

test('armed bomb outlives the round clock',()=>{
  const s=fixture(false);s.phaseTimer=0;s.bomb.timer=1;s.player.alive=false;
  for(const b of s.actors)b.alive=false;
  tick(s,STEP);assert.equal(s.winner,null);
  steps(s,120);assert.equal(s.winner,'attack');
});

function botFixture(){
  const s=fixture(false);s.player.alive=false;
  for(const b of s.actors)b.alive=false;
  const b=s.actors.find(b=>b.team==='defend');
  b.alive=true;b.x=0;b.z=-10;b.target=null;
  return {s,b};
}

test('living defender bot defuses and awards a defender round win',()=>{
  const {s,b}=botFixture();
  steps(s,610);
  assert.ok(b.defusing>=5);assert.equal(s.bomb.state,'defused');
  assert.equal(s.winner,'defend');assert.equal(s.winReason,'charge defused');
});

for(const interrupt of ['distance','death','reload','combat']){
  test(`bot defuse resets on ${interrupt}`,()=>{
    const {s,b}=botFixture();steps(s,240);assert.ok(b.defusing>1.9);
    if(interrupt==='distance')b.x=4;
    if(interrupt==='death')b.alive=false;
    if(interrupt==='reload')b.reload=2;
    if(interrupt==='combat'){
      s.player.alive=true;s.player.x=0;s.player.z=-12;
      b.target=s.player;b.scan=1;
    }
    tick(s,STEP);assert.equal(b.defusing,0,'interrupted bot must restart defuse');
    assert.equal(s.winner,null);
    b.x=0;b.z=-10;b.alive=true;b.reload=0;b.target=null;b.scan=0;
    s.player.alive=false;
    steps(s,400);assert.equal(s.winner,null);
    steps(s,210);assert.equal(s.winner,'defend');
  });
}

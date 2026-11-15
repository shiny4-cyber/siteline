// HUD: one DOM write per changed field per frame, no layout churn in the hot loop.
import {WEAPONS,PRICES} from './state.js';
const $=id=>document.getElementById(id);
const BUY_ITEMS=[
  {key:'1',id:'rifle',label:WEAPONS.rifle.name,note:'30 rounds · 27 dmg · accurate',price:WEAPONS.rifle.price},
  {key:'2',id:'smg',label:WEAPONS.smg.name,note:'25 rounds · fast cycle',price:WEAPONS.smg.price},
  {key:'3',id:'dmr',label:WEAPONS.dmr.name,note:'10 rounds · 62 dmg · headshot lethal',price:WEAPONS.dmr.price},
  {key:'4',id:'armour',label:'Plate carrier',note:'100 armour · halves body damage',price:PRICES.armour},
  {key:'5',id:'grenade',label:'Frag charge',note:'radial damage · flushes cover',price:PRICES.grenade},
  {key:'6',id:'defuse',label:'Defuse kit',note:'required to defuse a planted charge',price:PRICES.defuse},
];
export function createHud(s,buy){
  const el={hp:$('hp'),ap:$('ap'),hpBar:$('hpBar').firstElementChild,apBar:$('apBar').firstElementChild,
    mag:$('ammoMag'),reserve:$('ammoReserve'),weapon:$('weaponName'),money:$('money'),buyMoney:$('buyMoney'),
    clock:$('clock'),atk:$('scoreAtk'),def:$('scoreDef'),round:$('roundLabel'),grenades:$('grenades'),
    defuse:$('defuseKit'),feed:$('feed'),hit:$('hitmarker'),overlay:$('overlay'),ovTitle:$('ovTitle'),
    ovSub:$('ovSub'),plant:$('plantWrap'),plantBar:$('plantBar').firstElementChild,bomb:$('bombStatus'),hint:$('hint')};
  const grid=$('buyGrid');
  for(const it of BUY_ITEMS){
    const card=document.createElement('div');
    card.className='item';card.dataset.id=it.id;
    card.innerHTML=`<div><b><span class="key">${it.key}</span>${it.label}</b><small>${it.note}</small></div><div class="price">$${it.price}</div>`;
    card.addEventListener('click',()=>buy(it.id));
    grid.appendChild(card);
  }
  const cache={};
  const put=(node,key,value)=>{if(cache[key]!==value){cache[key]=value;node.textContent=value;}};
  const bar=(node,key,pct)=>{if(cache[key]!==pct){cache[key]=pct;node.style.width=pct+'%';}};
  let feedFor=0,hitFor=0,lastFeed='';
  return {
    update(s){
      const p=s.player;
      put(el.hp,'hp',String(Math.max(0,Math.round(p.hp))));
      put(el.ap,'ap',String(Math.round(p.armour)));
      bar(el.hpBar,'hpb',Math.max(0,Math.min(100,p.hp)).toFixed(0));
      bar(el.apBar,'apb',Math.max(0,Math.min(100,p.armour)).toFixed(0));
      put(el.mag,'mag',String(p.mag));
      put(el.reserve,'res',`/ ${p.reserve}`);
      put(el.weapon,'w',(WEAPONS[p.weapon]||WEAPONS.rifle).name);
      put(el.money,'m',String(Math.round(p.money)));
      put(el.buyMoney,'bm',String(Math.round(p.money)));
      put(el.grenades,'g',String(p.grenades));
      put(el.defuse,'dk',p.hasDefuse?'KIT':'—');
      const t=Math.max(0,Math.ceil(s.phase==='buy'?s.phaseTimer:s.phase==='live'?s.phaseTimer:0));
      put(el.clock,'clock',`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`);
      put(el.atk,'atk',String(s.score.attack));
      put(el.def,'def',String(s.score.defend));
      put(el.round,'rl',`ROUND ${s.round} · ${s.phase==='buy'?'BUY PHASE':s.phase==='live'?'LIVE':'ROUND OVER'}`);
      for(const card of grid.children){
        const it=BUY_ITEMS.find(x=>x.id===card.dataset.id);
        card.classList.toggle('locked',p.money<it.price);
      }
      const planting=s.plantProgress>0;
      el.plant.classList.toggle('on',planting);
      if(planting)bar(el.plantBar,'pb',(s.plantProgress/3.2*100).toFixed(0));
      const armed=!!s.bomb&&s.bomb.state==='armed';
      el.bomb.classList.toggle('on',armed);
      if(armed&&s.time>feedFor)feedFor=s.time;
      el.hint.classList.toggle('on',s.phase==='live'&&!s.bomb&&Math.hypot(p.x,p.z+10)<5);
      const dead=!p.alive;
      const ended=s.phase==='roundEnd';
      el.overlay.classList.toggle('on',dead||ended);
      if(ended&&s.winner){
        put(el.ovTitle,'ovt',s.winner==='attack'?'RELAY SECURED':'SITE HELD');
        put(el.ovSub,'ovs',s.winReason);
      }else if(dead){
        put(el.ovTitle,'ovt','ELIMINATED');
        put(el.ovSub,'ovs','spectating · your squad still has the round');
      }
      const msg=s.lastEvent;
      if(msg&&msg!==lastFeed){lastFeed=msg;this.feed(msg);}
      if(s.stats.hits>hitFor){hitFor=s.stats.hits;el.hit.classList.add('on');setTimeout(()=>el.hit.classList.remove('on'),90);}
    },
    feed(text){
      const row=document.createElement('div');row.textContent=text;el.feed.prepend(row);
      while(el.feed.children.length>4)el.feed.lastElementChild.remove();
      setTimeout(()=>row.remove(),4200);
    },
  };
}
export {BUY_ITEMS};

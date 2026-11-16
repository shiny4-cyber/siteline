// HUD: one DOM write per changed field per frame, no layout churn in the hot loop.
import {WEAPONS,GRENADES,GRENADE_ORDER,PRICES} from './state.js';
const $=id=>document.getElementById(id);
const BUY_ITEMS=[
  {key:'1',id:'rifle',label:WEAPONS.rifle.name,note:WEAPONS.rifle.role,price:WEAPONS.rifle.price},
  {key:'2',id:'smg',label:WEAPONS.smg.name,note:WEAPONS.smg.role,price:WEAPONS.smg.price},
  {key:'3',id:'dmr',label:WEAPONS.dmr.name,note:WEAPONS.dmr.role,price:WEAPONS.dmr.price},
  {key:'4',id:'shotgun',label:WEAPONS.shotgun.name,note:WEAPONS.shotgun.role,price:WEAPONS.shotgun.price},
  {key:'5',id:'lmg',label:WEAPONS.lmg.name,note:WEAPONS.lmg.role,price:WEAPONS.lmg.price},
  {key:'6',id:'armour',label:'Plate carrier',note:'100 armour · halves body damage',price:PRICES.armour},
  {key:'7',id:'grenade:frag',label:'Frag charge',note:'radial damage · flushes cover',price:GRENADES.frag.price},
  {key:'8',id:'grenade:smoke',label:'Smoke canister',note:'12 s cloud · blocks bot sight',price:GRENADES.smoke.price},
  {key:'9',id:'grenade:flash',label:'Flash bang',note:'blinds bots in line of sight',price:GRENADES.flash.price},
  {key:'0',id:'defuse',label:'Defuse kit',note:'required to defuse a planted charge',price:PRICES.defuse},
];
export function createHud(s,buy){
  const el={hp:$('hp'),ap:$('ap'),hpBar:$('hpBar').firstElementChild,apBar:$('apBar').firstElementChild,
    mag:$('ammoMag'),reserve:$('ammoReserve'),weapon:$('weaponName'),money:$('money'),buyMoney:$('buyMoney'),
    clock:$('clock'),atk:$('scoreAtk'),def:$('scoreDef'),round:$('roundLabel'),grenades:$('grenades'),
    defuse:$('defuseKit'),feed:$('feed'),hit:$('hitmarker'),overlay:$('overlay'),ovTitle:$('ovTitle'),
    ovSub:$('ovSub'),ovStats:$('ovStats'),plant:$('plantWrap'),plantBar:$('plantBar').firstElementChild,
    bomb:$('bombStatus'),hint:$('hint'),site:$('siteLabel')};
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
  let hitFor=0,feedCount=0;
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
      put(el.grenades,'g',GRENADE_ORDER.map(k=>`${k[0].toUpperCase()}${p.stock[k]||0}`).join(' '));
      put(el.defuse,'dk',p.hasDefuse?'KIT':'—');
      put(el.site,'site',s.phase==='buy'
        ?`BUY PHASE · OBJECTIVE ${s.site.short} — ${s.site.name}`
        :`OBJECTIVE ${s.site.short} — PLANT AT ${s.site.name} · HOLD E · ${s.mode.name}`);
      const t=Math.max(0,Math.ceil(s.phaseTimer));
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
      el.hint.classList.toggle('on',s.phase==='live'&&!s.bomb&&Math.hypot(p.x-s.site.x,p.z-s.site.z)<6);
      const dead=!p.alive;
      const ended=s.phase==='roundEnd'||s.phase==='matchEnd';
      el.overlay.classList.toggle('on',dead||ended);
      if(ended&&s.winner){
        const side=s.winner==='attack'?'SAPERS':'CUSTODIANS';
        put(el.ovTitle,'ovt',s.phase==='matchEnd'
          ?(s.matchWinner==='draw'?'MATCH DRAWN':`MATCH WON — ${s.matchWinner==='attack'?'SAPERS':'CUSTODIANS'}`)
          :`${side} WIN THE ROUND`);
        put(el.ovSub,'ovs',`${s.winReason} · round ${s.round} of ${s.mode.rounds||'∞'}`);
        if(s.summary)put(el.ovStats,'ovst',
          `SCORE ${s.score.attack}–${s.score.defend}   INCOME ${s.mode.economy?'+$'+s.summary.income:'NO ECONOMY'}   K/D ${s.summary.kills}/${s.summary.deaths}   ${s.phase==='matchEnd'?'ENTER FOR A NEW MATCH':'NEXT ROUND IN '+Math.ceil(s.phaseTimer)+'s'}`);
      }else if(dead){
        put(el.ovTitle,'ovt','ELIMINATED');
        put(el.ovSub,'ovs','spectating · your squad still has the round');
        put(el.ovStats,'ovst','');
      }
      if(s.killFeed.length!==feedCount){feedCount=s.killFeed.length;if(s.killFeed[0])this.feed(s.killFeed[0].text);}
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

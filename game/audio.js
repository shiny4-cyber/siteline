// Procedural audio cues: no assets, one WebAudio graph, cheap oscillators only.
let ctx=null,master=null;
function ensure(){
  if(ctx)return ctx;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  ctx=new AC();
  master=ctx.createGain();master.gain.value=0.16;master.connect(ctx.destination);
  return ctx;
}
export function unlockAudio(){const c=ensure();if(c&&c.state==='suspended')c.resume();}
function blip(freq,dur,type='square',gain=1,slide=0){
  const c=ensure();if(!c)return;
  const o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.value=freq;
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),c.currentTime+dur);
  g.gain.value=gain;
  g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+dur);
  o.connect(g);g.connect(master);o.start();o.stop(c.currentTime+dur);
}
export const sfx={
  shot(weapon){blip(weapon==='shotgun'?120:weapon==='lmg'?95:150,0.07,'square',0.9,-90);},
  hit(head){blip(head?1500:900,0.05,'triangle',0.7);},
  kill(){blip(680,0.09,'triangle',0.8,420);},
  footstep(){blip(90,0.045,'sine',0.35,-30);},
  reload(){blip(240,0.06,'sine',0.3,-60);},
  plant(){blip(520,0.18,'sine',0.5,240);},
  defuse(){blip(320,0.2,'sine',0.5,-160);},
  grenade(){blip(180,0.12,'sawtooth',0.5,-80);},
  round(win){win?blip(520,0.22,'triangle',0.8,260):blip(220,0.24,'triangle',0.7,-90);},
};

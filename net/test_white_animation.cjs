// White-only animation regression check. Simulation smoke tests; not visual/browser QA.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname+'/../';
const source=fs.readFileSync(root+'game.js','utf8').replace(/\}\)\(\);\s*$/, `window.__animTest={
  white(){return {x:human.x,z:human.z,stridePhase:human.stridePhase,recoverT:human.recoverT,savePoseT:human.savePoseT,saveFrame:human.saveFrame}},
  reach(){phase='rally';ball=makeBall(human.x+1.55,human.z+0.15,1,0,0,0,1);hCool=0;human.cool=0;return playHit(0,'forehand',.6);},
  select(){return selectHumanSprite()?.src||null}
 };})();`);
const callbacks=[],ev={},noop=()=>{};
const ctx=new Proxy({}, {get(obj,k){if(k==='measureText')return()=>({width:70});return obj[k]===undefined?noop:obj[k]},set(obj,k,v){obj[k]=v;return true}});
const canvas={getContext:()=>ctx,addEventListener:(k,fn)=>ev['c'+k]=fn,focus:noop,getBoundingClientRect:()=>({left:0,top:0,width:1672,height:941})};
class Img{constructor(){this.complete=true;this.naturalWidth=512;this.width=512;this.height=512}set src(v){if(this.onload)this.onload()}}
class Aud{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){}}
const window={PADEL_ASSETS:JSON.parse(fs.readFileSync(root+'assets.js','utf8').split('=',2)[1].replace(/;\s*$/,'')),PADEL_YELLOW:{},PADEL_RECORDINGS:{},addEventListener:(k,fn)=>ev[k]=fn};
const world={window,document:{getElementById:id=>id==='game'?canvas:{textContent:''},querySelector:noop},Image:Img,Audio:Aud,requestAnimationFrame:fn=>callbacks.push(fn),console,performance:{now:()=>0},Math};
vm.runInNewContext(source,world,{filename:'game.js'});
let ms=0;function frame(n=1){for(let i=0;i<n;i++){const fn=callbacks.shift();ms+=16.667;fn(ms)}}
frame(5);ev.keydown({code:'Enter',repeat:false,preventDefault:noop});frame(4);
assert.strictEqual(window.__padelDebug().phase,'serveReady');
assert(window.__animTest.select());
const x0=window.__animTest.white().x;
ev.keydown({code:'ArrowRight',repeat:false,preventDefault:noop});frame(45);
const w=window.__animTest.white();assert(w.x>x0+.5);assert(w.stridePhase>1);
const s=window.PadelOnlineBridge.getSnapshot(); // offline mode does not expose snapshot
window.PadelOnlineBridge.setMode('host');
assert(Number.isFinite(window.PadelOnlineBridge.getSnapshot().human.stridePhase));
ev.keyup({code:'ArrowRight',repeat:false,preventDefault:noop});frame(20);
assert.strictEqual(window.__animTest.reach(),true,'difficult but legal contact');
assert(window.__animTest.white().savePoseT>0,'difficult hit gets short reach pose');
const selected=window.__animTest.select();assert(selected.includes('forehand'));
frame(12);assert(window.__animTest.white().savePoseT===0);
console.log('WHITE_STRIDE_OK, WHITE_REACH_POSE_OK, HOST_SNAPSHOT_ANIM_OK, BALL_PHYSICS_NOT_CHANGED');

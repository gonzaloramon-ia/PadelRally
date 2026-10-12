const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\}\)\(\);\s*$/, `window.__testA41={
  yellowStill(){
   partner.pose=0;partner.visualIdleT=0;partner.moving=true;partner.visualSpeed=3.6;
   const o={};
   for(const face of ['run_left','run_right','forward','backward']){
    partner.visualFacing=face;partner.motion=face;partner.stridePhase=0;
    const a=selectYellowSprite(partner).src;partner.stridePhase=1;
    const b=selectYellowSprite(partner).src;partner.stridePhase=19;
    const c=selectYellowSprite(partner).src;o[face]=[a,b,c];
   }return o;
  },
  facing(){
   partner.visualFacing='run_left';partner.motion='run_right';partner.pose=0;partner.moving=true;partner.visualSpeed=3;
   partner.visualIdleT=0;partner.visualPending='';partner.visualPendingT=0;
   stabilizeYellowFacing(partner,.06);const first=partner.visualFacing;
   stabilizeYellowFacing(partner,.06);const second=partner.visualFacing;
   partner.motion='run_left';stabilizeYellowFacing(partner,.02);const pending=partner.visualFacing;
   stabilizeYellowFacing(partner,.11);const recovered=partner.visualFacing;
   partner.motion='idle';partner.moving=false;partner.visualSpeed=0;
   stabilizeYellowFacing(partner,.06);const still=partner.visualFacing;
   stabilizeYellowFacing(partner,.06);const idle=partner.visualFacing;
   return {first,second,pending,recovered,still,idle};
  }
 };})();`);
const noop=()=>{};
const ctx=new Proxy({},{get(o,k){if(k==='measureText')return()=>({width:100});if(k==='createLinearGradient')return()=>({addColorStop:noop});return o[k]??noop;},set(o,k,v){o[k]=v;return true;}});
const canvas={getContext:()=>ctx,addEventListener:noop};
const win={PADEL_ASSETS:{human:{},robot:{}},PADEL_YELLOW:JSON.parse(fs.readFileSync(path.join(root,'yellow.js'),'utf8').split('=',2)[1].replace(/;\s*$/,'')),PADEL_RECORDINGS:{},addEventListener:noop};
class Img{constructor(){this.naturalWidth=512;this.complete=true;}set src(s){this.onload?.()}}
class Aud{constructor(){this.paused=true;}play(){return Promise.resolve();}pause(){}}
vm.runInNewContext(source,{window:win,document:{getElementById:()=>canvas,querySelector:()=>({})},Image:Img,Audio:Aud,console,requestAnimationFrame:noop});
const a=win.__testA41;
const ss=a.yellowStill();
for(const [dir,files] of Object.entries(ss)){assert(new Set(files).size===1,'each full-stride cycle repeats the same facing for '+dir);}
assert.notStrictEqual(ss.run_left[0],ss.run_right[0],'left and right facing identical');
const facing=a.facing();
assert.strictEqual(facing.first,'run_left');
assert.strictEqual(facing.second,'run_right');
assert.strictEqual(facing.pending,'run_right');
assert.strictEqual(facing.recovered,'run_left');
assert.strictEqual(facing.still,'run_left');
assert.strictEqual(facing.idle,'idle');
console.log('A4_1_ORIENTATION_STABLE_ALL_DIRECTIONS_OK, TRANSITION_HYSTERESIS_OK, NO_FRAME_SPIN_OK');

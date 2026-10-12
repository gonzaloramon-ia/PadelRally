const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
const txt=fs.readFileSync(path.join(root,'game.js'),'utf8');
const source=txt.replace(/\}\)\(\);\s*$/, `window.__a42={
  frames(dir){partner.pose=0;partner.moving=true;partner.visualSpeed=3.2;partner.visualIdleT=0;
   partner.visualFacing=dir;partner.motion=dir;
   const results=[];
   for(let i=0;i<8;i++){partner.stridePhase=i/8;const fr=selectYellowSprite(partner);results.push({src:fr.src,bounds:fr.bounds});}
   return results;
  },
  stop(){partner.pose=0;partner.moving=false;partner.visualFacing='run_right';partner.visualIdleT=.2;
   return selectYellowSprite(partner)?.src;},
  afterShot(){partner.pose=.2;partner.motion='forehand';partner.frameT=.03;
   return selectYellowSprite(partner)?.src;},
  strideByDistance(){partner.stridePhase=0;partner.moving=true;partner.pose=0;partner.x=2;partner.z=4;partner.motion='run_right';
   partner.visualFacing='run_right';stepRemotePartner(.1);return partner.stridePhase;}
};})();`);
const noop=()=>{};
const ctx=new Proxy({},{get(o,k){if(k==='measureText')return()=>({width:100});if(k==='createLinearGradient')return()=>({addColorStop:noop});return o[k]??noop;},set(o,k,v){o[k]=v;return true;}});
const canvas={getContext:()=>ctx,addEventListener:noop};
const win={PADEL_ASSETS:{human:{},robot:{}},PADEL_YELLOW:JSON.parse(fs.readFileSync(path.join(root,'yellow.js'),'utf8').split('=',2)[1].replace(/;\s*$/,'')),PADEL_RECORDINGS:{},addEventListener:noop};
class Img{constructor(){this.naturalWidth=512;this.complete=true;}set src(s){this.onload?.()}}
class Aud{constructor(){this.paused=true;}play(){return Promise.resolve();}pause(){}}
vm.runInNewContext(source,{window:win,document:{getElementById:()=>canvas,querySelector:()=>({})},Image:Img,Audio:Aud,console,requestAnimationFrame:noop});
const g=win.__a42;
for(const dir of ['run_left','run_right','forward','backward']){
 const frames=g.frames(dir);
 assert.strictEqual(new Set(frames.map(x=>x.bounds.join(','))).size,8,`${dir} should have eight frame coordinates`);
 for(const fr of frames)assert(fs.existsSync(path.join(root,fr.src)),'Missing strip: '+fr.src);
 assert.strictEqual(new Set(frames.map(x=>x.src)).size,1,'one sheet per direction');
}
assert(g.stop().includes('ready_back'));
assert(g.afterShot().includes('forehand_back_prepare'));
console.log('A4_2_GAIT_8_PER_DIRECTION_OK, NO_STEPS_WHILE_IDLE_OK, HIT_ANIMATION_PRESERVED_OK');

// A4: deterministic smoke checks for valid lateral 50/50 logic and visual states.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
function create(choice){
 const src=fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\}\)\(\);\s*$/,`window.__a4Test={
  runLateral(){phase='rally';human.x=3.9;human.z=3.1;human.pose=0;human.cool=0;hCool=0;ball=makeBall(4.1,3.25,1.0,0,0,0,1);ball.bounces=1;const ok=playHit(0,'glass',.69,true,'right');return {ok,mode:lastLateralMode,power:lateralPower,normal:lateralNormal,banner:powerBannerT,ball:{vx:ball.vx,vz:ball.vz}}},
  runRear(){phase='rally';human.x=0;human.z=2.4;human.pose=0;human.cool=0;hCool=0;ball=makeBall(0.1,2.2,1.0,0,0,0,1);ball.bounces=1;const ok=playHit(0,'glass',.69,true,'rear');return {ok,mode:lastLateralMode,power:lateralPower,normal:lateralNormal,vx:ball.vx,vz:ball.vz,vh:ball.vh}},
  yellowFrames(){partner.motion='forehand';partner.pose=.42;partner.frameT=.01;const a=selectYellowSprite(partner)?.src;partner.frameT=.2;partner.pose=.22;const b=selectYellowSprite(partner)?.src;partner.frameT=.37;partner.pose=.05;const c=selectYellowSprite(partner)?.src;return [a,b,c]},
  yellowRun(){partner.pose=0;partner.moving=true;partner.motion='run_left';partner.visualFacing='run_left';partner.stridePhase=0;const a=selectYellowSprite(partner)?.bounds.join(',');partner.stridePhase=.25;const b=selectYellowSprite(partner)?.bounds.join(',');return[a,b]},
  counters(){return {lateralPower,lateralNormal,showShotStats,powerBannerT}},
  f8(){down({code:'F8',repeat:false,preventDefault(){}});return showShotStats}
};})();`);
 const noop=()=>{},ctx=new Proxy({},{get(o,k){if(k==='measureText')return()=>({width:120});if(k==='createLinearGradient')return()=>({addColorStop:noop});return o[k]??noop;},set(o,k,v){o[k]=v;return true}});
 const canvas={getContext:()=>ctx,addEventListener:noop,getBoundingClientRect:()=>({width:1672,height:941}),focus:noop};
 const win={PADEL_ASSETS:{human:{},robot:{}},PADEL_YELLOW:JSON.parse(fs.readFileSync(path.join(root,'yellow.js'),'utf8').split('=',2)[1].replace(/;\s*$/,'')),PADEL_RECORDINGS:{},addEventListener:noop};
 class Img{constructor(){this.naturalWidth=512;this.complete=true;}set src(u){this.onload?.()}}
 class Aud{constructor(){this.paused=true;}play(){return Promise.resolve();}pause(){this.paused=true;}}
 const MathChoice=Object.create(Math);MathChoice.random=()=>choice;
 vm.runInNewContext(src,{window:win,document:{getElementById:id=>id==='game'?canvas:{textContent:''},querySelector:()=>({})},Image:Img,Audio:Aud,console,requestAnimationFrame:noop,Math:MathChoice});
 return win.__a4Test;
}
const special=create(.2),ordinary=create(.8);
const a=special.runLateral(),b=ordinary.runLateral();
assert(a.ok&&b.ok);assert.strictEqual(a.mode,'POWER SHOT');assert.strictEqual(b.mode,'NORMAL');
assert.strictEqual(a.power,1);assert.strictEqual(b.normal,1);assert(a.banner>1);
assert(Math.abs(a.ball.vx)>Math.abs(b.ball.vx));
assert(special.f8());assert.strictEqual(special.counters().showShotStats,true);
const r=create(.2).runRear();assert(r.ok&&r.power===0&&r.normal===0);
const [prep,contact,follow]=create(.2).yellowFrames();assert(prep.includes('prepare')&&contact.includes('contact')&&follow.includes('followthrough'),[prep,contact,follow]);
const [runA,runB]=create(.2).yellowRun();assert.notStrictEqual(runA,runB,'A4.2 should advance gait phase instead of sliding on fixed pose');
console.log('A4_LATERAL_NORMAL_AND_SPECIAL_OK, A4_VALID_SHOT_ONLY_OK, A4_F8_OK, A4_YELLOW_3_STAGE_STROKES_OK, A4_2_YELLOW_GAIT_OK');

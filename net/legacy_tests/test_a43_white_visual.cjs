// A4.3 focused regression: same physical coordinates at each tempo, stable
// torso on rapid diagonal changes and no animation frame drop.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..');
const original=path.join(root,'../PADEL_RALLY_A4_2_AMARILLO_PASOS/game.js');
const fresh=path.join(root,'game.js');
const common=(pathSrc)=>fs.readFileSync(pathSrc,'utf8').replace(/\}\)\(\);\s*$/, `window.__whiteTest={
  setTempo(i){tempoIndex=i;},
  physics(){return {x:human.x,z:human.z,vx:human.vx,vz:human.vz,stridePhase:human.stridePhase,boost}},
  visual(){return {face:human.visualFacing,pending:human.visualPending,blend:human.visualBlendT,sprite:selectHumanSprite()?.src}},
  ready(){newMatch()},
  setMoving(x,z){human.vx=x;human.vz=z;human.moving=true;human.pose=0;stabilizeWhiteFacing?.(.017);},
 };})();`);
function run(file){
 const e={},queue=[],noop=()=>{};
 const ctx=new Proxy({},{get(o,k){if(k==='measureText')return()=>({width:80});if(k==='createLinearGradient')return()=>({addColorStop:noop});return o[k]??noop;},set(o,k,v){o[k]=v;return true}});
 const canvas={getContext:()=>ctx,addEventListener:()=>{},getBoundingClientRect:()=>({left:0,top:0,width:1672,height:941}),focus:noop};
 class Img{constructor(){this.naturalWidth=512;this.complete=true;this.width=512;this.height=512;}set src(v){this.onload?.()}}
 class Aud{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){}}
 const win={PADEL_ASSETS:JSON.parse(fs.readFileSync(path.join(path.dirname(file),'assets.js'),'utf8').split('=',2)[1].replace(/;\s*$/,'')),PADEL_YELLOW:{},PADEL_RECORDINGS:{},addEventListener:(key,fn)=>e[key]=fn};
 const math=Object.create(Math);math.random=()=>.375; // identical for both versions
 vm.runInNewContext(common(file),{window:win,document:{getElementById:()=>canvas,querySelector:noop},Image:Img,Audio:Aud,requestAnimationFrame:fn=>queue.push(fn),console,performance:{now:()=>0},Math:math},{filename:path.basename(file)});
 let ms=0;
 return {test:win.__whiteTest,key(code,down=true){e[down?'keydown':'keyup']?.({code,repeat:false,preventDefault:noop})},frame(n=1){for(let i=0;i<n;i++){const fn=queue.shift();if(!fn)throw Error('missing requestAnimationFrame');ms+=16.667;fn(ms)}}};
}
for(let tempo=0;tempo<3;tempo++){
 const a=run(original),b=run(fresh);
 a.frame(4);b.frame(4);
 a.test.setTempo(tempo);b.test.setTempo(tempo);
 a.test.ready();b.test.ready();
 const step=(input,frames)=>{
  if(input){a.key(input);b.key(input)}
  for(let k=0;k<frames;k++){
   a.frame();b.frame();
   const aa=a.test.physics(),bb=b.test.physics();
   for(const f of ['x','z','vx','vz','boost','stridePhase'])assert(Math.abs(aa[f]-bb[f])<1e-8,`physical regression at tempo ${tempo}, ${f}: ${aa[f]}, ${bb[f]}`);
  }
 };
 step('ArrowRight',50);a.key('ArrowRight',false);b.key('ArrowRight',false);
 step('ArrowUp',24);step('ArrowLeft',12);a.key('ArrowUp',false);b.key('ArrowUp',false);
 step(null,50);a.key('ArrowLeft',false);b.key('ArrowLeft',false);
 step('ShiftLeft',10);a.key('ShiftLeft',false);b.key('ShiftLeft',false);
 step(null,20);
}
// Quick transient changes should not instantly snap white from left to right.
const b=run(fresh);b.frame(3);b.test.ready();b.key('ArrowRight');b.frame(30);
const start=b.test.visual();assert(start.face==='run_right','white should face right');
b.key('ArrowRight',false);b.key('ArrowLeft');b.frame(1);
const afterOne=b.test.visual();assert(afterOne.face==='run_right','white should not flip on a single velocity frame');
b.frame(30);assert(b.test.visual().face==='run_left','white should eventually face left');
assert(b.test.visual().sprite.includes('run_left'),'wrong run direction sprite');
const asset=JSON.parse(fs.readFileSync(path.join(root,'assets.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
for(const [key,frames] of Object.entries(asset.human))for(const it of frames){assert(it.anchorX>.35&&it.anchorX<.65,`anchor missing ${key}`);assert(fs.existsSync(path.join(root,it.src)),it.src)}
console.log('A43_WHITE_DIRECTION_HYSTERESIS_OK, WHITE_SPRITES_ANCHORED_58_OK, 3_TEMPOS_SAME_WORLD_COORDINATES_AND_SPEED_OK');

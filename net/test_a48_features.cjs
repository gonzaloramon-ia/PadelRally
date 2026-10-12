const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),noop=()=>{};
function assets(n){return JSON.parse(fs.readFileSync(path.join(root,n),'utf8').split('=',2)[1].replace(/;\s*$/,''));}
function load(file){
 const listeners={};const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?()=>({width:60}):k==='createLinearGradient'?()=>({addColorStop:noop}):o[k]===undefined?noop:o[k],set:(o,k,v)=>{o[k]=v;return true}});
 const canvas={getContext:()=>ctx,addEventListener:(k,v)=>listeners[k]=v,focus:noop,getBoundingClientRect:()=>({left:0,top:0,width:1672,height:941})};
 class Image{constructor(){this.complete=true;this.naturalWidth=512;this.width=512;this.height=512}set src(v){this._src=v;this.onload?.()}}
 class Audio{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){}}
 const w={PADEL_ASSETS:assets('assets.js'),PADEL_YELLOW:assets('yellow.js'),PADEL_A44_SPRITES:assets('a44-sprites.js'),PADEL_A44_ENABLED:true,PADEL_A45_SPRITES:assets('a45-sprites.js'),PADEL_A45_ENABLED:true,PADEL_A48_SPRITES:assets('a48-sprites.js'),PADEL_A48_ENABLED:true,PADEL_RECORDINGS:{},addEventListener:(k,v)=>listeners[k]=v};
 const rng=Object.create(Math);rng.random=Math.random;
 const txt=fs.readFileSync(file,'utf8').replace(/\}\)\(\);\s*$/,`window.__testA48={
  start(){newMatch()},
  move(dx,dz,times=30){phase='serveReady';keys.clear();if(dx>0)keys.add('ArrowRight');if(dx<0)keys.add('ArrowLeft');if(dz>0)keys.add('ArrowUp');if(dz<0)keys.add('ArrowDown');human.x=0;human.z=4.5;human.vx=0;human.vz=0;human.visualFacing='idle';human.motion='idle';human.pose=0;human.stridePhase=0;for(let i=0;i<times;i++)stepHuman(.016);return {facing:human.visualFacing,sprite:selectHumanSprite()?.src,step:human.stridePhase}},
  charge(){phase='rally';ball=makeBall(human.x+.2,human.z+.2,1.8,0,-4,0,1);ball.bounces=1;charging={shot:'smash',started:clock};human.pose=0;human.motion='idle';human.jumpT=0;return selectHumanSprite()?.src},
  bank(route){phase='rally';charging=null;human.pose=0;human.jumpT=0;human.cool=0;hCool=0;human.z=2.5;ball=makeBall(human.x+.1,human.z+.2,1.2,0,-5,0,1);ball.bounces=1;let ok=playHit(0,'glass',.69,true,route);return {ok,sprite:selectHumanSprite()?.src,ball:ball&&{vx:ball.vx,vz:ball.vz,vh:ball.vh}}},
  smash(){phase='rally';charging=null;human.cool=0;hCool=0;human.pose=0;human.jumpT=0;ball=makeBall(human.x+.2,human.z+.3,1.85,0,-2,0,1);ball.bounces=1;const ok=playHit(0,'smash',.72);return {ok,sprite:selectHumanSprite()?.src,ball:ball&&{vx:ball.vx,vz:ball.vz,vh:ball.vh}}},
  tick(dt){stepHuman(dt);return selectHumanSprite()?.src},
  aim(n){let white=0,yellow=0;for(let i=0;i<n;i++){target(1,'forehand',{dx:0,dz:0});if(lastRobotTarget==='P1')white++;else yellow++;}return {white,yellow}}
 };})();`);
 vm.runInNewContext(txt,{window:w,document:{getElementById:k=>k==='game'?canvas:{textContent:''}},Image,Audio,Math:rng,console,requestAnimationFrame:noop,performance:{now:()=>0}});
 return w.__testA48;
}
const api=load(path.join(root,'game.js'));api.start();
for(const [dx,dz,suffix] of [[1,1,'diag_right'],[-1,1,'diag_left'],[0,1,'up'],[0,-1,'down']]){
 const {facing,sprite,step}=api.move(dx,dz);
 assert(sprite.includes(`white_${suffix}_`),`${suffix}: ${JSON.stringify({facing,sprite,step})}`);
}
assert(!api.charge().includes('white_smash_prepare'),'smash shown while merely holding space');
assert(api.bank('left').sprite.includes('backhand'),'A must have court-facing lateral animation');
assert(api.bank('right').sprite.includes('forehand'),'D must have court-facing lateral animation');
assert(api.bank('rear').sprite.includes('glass'),'S must retain rear contra-pared animation');
const smash=api.smash();assert(smash.ok&&smash.sprite.includes('white_smash_prepare'),'smash must prepare only on impact');
assert(api.tick(.12).includes('white_smash_strike'),'smash strike frame missing');
assert(api.tick(.27).includes('white_smash_recover'),'smash recover frame missing');
const tally=api.aim(10000),pct=tally.white/(tally.white+tally.yellow);assert(pct>.53&&pct<.57,JSON.stringify({tally,pct}));
for(const [seq,n] of [['white_diag_right',6],['white_diag_left',5],['white_up',7],['white_down',7]]){
 const arr=assets('a48-sprites.js')[seq];assert.equal(arr.length,n,`${seq} length`);
 for(const f of arr){assert(fs.existsSync(path.join(root,f.src)),'missing sprite '+f.src);assert(f.anchorX>0&&f.anchorX<1,'invalid anchor '+f.src);}
}
console.log('A48_OK: DIAGONAL_RIGHT_6, DIAGONAL_LEFT_5, UP_7, DOWN_7, STABLE_SMASH_CHARGE, SMASH_JUMP_SEQUENCE, A_D_SIDE_POSES, S_REAR_POSE, ROBOTS_55_45, FILES_COMPLETE');

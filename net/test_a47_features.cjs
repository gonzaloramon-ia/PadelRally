const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const noop=()=>{};
function launch(file){
 const listeners={},frames=[];let tm=0,draws=0;
 const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?()=>({width:60}):k==='createLinearGradient'?()=>({addColorStop:noop}):k==='drawImage'?()=>{draws++}:o[k]===undefined?noop:o[k],set:(o,k,v)=>{o[k]=v;return true}});
 const canvas={getContext:()=>ctx,addEventListener:(k,v)=>listeners['canvas:'+k]=v,focus:noop,getBoundingClientRect:()=>({left:0,top:0,width:1672,height:941})};
 const status={textContent:''};
 class Image{constructor(){this.complete=true;this.naturalWidth=512;this.width=512;this.height=512}set src(v){this._src=v;this.onload?.()}}
 class Audio{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){this.paused=true}}
 const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').split('=',2)[1].replace(/;\s*$/,''));
 const w={PADEL_ASSETS:read('assets.js'),PADEL_YELLOW:read('yellow.js'),PADEL_A44_SPRITES:read('a44-sprites.js'),PADEL_A44_ENABLED:true,PADEL_A45_SPRITES:read('a45-sprites.js'),PADEL_A45_ENABLED:true,PADEL_RECORDINGS:{},addEventListener:(k,v)=>listeners[k]=v};
 const rng=Object.create(Math);rng.random=()=>.41;
 const s=fs.readFileSync(file,'utf8').replace(/\}\)\(\);\s*$/,
 `window.__testA47={
 start(){newMatch()},move(dt,dx,dz){phase='serveReady';keys.clear();if(dx<0)keys.add('ArrowLeft');if(dx>0)keys.add('ArrowRight');if(dz>0)keys.add('ArrowUp');if(dz<0)keys.add('ArrowDown');stepHuman(dt)},
 stop(dt){keys.clear();stepHuman(dt)},
 info(){return {phase,actorX:human.x,actualXVelocity:human.vx,step:human.stridePhase,facing:human.visualFacing,exit:human.visualExitT,blend:human.visualBlendT,sprite:selectHumanSprite()?.src||''}},
 forceSmash(){phase='rally';human.cool=0;hCool=0;ball=makeBall(human.x+.2,human.z+.25,1.85,0,-2,0,1);ball.bounces=1;ball.serveFlight=false;let ok=playHit(0,'smash',.72);return {ok,jump:human.jumpT,duration:human.jumpDuration,pose:human.pose,sprite:selectHumanSprite()?.src,ball:ball&&{...ball}}},
 forceYellowSmash(){phase='rally';partner.cool=0;partner.pose=0;ball=makeBall(partner.x+.2,partner.z+.25,1.85,0,-2,0,1);ball.bounces=1;ball.serveFlight=false;let ok=playHit(0,'smash',.72,false,'rear',partner);return {ok,jump:partner.jumpT,duration:partner.jumpDuration}},
 jumpTick(dt){stepHuman(dt)},
 yellowTick(dt){partner.pose=Math.max(0,partner.pose-dt);partner.jumpT=Math.max(0,partner.jumpT-dt)},
 whiteSprite(){return selectHumanSprite()?.src||''},
 actor(){return {jump:human.jumpT,exit:human.visualExitT}},
 setBall(targetX){phase='rally';ball=makeBall(targetX,13,1,0,-6,0,1);ball.bounces=1;ball.serveFlight=false;nearChaseBall=null;nearChaseOwner=null;nearChaseLockT=0},
 chase(dt){clock+=dt;stepDoublesAI(dt);return {owner:nearChaseOwner?.id,swaps:nearChaseSwitches}},
 switchForecast(x){ball.x=x},
 setPos(hx,hz,yx,yz){human.x=hx;human.z=hz;partner.x=yx;partner.z=yz;},
 testResetOnHit(){human.cool=0;hCool=0;phase='rally';ball=makeBall(human.x+.2,human.z+.3,1.3,0,-5,0,1);ball.bounces=1;nearChaseBall=ball;nearChaseOwner=partner;return {ok:playHit(0,'forehand',.5),owner:nearChaseOwner,ptr:nearChaseBall}},
 renderOnce(){render()}
 };})();`);
 vm.runInNewContext(s,{window:w,document:{getElementById:k=>k==='game'?canvas:status,querySelector:()=>canvas},Image,Audio,Math:rng,console,requestAnimationFrame:f=>frames.push(f),performance:{now:()=>0}});
 return {api:w.__testA47,debug:w.__padelDebug,draws:()=>draws,key(code,down=true){listeners[down?'keydown':'keyup']?.({code,repeat:false,preventDefault:noop})}};
}
const a=launch(path.join(root,'game.js'));a.api.start();
// Foot cadence uses displacement only, not input duration while blocked.
a.api.setPos(4.55,2.35,-2.35,4.45);const before=a.api.info().step;
for(let i=0;i<18;i++)a.api.move(.016,1,0);
assert(Math.abs(a.api.info().step-before)<.001,'feet cycle while pressed into right wall');
a.api.setPos(0,2.35,-2.35,4.45);
for(let i=0;i<25;i++)a.api.move(.016,-1,0);
const walking=a.api.info();assert(walking.step>.3&&walking.facing==='run_left',walking);
for(let i=0;i<25;i++)a.api.stop(.016);
assert.equal(a.api.info().blend,0,'double-body crossfade still active');
// Contact anim must appear as strike, vertical jump must decay and never change physical ball.
const baseline=launch(path.join(root,'net/reference_a46_game.js'));
baseline.api.start();baseline.api.setPos(0,2.35,-2.35,4.45);
a.api.setPos(0,2.35,-2.35,4.45);
const j=a.api.forceSmash(),old=baseline.api.forceSmash();
assert(j.ok&&old.ok,'valid smash rejected');
assert(j.jump>.3,'jump did not start');
assert(j.sprite.includes('white_smash_prepare'),'smash preparation must begin only after contact '+j.sprite);
for(const key of ['x','z','h','vx','vz','vh','lastHit'])assert.equal(j.ball[key],old.ball[key],'ball physics changed: '+key);
a.api.jumpTick(.23);assert(a.api.actor().jump<j.jump,'jump did not advance');assert(a.api.whiteSprite().includes('white_smash_strike'),'smash did not reach airborne strike');
a.api.jumpTick(.16);assert(a.api.whiteSprite().includes('white_smash_recover'),'smash did not reach recovery');
a.api.jumpTick(.08);assert.equal(a.api.actor().jump,0,'jump does not land');
const y=a.api.forceYellowSmash();assert(y.ok&&y.jump>0,'yellow smash hop missing');
a.api.yellowTick(.5);assert.equal(a.debug().yellowJump,0,'yellow jump does not land');
const ch=launch(path.join(root,'game.js'));ch.api.start();ch.api.setPos(-2,4,2,4);ch.api.setBall(-2);
const own=ch.api.chase(.05).owner;assert(own==='P1',`white sector assigned to ${own}`);
ch.api.switchForecast(3.0);assert.equal(ch.api.chase(.02).owner,'P1','AI switched owner instantly');
const reset=ch.api.testResetOnHit();assert(reset.ok&&reset.ptr===null&&reset.owner===null,'return ownership not reset after shot');
a.api.renderOnce();assert(a.draws()>0,'render failed');
for(const f of ['white_smash_prepare.webp','white_smash_strike.webp','white_smash_recover.webp'])assert(fs.existsSync(path.join(root,'assets/a44',f)));
console.log('A47_OK: FOOTSTEP_GROUND_DISTANCE, STABLE_SPRITE_ORIENTATION, JUMP_STRIKE_RECOVERY, YELLOW_HOP, BALL_UNCHANGED, CHASER_LOCK_RESET, RENDER');

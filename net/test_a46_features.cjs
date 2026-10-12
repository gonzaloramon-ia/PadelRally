const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.resolve(__dirname,'..');
function launch(filename,seed=.17){
 const events={},queue=[],noop=()=>{};let mill=0;
 const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?()=>({width:40}):k==='createLinearGradient'?()=>({addColorStop:noop}):o[k]===undefined?noop:o[k],set:(o,k,v)=>{o[k]=v;return true}});
 const canvas={getContext:()=>ctx,addEventListener:(e,f)=>events['canvas:'+e]=f,focus:noop,getBoundingClientRect:()=>({left:0,top:0,width:1672,height:941})};
 const status={textContent:''};
 class Im{constructor(){this.naturalWidth=512;this.width=512;this.height=512;this.complete=true}set src(s){this._src=s;this.onload?.()}}
 class Aud{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){this.paused=true}}
 const math=Object.create(Math);math.random=Math.random;
 const assets=JSON.parse(fs.readFileSync(path.join(dir,'assets.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
 const yellow=JSON.parse(fs.readFileSync(path.join(dir,'yellow.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
 const a44=JSON.parse(fs.readFileSync(path.join(dir,'a44-sprites.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
 const a45=JSON.parse(fs.readFileSync(path.join(dir,'a45-sprites.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
 const window={PADEL_ASSETS:assets,PADEL_YELLOW:yellow,PADEL_A44_SPRITES:a44,PADEL_A44_ENABLED:true,PADEL_A45_SPRITES:a45,PADEL_A45_ENABLED:true,PADEL_RECORDINGS:{},addEventListener:(e,f)=>events[e]=f};
 const src=fs.readFileSync(filename,'utf8').replace(/\}\)\(\);\s*$/,`window.__testA46={
  prep(){phase='rally';server=0;nearServerMember=0;resetPositions();phase='rally';ball=makeBall(0,14,1.3,0,-6,0,1);ball.wallOK=true;},
  setTempo(t){tempoIndex=t;},
  positions(){return {hx:human.x,hz:human.z,px:partner.x,pz:partner.z,lane:typeof partnerLane==='undefined'?null:partnerLane};},
  setPos(hx,hz,px,pz){human.x=hx;human.z=hz;partner.x=px;partner.z=pz;},
  separate(){if(typeof separateTeammates==='function')separateTeammates()},
  nearChaser(x,z,t){return typeof chooseNearChaser==='function'?chooseNearChaser(x,z,t).id:null;},
  aimRobot(n){let white=0,yellow=0;for(let i=0;i<n;i++){target(1,'forehand',{dx:0,dz:0});if(lastRobotTarget==='P1')white++;else yellow++;}return {white,yellow};},
  serveSprite(){return selectHumanSprite()?.src||'';},
  ballState(){return ball?{x:ball.x,z:ball.z,h:ball.h,vx:ball.vx,vz:ball.vz,vh:ball.vh}:null;},
  speedTest(dt){phase='rally';ball=makeBall(0,14,1.6,0,-6,0,1);ball.wallOK=true;updateBall(dt);return ball?.z;},
  updatePartnerLane(){if(typeof updatePartnerLane==='function')updatePartnerLane()},
  humanSpeed(){return hypot(human.vx,human.vz)},
 };})();`);
 vm.runInNewContext(src,{window,document:{getElementById:id=>id==='game'?canvas:status,querySelector:()=>canvas},Image:Im,Audio:Aud,console,performance:{now:()=>0},Math:math,requestAnimationFrame:fn=>queue.push(fn)});
 return {test:window.__testA46,debug:window.__padelDebug,key(code,on=true){events[on?'keydown':'keyup']?.({code,repeat:false,preventDefault:noop})},frames(n=1){for(let i=0;i<n;i++){const f=queue.shift();if(!f)throw Error('no RAF');mill+=16.667;f(mill)}}};
}
const v=launch(path.join(dir,'game.js'));v.frames(5);v.key('Enter');v.frames(1);
let stats=v.test.aimRobot(20000);const pct=stats.white/(stats.white+stats.yellow);assert(pct>.53&&pct<.57,JSON.stringify({stats,pct}));
v.test.setPos(-2,4,2,4);v.test.updatePartnerLane();assert.equal(v.test.nearChaser(-2,4,.5),'P1');assert.equal(v.test.nearChaser(2,4,.5),'ALIADO');
v.test.setPos(1,4,1,4);v.test.separate();let p=v.test.positions();assert(Math.hypot(p.px-p.hx,p.pz-p.hz)>=.855,'body overlap '+JSON.stringify(p));
v.test.setPos(-2.5,2.5,2.5,4);v.test.updatePartnerLane();assert.equal(v.test.positions().lane,1);
v.test.setPos(2.2,2.5,-2.5,4);v.test.updatePartnerLane();assert.equal(v.test.positions().lane,-1);
const a=launch(path.join(dir,'game.js'));a.frames(5);a.key('Enter');a.frames(1);assert(a.test.serveSprite().includes('serve_prepare'),'missing serve stance');a.key('ArrowLeft');a.frames(30);assert(!a.test.serveSprite().includes('serve_prepare'),'white still in stationary stance while moving');a.key('ArrowLeft',false);
function runMove(tempo){const g=launch(path.join(dir,'game.js'));g.frames(5);g.key('Enter');g.test.setTempo(tempo);g.key('ArrowLeft');g.frames(35);return g.test.positions().hx;}
const x2=runMove(2),x3=runMove(3),x4=runMove(4);assert(x4<x3&&x3<x2&&Math.abs(x2-x4)<.55,`player speed progression incorrect ${x2},${x3},${x4}`);
// Faster modes should preserve the velocity coefficients and take less real time to travel.
function runBall(tempo){const g=launch(path.join(dir,'game.js'));g.frames(5);g.key('Enter');g.test.setTempo(tempo);g.test.prep();g.frames(7);return g.test.ballState();}
const b2=runBall(2),b3=runBall(3),b4=runBall(4);
assert(b2&&b3&&b4, 'flight disappeared');assert(b3.z<b2.z&&b4.z<b3.z,JSON.stringify({b2,b3,b4}));
assert(Math.abs(b2.vz-b3.vz)<1e-9&&Math.abs(b4.vz-b3.vz)<1e-9,'velocity formula changed');
console.log('A46_OK: 55_45_TARGETING, ASSIGNED_LANES, HUMAN_PRIORITY, BODY_COLLISION, SERVE_GAIT, PLAYER_SPEED_GRADUAL, BALL_SPEED_FASTER');

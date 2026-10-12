// Headless feature tests. Does not replace visual/browser QA.
const fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(__dirname+'/../game.js','utf8').replace(/\}\)\(\);\s*$/,`window.__a3={
 prepareRobotServe(){server=1;nearServerMember=0;pointInGame=0;phase='serveReady';resetPositions();startServe(1,.52,{dx:0,dz:0});finishServe();return {receiver:ball.serveReceiver,human:human.x,partner:partner.x};},
 designatedServeAI(){phase='rally';ball=makeBall(partner.x,partner.z,1,0,0,0,1);ball.bounces=1;ball.serveReceiver=human.id;partner.cool=0;partner.pose=0;human.x=4.4;human.z=8;stepDoublesAI(.016);return {lastHit:ball.lastHit,actor:ball.lastActor||null};},
 volleyServe(){phase='rally';ball=makeBall(human.x,human.z,1,0,0,0,1);ball.serveFlight=true;ball.bounces=0;hCool=0;human.cool=0;return contactPossible(0,'forehand',human);},
 drop(){phase='rally';human.x=0;human.z=7;hCool=0;human.cool=0;ball=makeBall(.1,7.3,1.0,0,0,0,1);ball.bounces=1;const ok=playHit(0,'drop',.38);let t=(10-ball.z)/ball.vz;const netH=ball.h+ball.vh*t-0.5*G*t*t;return {ok,direction:ball.vz,netH,bank:ball.bank};},
 glass(){phase='rally';human.x=4.5;human.z=8.8;partner.x=-3;partner.z=2;partner.cool=0;partner.pose=0;ball=makeBall(-3.1,1.9,1.1,0,0,0,1);ball.bounces=1;ball.serveReceiver=null;stepDoublesAI(.016);return {route:ball.bankRoute,actor:ball.lastActor,allyAttempted,position:[partner.x,partner.z],h:ball.h,phase,served:ball.lastHit,hi:human.x};},
 record(){phase='rally';ball=makeBall(0,5,1,0,0,0,1);rally=23;endPoint(0,'PUNTO');return longestRally;}
};})();`);
const noop=()=>{};
const ctx=new Proxy({}, {get(o,key){if(key==='measureText')return()=>({width:90});if(key==='createLinearGradient')return()=>({addColorStop:noop});return o[key]??noop;},set(o,k,v){o[k]=v;return true;}});
const canvas={getContext:()=>ctx,addEventListener:noop,getBoundingClientRect:()=>({width:1672,height:941}),focus:noop};
const window={PADEL_ASSETS:{human:{},robot:{}},PADEL_YELLOW:{},PADEL_RECORDINGS:{},addEventListener:noop};
class FakeImage{constructor(){this.complete=false;this.naturalWidth=1;}set src(v){this.complete=true;this.onload?.();}}
class FakeAudio{constructor(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
// Random fixed at 0.1 ensures AI attempts a bank when conditions are met, without altering game code.
const rng=Object.create(Math);rng.random=()=>0.2;
vm.runInNewContext(source,{window,document:{getElementById:id=>id==='game'?canvas:{textContent:''},querySelector:()=>({})},Image:FakeImage,Audio:FakeAudio,requestAnimationFrame:noop,console,performance:{now:()=>0},Math:rng});
const a=window.__a3;let serve=a.prepareRobotServe();if(serve.receiver!=='P1')throw Error('serve not reserved for white '+JSON.stringify(serve));
let noPoach=a.designatedServeAI();if(noPoach.lastHit!==1)throw Error('yellow stole white serve '+JSON.stringify(noPoach));
if(a.volleyServe())throw Error('service volley allowed');
let drop=a.drop();if(!drop.ok||drop.direction<=0||drop.bank||drop.netH<.9)throw Error('invalid drop trajectory '+JSON.stringify(drop));
let glass=a.glass();if(glass.route!=='rear'||glass.actor!=='ALIADO')throw Error('yellow did not use rear bank '+JSON.stringify(glass));
if(a.record()!==23)throw Error('rally high score failed');
console.log('A3_SERVE_RECEIVER_OK, NO_YELLOW_POACH_OK, NO_SERVICE_VOLLEY_OK, DROP_TRAJECTORY_OK, AI_GLASS_OK, RALLY_RECORD_OK');

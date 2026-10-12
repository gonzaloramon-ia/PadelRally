/* PADEL RALLY — ONLINE COOP ALPHA. Beta 09 cloned intact; authoritative host, remote yellow player. */
(()=>{'use strict';
const W=1672,H=941,G=9.81, canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),status=document.getElementById('status');
const assets=window.PADEL_ASSETS||{human:{},robot:{}};
const yellow=window.PADEL_YELLOW||{};
// A4.4: optional VISUAL assets only. No movement, ball, physics or hitbox changes.
const a44=window.PADEL_A44_SPRITES||{};
const a44Enabled=window.PADEL_A44_ENABLED!==false;
const a44Yellow=window.PADEL_A44_YELLOW===true;
const a45=window.PADEL_A45_SPRITES||{};
const a45Enabled=window.PADEL_A45_ENABLED===true;
const a45YellowOld=window.PADEL_A45_YELLOW_OLD===true;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),random=(a,b)=>a+(b-a)*Math.random(),hypot=Math.hypot;
let phase='loading',paused=false,help=false,clock=0,last=0,server=0,scoreP=[0,0],games=[0,0],rally=0,pointDelay=0;
let ball=null,serveT=0,serveBounceT=0,queued=null,charging=null,steer=null,alert='',alertT=0,contactMsgT=0;
let hCool=0,rCool=0,robotServeTimer=0,robotThinking=0,robotCharge=0,boost=100,robotStamina=100,serveNumber=0,serveFaults=0;
let nextShotInfo='',lastBank='',pointInGame=0;
let nearServerMember=0,farServerMember=0,allyAttempted=false,allyServeTimer=0;
let teamHits=[0,0],lastInterception='';
let longestRally=0;
let lastLateralMode='',lateralNormal=0,lateralPower=0,powerBannerT=0,showShotStats=false;
const heldGlass=new Set();let glassComboUsed=false;
// Online: host owns all physics, rules and two rival AIs. Guest only sends input
// and renders host snapshots. Offline uses the A4.6 team-aware partner AI.
let netMode='offline',remoteActive=false,guestSnapshotSeq=-1,netHostPower=0,netRemotePower=0;
let remoteButtons={},remoteCharge=null,remoteQueued=null,remoteGlassCombo=false;
const remoteGlass=new Set();let remoteLastAim={dx:0,dz:0};
let audioEventSeq=0,lastRemoteAudioEvent=0;const audioEvents=[];

// Match options: game tempo changes the simulation clock; AI difficulty changes its skill.
// A4.6: new modes speed up only ball travel relative to RÁPIDO.
// Player movement, stamina and animation clock remain at 1.32 in both modes.
const tempos=[{name:'LENTO',scale:.81},{name:'NORMAL',scale:1.05},{name:'RÁPIDO',scale:1.32},
 {name:'MUY RÁPIDO',scale:1.32,ballScale:1.452},{name:'EXTREMO',scale:1.32,ballScale:1.584}];
const skillLevels=[
 {name:'FÁCIL',reaction:.50,speed:2.80,reach:1.02,miss:.40,aimError:1.30,low:.32,high:.63},
 {name:'MEDIO',reaction:.34,speed:3.58,reach:1.32,miss:.23,aimError:.80,low:.38,high:.72},
 {name:'DIFÍCIL',reaction:.20,speed:4.45,reach:1.63,miss:.10,aimError:.38,low:.44,high:.84},
 // Expert: harder mainly through earlier recognition and tactical shot placement.
 // Still has one attempt per incoming ball and can miss legitimately.
 {name:'EXPERTO',reaction:.155,speed:4.98,reach:1.69,miss:.06,aimError:.265,low:.49,high:.89}
];
let tempoIndex=1,skillIndex=1,ambientOn=true,sfxOn=true,robotAttempted=false;
// Near-team court assignments and per-hit robot target telemetry.
let partnerLane=1,lastRobotTarget='',robotAimWhite=0,robotAimYellow=0;
// Real field recordings from the user's padel match. One constant room-tone loop,
// with independent short effects triggered ONLY by physics/animation events.
const recordings=window.PADEL_RECORDINGS||{};
const soundBank={};let audioUnlocked=false,ambientTrack=null,lastStepAt=-5;
function ensureAudio(){
 audioUnlocked=true;
 if(!ambientTrack&&recordings.ambiente){
  ambientTrack=new Audio(recordings.ambiente);ambientTrack.loop=true;ambientTrack.preload='auto';ambientTrack.volume=.31;
 }
 resumeAmbience();
}
function resumeAmbience(){if(!audioUnlocked||!ambientTrack)return;
 if(ambientOn&&phase!=='loading'&&phase!=='intro'){
  ambientTrack.volume=paused?.11:.31;
  if(ambientTrack.paused)ambientTrack.play().catch(()=>{});
 }else if(!ambientTrack.paused)ambientTrack.pause();
}
// Only user-approved field recordings: variable selection by stroke strength and court side.
function fx(id,{who=0,power=.55,shot='forehand'}={}){
 if(netMode==='host'){
  audioEvents.push({id:++audioEventSeq,kind:id,who,power,shot});
  if(audioEvents.length>16)audioEvents.shift();
 }
 if(!sfxOn||!audioUnlocked)return;
 let group=id;
 if(id==='pala')group=who===1?'pala_robot':shot==='smash'||power>.78?'pala_fuerte':power<.43||shot==='lob'?'pala_suave':'pala_media';
 else if(id==='vidrio')group=who===1?'vidrio_lejos':'vidrio_cerca';
 else if(id==='pique')group='pique';
 else if(id==='reaccion')group='grito';
 const files=recordings[group], paths=Array.isArray(files)?files:files?[files]:[];
 if(!paths.length)return; // no fake sound for footsteps, net, errors, etc.
 const path=paths[Math.floor(Math.random()*paths.length)];
 const pool=soundBank[path]||(soundBank[path]=[]);
 let a=pool.find(v=>v.paused||v.ended);
 if(!a){a=new Audio(path);a.preload='auto';pool.push(a);if(pool.length>5)pool.shift().pause();}
 try{a.currentTime=0;}catch(_){}
 const isFar=who===1,base=group==='grito'?.26:group==='pique'?.56:group.startsWith('vidrio')?.63:.67;
 a.volume=clamp(base*(isFar?.68:1)*(0.85+power*.2),0,1);
 a.play().catch(()=>{});
}
function musicLoop(){resumeAmbience();}
const keys=new Set(),lastArrow={dx:0,dz:0,t:-10};
const human={id:'P1',team:0,x:-2.0,z:2.35,motion:'idle',previous:'idle',frameT:0,pose:0,moving:false,prevX:0,prevZ:0,vx:0,vz:0,cool:0,stridePhase:0,recoverT:0,savePoseT:0,saveFrame:0,visualFacing:'idle',visualPending:'',visualPendingT:0,visualIdleT:0,visualBlendT:0,visualFrom:null};
const partner={id:'ALIADO',team:0,x:2.0,z:4.0,motion:'idle',previous:'idle',frameT:0,pose:0,moving:false,dx:0,poseT:0,cool:0,stamina:100,thinking:0,charge:0,stridePhase:0,recoverT:0,splitStepT:0,splitArmed:true,visualSpeed:0,lean:0,visualFacing:'idle',visualPending:'',visualPendingT:0,visualIdleT:0};
const robot={id:'IA1',team:1,x:1.9,z:16.2,motion:'ready',frameT:0,pose:0,moving:false,dx:0,cool:0,thinking:0,charge:0,stamina:100};
const robot2={id:'IA2',team:1,x:-1.9,z:16.2,motion:'ready',frameT:0,pose:0,moving:false,dx:0,cool:0,thinking:0,charge:0,stamina:100};
const members=[[human,partner],[robot,robot2]];
function servingActor(who=server){return members[who][who===0?nearServerMember:farServerMember];}
function teammates(who){return members[who];}

const images={},errors=[];let requested=0,loaded=0;
function load(path){if(images[path])return images[path];const im=new Image();requested++;images[path]=im;im.onload=()=>{loaded++;if(phase==='loading'&&loaded+errors.length===requested){phase='intro';message('Recursos listos',2);}};im.onerror=()=>{errors.push(path);console.warn('Asset failed',path);if(phase==='loading'&&loaded+errors.length===requested)phase='intro';};im.src=path;return im;}
load('assets/court_clean.png');for(const a of Object.values(assets.human))for(const s of a)load(s.src);for(const path of Object.values(assets.robot))load(path);for(const v of Object.values(yellow))load(v.src);if(a44Enabled)for(const v of Object.values(a44))load(v.src);
if(a45Enabled)for(const seq of Object.values(a45))for(const v of seq)load(v.src);
function message(t,secs=1.1){alert=t;alertT=secs;status.textContent=t;}
const label={forehand:'DERECHA',backhand:'REVÉS',lob:'GLOBO',smash:'REMATE',glass:'CONTRAPARED',drop:'DEJADA'};
function Y(z){const v=[[0,811],[3,659],[10,487],[17,393],[20,353]];z=clamp(z,0,20);for(let i=1;i<v.length;i++)if(z<=v[i][0]){const f=(z-v[i-1][0])/(v[i][0]-v[i-1][0]);return v[i-1][1]+(v[i][1]-v[i-1][1])*f;}return 353;}
function halfWidth(z){const v=[[0,777],[3,619],[10,402],[17,272],[20,258]];z=clamp(z,0,20);for(let i=1;i<v.length;i++)if(z<=v[i][0]){const f=(z-v[i-1][0])/(v[i][0]-v[i-1][0]);return v[i-1][1]+(v[i][1]-v[i-1][1])*f;}return 258;}
function project(x,z,h=0){return{x:824+(x/5)*halfWidth(z),y:Y(z)-h*(82/(1+z*.075)),scale:1/(1+z*.075)};}
function resetPositions(){
 const side=pointInGame%2===0?1:-1;
 // The serving team rotates right/left each point. Both partners stay on their own half.
 for(const p of [human,partner,robot,robot2]){p.pose=0;p.frameT=0;p.moving=false;p.dx=0;p.cool=0;p.thinking=0;p.charge=0;p.motion=p.team===0?'idle':'ready';}
 const ns=servingActor(0),fs=servingActor(1);
 ns.x=server===0?side*2.25:side*2.15;ns.z=2.35;
 const nf=members[0].find(x=>x!==ns);nf.x=-side*2.3;nf.z=4.45;
 fs.x=-side*2.15;fs.z=17.8;
 const ff=members[1].find(x=>x!==fs);ff.x=side*2.1;ff.z=15.55;
 partnerLane=partner.x>=0?1:-1;
 human.vx=0;human.vz=0;human.stridePhase=0;human.a45WasMoving=false;human.recoverT=0;human.savePoseT=0;human.saveFrame=0;human.visualFacing='idle';human.visualPending='';human.visualPendingT=0;human.visualIdleT=0;human.visualBlendT=0;human.visualFrom=null;partner.stridePhase=0;partner.recoverT=0;partner.splitStepT=0;partner.splitArmed=true;partner.visualSpeed=0;partner.lean=0;partner.visualFacing='idle';partner.visualPending='';partner.visualPendingT=0;partner.visualIdleT=0;
 ball=null;queued=null;charging=null;steer=null;hCool=0;rCool=0;robotServeTimer=0;robotThinking=0;robotCharge=0;contactMsgT=0;robotAttempted=false;allyAttempted=false;allyServeTimer=0;
}
function newMatch(){robotAimWhite=0;robotAimYellow=0;lastRobotTarget='';ensureAudio();server=0;nearServerMember=0;farServerMember=0;pointInGame=0;scoreP=[0,0];games=[0,0];rally=0;longestRally=0;serveFaults=0;robotAttempted=false;allyAttempted=false;boost=100;robotStamina=100;paused=false;help=false;phase='serveReady';resetPositions();message('DOBLES · TU SAQUE · MANTENÉ X O Z Y SOLTÁ',2);resumeAmbience();}
function start(){ensureAudio();if(phase==='loading')return;if(phase==='intro'){newMatch();return;}help=false;paused=false;message('JUGANDO',.5);}
function pause(){if(phase==='loading'||phase==='intro')return;help=false;paused=!paused;resumeAmbience();message(paused?'PAUSA':'JUGANDO',.7);}
function commands(){if(phase==='intro'){newMatch();}help=!help;paused=help;resumeAmbience();message(help?'COMANDOS':'JUGANDO',.3);}
function score(i){const a=scoreP[i],b=scoreP[1-i];if(a<=3)return ['0','15','30','40'][a];return a>b?'A':'40';}
function endPoint(winner,reason){if(phase==='pointEnd')return;
const failedServe=ball?.serveFlight&&winner===1-ball.lastHit;
if(failedServe&&serveFaults===0){fx('error');serveFaults=1;phase='pointEnd';pointDelay=1.10;ball=null;queued=null;charging=null;steer=null;message('PRIMER SAQUE FALLIDO · SEGUNDO SAQUE',1.25);return;}
if(failedServe&&serveFaults===1)reason='DOBLE FALTA';
longestRally=Math.max(longestRally,rally);fx(reason==='RED'?'red':'punto');serveFaults=0;phase='pointEnd';pointDelay=1.45;ball=null;queued=null;charging=null;steer=null;pointInGame++;scoreP[winner]++;if(scoreP[winner]>=4&&scoreP[winner]-scoreP[1-winner]>=2){games[winner]++;scoreP=[0,0];pointInGame=0;server=1-server;if(server===0)nearServerMember=1-nearServerMember;else farServerMember=1-farServerMember;message((winner?'JUEGO IA':'JUEGO HUMANOS')+' · '+reason,1.8);}else message((winner?'PUNTO IA':'PUNTO HUMANO')+' · '+reason,1.5);}
function makeBall(x,z,h,vx=0,vz=0,vh=0,hit=0){return{x,z,h,vx,vz,vh,lastHit:hit,bounces:0,wallOK:false,wallCount:0,age:0,serveFlight:false,serveSide:0,bank:false,bankRoute:null,bankStage:0,trail:[],netCrossed:false,serveReceiver:null};}
function arrows(){return{dx:(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dz:(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0)};}
function aim(){let d=arrows();if(d.dx===0&&d.dz===0&&clock-lastArrow.t<.20)d={dx:lastArrow.dx,dz:lastArrow.dz};return d;}
function target(who,shot,aimDir){const near=who===0;
// Pick an actual intended receiver for each robot RETURN. 65/35 is a
// probability per shot, not a forced sequence; teammate interceptions are
// decided separately. Both robots share this policy (all skill settings).
const selected=near?null:(Math.random()<.65?human:partner);
if(selected){lastRobotTarget=selected.id;if(selected===human)robotAimWhite++;else robotAimYellow++;}
let x=near?aimDir.dx*3.55:clamp(selected.x+random(-1.08,1.08),-4.05,4.05);
let z=near?(aimDir.dz>0?18.0:aimDir.dz<0?12.5:15.5):random(2.5,7.6);
if(shot==='lob')z=near?(aimDir.dz<0?14.6:18.4):random(2.5,5.2);
if(shot==='smash')z=near?(aimDir.dz<0?12.2:16.4):random(1.8,5.0);
// Expert looks for uncovered court, but the shot can still be out or defended.
// This branch is exclusive to the new level; the original three are unchanged.
if(who===1&&skillIndex===3){
 // Retain advanced depth placement, but not the former aim override
 // that ignored the 65/35 target selection.
 x=clamp(selected.x+random(-1.22,1.22),-4.05,4.05);
 z=human.z>5.3?random(2.2,4.4):random(5.7,7.8);
 if(shot==='lob')z=random(1.9,3.5);
 if(shot==='smash')z=human.z>5.1?random(2.0,3.3):random(5.0,6.7);
}
return{x:clamp(x,-4.15,4.15),z:clamp(z,near?11.6:1.4,near?18.8:8.7)};}
function ballistic(b,landing,flight){b.vx=(landing.x-b.x)/flight;b.vz=(landing.z-b.z)/flight;b.vh=(0.04-b.h+0.5*G*flight*flight)/flight;}
function startServe(who,power,aimDir,visualShot='forehand'){const p=servingActor(who);if(who===0&&p.z>3){message('SAQUE DETRÁS DE LA LÍNEA',1);return false;}
if(who===1&&p.z<17){p.z=17.8;}
phase='serveDrop';serveT=0;serveBounceT=0;serveNumber++;const dir=who?-1:1,side=(pointInGame%2===0?1:-1)*(who?-1:1);
ball=makeBall(p.x+0.12,p.z+dir*.18,.85,0,0,-.12,who);ball.serveData={who,power,aim:aimDir,side,x:p.x,z:p.z,actor:p.id,visualShot:visualShot==='backhand'?'backhand':'forehand'};human.motion=who===0?'idle':human.motion;queued=null;
message('SAQUE · PIQUE Y GOLPE POR ABAJO',1.15);return true;}
function finishServe(){if(!ball||phase!=='serveDrop')return;const b=ball,d=b.serveData,who=d.who,dir=who?-1:1;
// Fixed release position: a serve cannot teleport when the player moves.
b.x=d.x;b.z=d.z+dir*.36;b.h=.55;
const shotX=clamp(-d.side*(2.4+(d.aim.dx===-d.side?.5:0)), -3.4,3.4);
const landing={x:shotX,z:who?5.45:14.55},flight=clamp(1.47-d.power*.26,1.15,1.48);
ballistic(b,landing,flight);
// On an opponent's serve, reserve the diagonal receiving court for its receiver.
// The AI teammate does not poach the designated player's serve.
b.serveReceiver=who===1?(Math.abs(human.x-landing.x)<=Math.abs(partner.x-landing.x)?human.id:partner.id):null;
b.serveFlight=true;b.serveSide=d.side;b.lastVisualServeShot=d.visualShot||'forehand';b.serveData=null;b.bounces=0;b.lastHit=who;b.wallOK=false;b.age=0;b.netCrossed=false;b.trail=[];
phase='rally';rally=1;robotAttempted=false;allyAttempted=false;
fx('pala',{who,power:d.power,shot:'forehand'});
const serverActor=members[who].find(p=>p.id===d.actor)||servingActor(who);
serverActor.motion='forehand';serverActor.pose=.42;serverActor.frameT=0;serverActor.cool=.35;
if(serverActor===human)hCool=.35; if(serverActor===robot)rCool=.35;

message('SAQUE EJECUTADO',.5);}
function contactPossible(who,shot,actor=null){if(!ball||phase!=='rally'||ball.lastHit===who)return false;const p=actor||(who?robot:human);
// A serve must first bounce in the correct service box: no volleying the serve.
if(ball.serveFlight&&ball.bounces===0)return false;
const dx=ball.x-p.x,dz=ball.z-p.z;const r=who?skillLevels[skillIndex].reach:1.88;
if(Math.abs(dx)>r||Math.abs(dz)>(who?skillLevels[skillIndex].reach:1.85)||ball.h<.13||ball.h>2.62||p.cool>0||(p===human?hCool:0)>0)return false;
if(shot==='smash'&&ball.h<1.32)return false;return true;}
function playHit(who,shot,power,bank=false,bankRoute='rear',actor=null){const p=actor||(who?robot:human);if(!contactPossible(who,shot,p))return false;const b=ball;
if(bank){
  const rear=bankRoute.startsWith('rear'),side=bankRoute==='left'||bankRoute==='right';
  const valid=who===0&&b.h<=1.85&&(rear?p.z<=5.3&&b.z<=5.75:side&&p.z<=7.7&&b.z<=8.0);
  if(!valid){message(rear?'ACERCATE AL VIDRIO TRASERO':'CONTRAPARED: POSICIÓN INCORRECTA',.85);return false;}
 }
const dx=b.x-p.x,dz=b.z-p.z,shotSide=shot==='forehand'?dx>=-.1:shot==='backhand'?dx<=.1:true;
const positioned=clamp(1-Math.max(0,hypot(dx,dz)-.5)*.17,.68,1),quality=(shotSide?1:.78)*positioned;
const powerC=clamp(power,.08,1),direction=who===0?(p===human?aim():remoteActive?remoteAim():{dx:robot.x+robot2.x>=0?-1:1,dz:1}):{dx:0,dz:0};
const landing=target(who,shot,direction);
 if(who||(p===partner&&!remoteActive)){const err=who?skillLevels[skillIndex].aimError:.56;landing.x+=random(-err,err);landing.z+=random(-err,err);}
// DEJADA: only effective from near the net. Very short, deliberately soft trajectory.
// Same collision/net physics as other strokes: it may hit the tape and fail.
if(shot==='drop'){
  const toward=who===0?1:-1;
  if(who===0?p.z<5.3:p.z>14.7){message('DEJADA: ACERCATE A LA RED',.8);return false;}
  landing.x=clamp(p.x+direction.dx*.95+(who?random(-.45,.45):0),-4.25,4.25);
  landing.z=who===0?random(11.15,12.15):random(7.85,8.85);
}

if(!bank){const errorScale=(1-quality)*1.15+Math.max(0,powerC-.86)*5.4;
 landing.x+=random(-.32,.32)*errorScale;landing.z+=(who? -1:1)*Math.max(0,powerC-.9)*9;
 let flight=shot==='lob'?2.22-powerC*.30:shot==='smash'?1.15-powerC*.42:1.79-powerC*.62;
 flight=clamp(flight/(.7+.3*quality),.74,2.6);
 b.x=p.x+dx*.16;b.z=p.z+(who?-.48:.48);b.h=clamp(b.h,shot==='smash'?1.35:.52,2.5);
 if(shot==='drop'){
  const distance=Math.abs(landing.z-b.z);
  flight=clamp(distance/(5.5+powerC*1.4),.72,1.3);
  b.h=clamp(b.h,.75,1.10);
 }
 ballistic(b,landing,flight);
}else{
  // Lateral contra-pared: each VALID shot has independent P(power shot)=0.5.
  // A normal lateral loses pace; the special keeps the deliberately spectacular launch.
  // No quota or forced alternation: 20 attempts need not produce exactly 10 powers.
  const rear=bankRoute.startsWith('rear');
  const sideSign=bankRoute.endsWith('left')?-1:bankRoute.endsWith('right')?1:0;
  const lateral=!!sideSign;
  const powerShot=lateral&&Math.random()<.5;
  if(lateral){
   lastLateralMode=powerShot?'POWER SHOT':'NORMAL';
   if(powerShot){lateralPower++;powerBannerT=1.45;}else lateralNormal++;
  }
  b.x=p.x+dx*.22;b.z=clamp(p.z+dz*.16,.55,8.0);b.h=clamp(b.h,.68,1.32);
  if(rear){
   // Rear only (S) uses precisely the approved launch values.
   const backSpeed=lateral&&!powerShot?12.5+powerC*3.6:15.2+powerC*5;
   b.vz=-backSpeed;
   if(lateral){
    const desiredBackX=sideSign*(powerShot?3.55:3.20);
    const flightToRear=b.z/backSpeed;
    b.vx=clamp((desiredBackX-b.x)/flightToRear,powerShot?-24:-18,powerShot?24:18);
    b.vh=(powerShot?8.0:7.15)+powerC*.6;
   }else{b.vx=clamp(direction.dx*2.7-b.x*.17,-3.9,3.9);b.vh=5.9+powerC*.8;}
  }else{
   const sideSpeed=powerShot?16.0+powerC*6.3:10.5+powerC*4.0;
   b.vx=sideSign*sideSpeed;
   b.vz=powerShot?7.2+powerC*2.1:8.4+powerC*1.3;
   b.vh=powerShot?5.9+powerC*.85:5.35+powerC*.5;
  }
  b.bank=true;b.bankRoute=bankRoute;b.bankStage=0;b.wallOK=true;
  if(lateral)message(powerShot?'POWER SHOT · LATERAL':'CONTRAPARED LATERAL',.8);
 }
 b.serveReceiver=null;b.lastHit=who;b.lastActor=p.id;if(who===0)robotAttempted=false;else allyAttempted=false;b.bounces=0;b.wallCount=0;b.age=0;b.netCrossed=false;b.serveFlight=false;b.trail=[];
 if(p===human){human.motion=bank?'glass':shot==='lob'||shot==='drop'?'forehand':shot;human.pose=bank?.55:.48;human.frameT=0;hCool=.31;human.cool=.31;
  // Visual-only desperate reach: only after a VALID contact near the reach boundary.
  // No extra hit window, auto-save, ball boost or AI advantage.
  const stretch=hypot(dx,dz);const urgent=!bank&&shot!=='smash'&&stretch>=1.37;
  human.savePoseT=urgent?.14:0;
  human.saveFrame=shot==='backhand'?6:5;
  human.recoverT=0;
  steer=bank?null:{ref:b,until:clock+.13,vx:b.vx,vz:b.vz,base:direction};
  if(!bank||bankRoute==='rear')message((bank?({'rear':'FONDO','left':'LATERAL IZQ','right':'LATERAL DER','rear_left':'FONDO → IZQ','rear_right':'FONDO → DER'}[bankRoute]||'CONTRAPARED'):label[shot])+' · '+Math.round(powerC*100)+'%',.68);
 }else{
  p.motion=p===partner?(bank?'glass':shot==='smash'?'smash':shot==='backhand'?'backhand':'forehand'):(shot==='backhand'?'backhand':'forehand');p.pose=.42;p.cool=.42;p.frameT=0;
  p.charge=powerC;
  if(p.team===1){robotThinking=0;robotCharge=powerC;}else {message('COMPAÑERO DEVUELVE · '+label[shot],.55);}
 }
 fx('pala',{who,power:powerC,shot});if(shot==='smash'&&powerC>.72&&Math.random()<.28)fx('reaccion',{who,power:powerC});rally++;return true;}
function queueShot(shot,power){if(phase!=='rally'||!ball||ball.lastHit===0)return;
queued={shot,power,expires:clock+1.48};attemptQueued();}
function attemptQueued(){if(!queued||phase!=='rally'||!ball||ball.lastHit===0)return;
if(playHit(0,queued.shot,queued.power)){queued=null;return;}
if(clock>queued.expires){queued=null;if(contactMsgT<=0){fx('fallo');message('GOLPE FUERA DE ALCANCE',.55);contactMsgT=.9;}}}
function specialGlass(route){
 const labels={rear:'FONDO',left:'LATERAL IZQ',right:'LATERAL DER',rear_left:'FONDO → IZQUIERDA',rear_right:'FONDO → DERECHA'};
 if(phase!=='rally'||!ball||ball.lastHit===0){message('CONTRAPARED: ESPERÁ LA PELOTA',.75);return;}
 queued={shot:'glass',power:.69,expires:clock+1.52,bank:true,route};
 message('CONTRAPARED · '+labels[route],.8);
}
function attemptSpecial(){if(!queued||!queued.bank)return false;if(!ball||phase!=='rally'||ball.lastHit===0){queued=null;return false;}
 if(playHit(0,'glass',queued.power,true,queued.route)){queued=null;return true;}
 if(clock>queued.expires){queued=null;message('CONTRAPARED NO DISPONIBLE',.65);}return false;
}
const glassCode={KeyS:'S',KeyA:'A',KeyD:'D'};
function glassDown(code){const v=glassCode[code];if(!v)return false;heldGlass.add(v);
 if(!glassComboUsed&&heldGlass.has('S')&&(heldGlass.has('A')||heldGlass.has('D'))){
  glassComboUsed=true;specialGlass(heldGlass.has('A')?'rear_left':'rear_right');
 }return true;
}
function glassUp(code){const v=glassCode[code];if(!v)return false;
 if(heldGlass.has(v)&&!glassComboUsed)specialGlass(v==='S'?'rear':v==='A'?'left':'right');
 heldGlass.delete(v);if(!heldGlass.size)glassComboUsed=false;
 return true;
}
// Remote input is a held-key state, consumed and validated by the host physics.
const buttonNames=['up','down','left','right','backhand','forehand','lob','smash','drop','sprint','rear','leftGlass','rightGlass'];
const remoteShots={backhand:'backhand',forehand:'forehand',lob:'lob',smash:'smash',drop:'drop'};
function remoteAim(){const b=remoteButtons;let d={dx:Number(!!b.right)-Number(!!b.left),dz:Number(!!b.up)-Number(!!b.down)};
 if(d.dx||d.dz)remoteLastAim={...d};else d=remoteLastAim;return d;}
function queueRemoteShot(shot,power){
 if(!remoteActive||phase==='intro'||paused)return;
 if(phase==='serveReady'){
  if(server===0&&servingActor(0)===partner){if(shot==='forehand'||shot==='backhand')startServe(0,power,remoteAim(),shot);else message('SAQUE BAJO: Z O X',.8);}
  return;
 }
 if(phase==='rally'&&ball&&ball.lastHit===1)remoteQueued={shot,power,expires:clock+1.3};
}
function queueRemoteGlass(route){
 if(remoteActive&&phase==='rally'&&ball&&ball.lastHit===1)
  remoteQueued={shot:'glass',power:.65,route,bank:true,expires:clock+1.35};
}
function updateRemoteInput(buttons){
 if(netMode!=='host'||!remoteActive)return;
 const next={};for(const k of buttonNames)next[k]=buttons&&buttons[k]===true;
 const old=remoteButtons;
 const chord=(next.rear&&(next.leftGlass||next.rightGlass));
 if(chord&&!remoteGlassCombo){remoteGlassCombo=true;queueRemoteGlass(next.leftGlass?'rear_left':'rear_right');}
 for(const [key,shot] of Object.entries(remoteShots)){
  if(next[key]&&!old[key])remoteCharge={key,shot,started:clock};
  if(!next[key]&&old[key]&&remoteCharge?.key===key){
   const charge=remoteCharge;remoteCharge=null;
   queueRemoteShot(charge.shot,clamp((clock-charge.started)/1.15,.14,1));
  }
 }
 for(const [key,route] of [['rear','rear'],['leftGlass','left'],['rightGlass','right']]){
  if(old[key]&&!next[key]&&!remoteGlassCombo)queueRemoteGlass(route);
 }
 if(!next.rear&&!next.leftGlass&&!next.rightGlass)remoteGlassCombo=false;
 remoteButtons=next;
 const a={dx:Number(!!next.right)-Number(!!next.left),dz:Number(!!next.up)-Number(!!next.down)};
 if(a.dx||a.dz)remoteLastAim=a;
}
// A4.1: direction stabilization ONLY for the yellow sprite selector.
// Rapid chaser re-planning must not rotate the rendered body every frame.
function stabilizeYellowFacing(p,dt){
 if(p.pose>0)return;
 const m=p.motion;
 const running=p.moving&&p.visualSpeed>.18&&['run_left','run_right','forward','backward'].includes(m);
 if(!running){
  p.visualIdleT=(p.visualIdleT||0)+dt;
  if(p.visualIdleT>.115){p.visualFacing='idle';p.visualPending='';p.visualPendingT=0;}
  return;
 }
 p.visualIdleT=0;
 if(!p.visualFacing||p.visualFacing==='idle'){
  p.visualFacing=m;p.visualPending='';p.visualPendingT=0;return;
 }
 if(p.visualFacing===m){p.visualPending='';p.visualPendingT=0;return;}
 if(p.visualPending!==m){p.visualPending=m;p.visualPendingT=dt;}
 else p.visualPendingT+=dt;
 if(p.visualPendingT>=.115){p.visualFacing=m;p.visualPending='';p.visualPendingT=0;}
}
function stepRemotePartner(dt){
 const oldPose=partner.pose,oldSpeed=partner.visualSpeed||0,oldX=partner.x,oldZ=partner.z;
 partner.cool=Math.max(0,partner.cool-dt);partner.pose=Math.max(0,partner.pose-dt);
 partner.frameT+=dt;partner.recoverT=Math.max(0,(partner.recoverT||0)-dt);partner.splitStepT=Math.max(0,(partner.splitStepT||0)-dt);
 if(oldPose>0&&partner.pose<=0)partner.recoverT=.18;
 if(phase==='serveDrop'&&ball?.serveData?.actor===partner.id)return;
 const b=remoteButtons,dx=Number(!!b.right)-Number(!!b.left),dz=Number(!!b.up)-Number(!!b.down),n=hypot(dx,dz);
 const sprint=b.sprint&&partner.stamina>7,speed=(sprint?7.05:5.06)*(.76+.24*clamp(partner.stamina/25,0,1));
 const step=n?Math.min(speed*dt,999)/n:0;
 partner.x=clamp(partner.x+dx*step,-4.5,4.5);partner.z=clamp(partner.z+dz*step,.45,9.3);
 partner.moving=n>0;partner.dx=dx;
 const realDist=hypot(partner.x-oldX,partner.z-oldZ);partner.visualSpeed=dt>0?realDist/dt:0;
 if(partner.moving)partner.stridePhase=(partner.stridePhase+realDist*1.95)%4096;
 if(!partner.moving&&oldSpeed>.3&&partner.pose<=0)partner.recoverT=.17;
 partner.lean=clamp(dx*.055,-.075,.075);
 partner.stamina=clamp(partner.stamina+(n?-(sprint?20:2.6):13)*dt,0,100);
 if(partner.pose<=0)partner.motion=n?(Math.abs(dx)>=Math.abs(dz)?dx>0?'run_right':'run_left':dz>0?'forward':'backward'):'idle';
 stabilizeYellowFacing(partner,dt);
 if(remoteQueued&&phase==='rally'&&ball&&ball.lastHit===1){
  if(playHit(0,remoteQueued.shot,remoteQueued.power,!!remoteQueued.bank,remoteQueued.route||'rear',partner)){
   remoteQueued=null;
  }else if(clock>remoteQueued.expires)remoteQueued=null;
 }else if(remoteQueued&&(!ball||phase!=='rally'||ball.lastHit!==1))remoteQueued=null;
}
const strokeKeys={KeyZ:'backhand',KeyX:'forehand',KeyC:'lob',Space:'smash',KeyV:'drop'};
const activeCodes=new Set(['F8','KeyF','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','KeyM','KeyN','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyZ','KeyX','KeyC','KeyV','Space','KeyS','KeyA','KeyD','KeyP','ShiftLeft','ShiftRight','Escape','Enter']);
function down(e){const code=window.PadelControls?.toLegacy(e.code)||e.code;if(window.PadelControls?.visible())return;if(netMode==='guest'){if(activeCodes.has(code)){e.preventDefault();window.parent?.postMessage({type:'padel-key',code:e.code,down:true},'*');}return;}if(activeCodes.has(code))e.preventDefault();if(e.repeat)return;if(code==='F8'){showShotStats=!showShotStats;message(showShotStats?'CONTADOR DE CONTRAPAREDES: ON':'CONTADOR DE CONTRAPAREDES: OFF',1);return;}ensureAudio();keys.add(code);
if(code.startsWith('Arrow')){const a=arrows();lastArrow.dx=a.dx;lastArrow.dz=a.dz;lastArrow.t=clock;}
if(code==='KeyF'){toggleFullscreen();return;}
if(code==='Escape'){if(help){help=false;paused=false;}else pause();return;}
if(code==='KeyP'){pause();return;}
if(code==='Enter'){if(phase==='intro')newMatch();else if(paused){paused=false;help=false;resumeAmbience();}return;}
 if((phase==='intro'||help||paused)&&!e.repeat){if(['Digit1','Digit2','Digit3'].includes(code)){tempoIndex=Number(code.slice(-1))-1;return;}if(['Digit8','Digit9'].includes(code)){tempoIndex=Number(code.slice(-1))-5;return;}if(['Digit4','Digit5','Digit6','Digit7'].includes(code)){skillIndex=Number(code.slice(-1))-4;return;}if(code==='KeyM'){ambientOn=!ambientOn;resumeAmbience();return;}if(code==='KeyN'){sfxOn=!sfxOn;return;}}
if(paused||phase==='loading'||phase==='intro')return;
if(glassCode[code]){glassDown(code);return;}
if(strokeKeys[code]){if(phase==='intro')newMatch();charging={code:code,shot:strokeKeys[code],started:clock};}
}
function up(e){const code=window.PadelControls?.toLegacy(e.code)||e.code;if(window.PadelControls?.visible())return;if(netMode==='guest'){if(activeCodes.has(code)){e.preventDefault();window.parent?.postMessage({type:'padel-key',code:e.code,down:false},'*');}return;}keys.delete(code);if(glassCode[code]){glassUp(code);return;}if(code.startsWith('Arrow')){const a=arrows();if(a.dx||a.dz){lastArrow.dx=a.dx;lastArrow.dz=a.dz;lastArrow.t=clock;}}
if(!charging||charging.code!==code)return;
const c=charging;charging=null;if(paused)return;const power=clamp((clock-c.started)/1.15,.14,1);
if(phase==='serveReady'){if(server===0&&servingActor(0)===human&&c.shot!=='smash'&&c.shot!=='lob'){startServe(0,power,aim(),c.shot);}else if(server===0)message('SAQUE BAJO: Z O X',.85);return;}
if(phase==='rally')queueShot(c.shot,power);
}
function toggleFullscreen(){try{const el=document.querySelector('main');if(document.fullscreenElement)document.exitFullscreen();else el.requestFullscreen();}catch(_){message('PANTALLA COMPLETA NO DISPONIBLE',1);}}
window.addEventListener('keydown',down);window.addEventListener('keyup',up);
window.addEventListener('blur',()=>{keys.clear();heldGlass.clear();glassComboUsed=false;charging=null;if(netMode==='offline'&&phase!=='intro')paused=true;});
// Settings operate on the pause/start overlay, never over live court play.
function settingsClick(x,y){
 if(y>=304&&y<=350){for(let i=0;i<tempos.length;i++){const bx=505+i*134;if(x>=bx&&x<=bx+124){tempoIndex=i;return true;}}}
 if(x>=617&&x<1061&&y>=376&&y<=422){skillIndex=clamp(Math.floor((x-619)/112),0,3);return true;}
 if(x>=615&&x<=831&&y>=459&&y<=509){ambientOn=!ambientOn;resumeAmbience();return true;}
 if(x>=847&&x<=1066&&y>=459&&y<=509){sfxOn=!sfxOn;return true;}
 return false;
}
canvas.addEventListener('pointerdown',e=>{if(netMode==='guest')return;ensureAudio();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*(W/r.width),y=(e.clientY-r.top)*(H/r.height);
 if(phase==='intro'||paused||help){if(settingsClick(x,y)){canvas.focus();return;}if(x>=696&&x<=973&&y>=653&&y<=711){if(phase==='intro')newMatch();else{help=false;paused=false;resumeAmbience();message('JUGANDO',.5);}canvas.focus();return;}canvas.focus();return;}
 if(y>=890&&y<=925&&x>=676&&x<=996){if(x<828)pause();else if(x>=845)newMatch();}
 else if(paused)pause();canvas.focus();});
// A4.3: White player's facing is visual only; inputs, speed, physics and
// collision remain authoritative from the original A4.2 simulation.
const whiteRunCycles={
 run_left:[0,1,4,5,4,1],
 run_right:[0,2,4,3,4,2],
 forward:[1,3,2,3,1,2],
 backward:[1,2,3,4,3,2]
};
function whiteRunFrame(facing){
 const custom=a45Enabled?(facing==='run_left'?a45.white_left:facing==='run_right'?a45.white_right:null):null;
 if(custom?.length)return custom[Math.floor(human.stridePhase)%custom.length];
 const frames=assets.human[facing]||assets.human.idle||[];
 if(!frames.length)return null;
 const cycle=whiteRunCycles[facing];
 return frames[cycle?cycle[Math.floor(human.stridePhase)%cycle.length]:0]||frames[0];
}
function whiteIdleFrame(){
 const d=human.visualFacing;
 const i=d==='run_right'?4:d==='forward'||d==='backward'?2:0;
 const idle=assets.human.idle||[];
 return idle[i]||idle[0]||null;
}
function stabilizeWhiteFacing(dt){
 human.visualBlendT=Math.max(0,human.visualBlendT-dt);
 if(human.pose>0)return; // never crossfade a contact or smash
 const vx=human.vx,vz=human.vz,ax=Math.abs(vx),az=Math.abs(vz);
 const moving=human.moving&&(ax+az)>.28;
 if(!moving){
  human.visualIdleT+=dt;
  human.visualPending='';human.visualPendingT=0;
  // Keep the last stable facing for the next idle pose; do not snap to a new one.
  if(human.visualIdleT>.125)human.visualBlendT=0;
  return;
 }
 human.visualIdleT=0;
 const old=human.visualFacing;
 // Hysteresis keeps slight diagonal fluctuations from flipping the torso.
 const lateral=old==='run_left'||old==='run_right';
 const side=lateral?ax>=az*.82:ax>az*1.18;
 const candidate=side?(vx>0?'run_right':'run_left'):(vz>0?'forward':'backward');
 if(!old||old==='idle'){
  human.visualFacing=candidate;human.visualPending='';human.visualPendingT=0;
  human.visualBlendT=0;human.visualFrom=null;return;
 }
 if(candidate===old){human.visualPending='';human.visualPendingT=0;return;}
 if(human.visualPending!==candidate){human.visualPending=candidate;human.visualPendingT=dt;}
 else human.visualPendingT+=dt;
 // White's feet follow the existing physical velocity immediately. Only
 // the next sprite orientation waits 80 ms to reject single-frame flickers.
 if(human.visualPendingT>=.080){
  human.visualFrom=whiteRunFrame(old);
  human.visualFacing=candidate;human.visualBlendT=.075;
  if(a45Enabled&&(candidate==='run_left'||candidate==='run_right'))human.stridePhase=0;
  human.visualPending='';human.visualPendingT=0;
 }
}
function stepHuman(dt){human.pose=Math.max(0,human.pose-dt);human.frameT+=dt;
 human.savePoseT=Math.max(0,human.savePoseT-dt);
 human.recoverT=Math.max(0,human.recoverT-dt);
if(phase==='serveDrop'&&ball&&ball.serveData?.actor===human.id){human.moving=false;return;}
const priorSpeed=hypot(human.vx,human.vz);
const a=arrows(),n=hypot(a.dx,a.dz);const sprint=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&boost>8;
const exhausted=.76+.24*clamp(boost/25,0,1),speed=(sprint?7.15:5.15)*exhausted;
// Smooth, responsive acceleration and deceleration in court metres/second.
const wantX=n?a.dx/n*speed:0,wantZ=n?a.dz/n*speed:0;
const blend=1-Math.exp(-(n?14.5:19.0)*dt);
human.vx+=(wantX-human.vx)*blend;human.vz+=(wantZ-human.vz)*blend;
if(Math.abs(human.vx)<.04)human.vx=0;if(Math.abs(human.vz)<.04)human.vz=0;
human.x=clamp(human.x+human.vx*dt,-4.55,4.55);human.z=clamp(human.z+human.vz*dt,.45,9.3);
if((human.x<=-4.55&&human.vx<0)||(human.x>=4.55&&human.vx>0))human.vx=0;
if((human.z<=.45&&human.vz<0)||(human.z>=9.3&&human.vz>0))human.vz=0;
const actualSpeed=hypot(human.vx,human.vz);
 human.moving=actualSpeed>.22;
 if(a45Enabled&&human.moving&&!human.a45WasMoving)human.stridePhase=0;
 human.a45WasMoving=human.moving;
 // Bind steps to ground distance, not a fixed FPS. Stops slide/cadence mismatch.
 if(human.moving)human.stridePhase=(human.stridePhase+actualSpeed*dt*1.65)%4096;
 // A small planted-foot settling pose when braking, without changing physics.
 if(!human.moving&&priorSpeed>.24&&human.pose<=0)human.recoverT=.17;
if(human.moving&&clock-lastStepAt>.32&&phase==='rally'&&hypot(human.vx,human.vz)>3.1){lastStepAt=clock;fx('pasos');}
if(human.moving){const motion=Math.abs(human.vx)>Math.abs(human.vz)*.65?(human.vx>0?'run_right':'run_left'):(human.vz>0?'forward':'backward');
if(human.previous!==motion){human.previous=motion;if(human.pose===0)human.frameT=0;}if(human.pose===0)human.motion=motion;
}else if(human.pose===0)human.motion='idle';
stabilizeWhiteFacing(dt);
boost=clamp(boost+(n?-(sprint?20:2.6):13)*dt,0,100);
if(human.pose===0&&ball&&phase==='rally'&&ball.lastHit===1&&ball.wallCount>0&&ball.z<3.4&&ball.vz>0&&!human.moving)human.motion='glass';}
// Preserve a stable home side until white *actually* crosses into the
// opposite sector. Unlike an immediate x-sign check this avoids lane flicker.
function updatePartnerLane(){
 if(partnerLane===1&&human.x>1.35)partnerLane=-1;
 else if(partnerLane===-1&&human.x< -1.35)partnerLane=1;
}
function chooseNearChaser(x,z,arrival){
 const hd=hypot(x-human.x,z-human.z),yd=hypot(x-partner.x,z-partner.z);
 const time=clamp(arrival+.22,.20,1.10);
 const canWhite=hd<=1.88+5.15*time,canYellow=yd<=1.85+3.62*time;
 const side=x>.52?1:x<-.52?-1:0;
 const whiteTerritory=side===-partnerLane||side===0;
 if(whiteTerritory)return !canWhite&&canYellow?partner:human;
 if(canYellow)return partner;
 if(canWhite)return human;
 return yd+.55<hd?partner:human;
}
// Player body separation only: no racket reach, ball physics, or collision
// response is changed. Local white takes priority; remote co-op splits pushes.
function separateTeammates(){
 const minDist=.86;
 let dx=partner.x-human.x,dz=partner.z-human.z,dist=hypot(dx,dz);
 if(dist>=minDist)return;
 if(dist<.0001){dx=partnerLane;dz=0;dist=0;}
 else{dx/=dist;dz/=dist;}
 const overlap=minDist-dist;
 const remoteShare=remoteActive?.5:0;
 const hx=human.x,hz=human.z;
 partner.x=clamp(partner.x+dx*overlap*(1-remoteShare),-4.5,4.5);
 partner.z=clamp(partner.z+dz*overlap*(1-remoteShare),.45,9.3);
 if(remoteShare){human.x=clamp(human.x-dx*overlap*remoteShare,-4.55,4.55);human.z=clamp(human.z-dz*overlap*remoteShare,.45,9.3);}
 // If a partner is against a boundary, make a bounded second attempt.
 const remain=minDist-hypot(partner.x-human.x,partner.z-human.z);
 if(remain>.001){
  if(!remoteActive){human.x=clamp(hx-dx*remain,-4.55,4.55);human.z=clamp(hz-dz*remain,.45,9.3);}
  else{partner.x=clamp(partner.x+dx*remain*.5,-4.5,4.5);human.x=clamp(human.x-dx*remain*.5,-4.55,4.55);}
 }
}
function stepDoublesAI(dt){
 updatePartnerLane();
 for(const p of [partner,robot,robot2]){if(p===partner&&remoteActive)continue;const oldPose=p.pose;p.cool=Math.max(0,p.cool-dt);p.pose=Math.max(0,p.pose-dt);if(p.pose<=0)p.charge=0;
  if(p===partner){p.frameT+=dt;p.recoverT=Math.max(0,(p.recoverT||0)-dt);p.splitStepT=Math.max(0,(p.splitStepT||0)-dt);if(oldPose>0&&p.pose<=0)p.recoverT=.18;}
 }
 const owner=servingActor();
 if(phase==='serveDrop'&&ball?.serveData?.actor===owner.id){owner.moving=false;}
 if(phase==='serveReady'&&server===1){robotServeTimer+=dt;if(robotServeTimer>.95){startServe(1,.52,{dx:0,dz:1});robotServeTimer=0;}}
 if(!remoteActive&&phase==='serveReady'&&server===0&&servingActor(0)===partner){allyServeTimer+=dt;if(allyServeTimer>.95){startServe(0,.51,{dx:0,dz:1});allyServeTimer=0;}}
 const botSkill=skillLevels[skillIndex];
 for(const team of [0,1]){
  const ais=team===0?(remoteActive?[]:[partner]):[robot,robot2], defending=phase==='rally'&&ball&&ball.lastHit!==team;
  const incoming=defending?ball:null;
  const future=incoming?clamp((team===0?5.2-incoming.z:15.8-incoming.z)/(incoming.vz||1),.06,.85):0;
  const forecastX=incoming?clamp(incoming.x+incoming.vx*future,-4.35,4.35):0;
  const forecastZ=incoming?clamp(incoming.z+incoming.vz*future,team===0?.8:11.15,team===0?9.3:18.9):0;
  let chaser=null;
  if(incoming){const participants=members[team];
   chaser=team===0&&incoming.serveReceiver?participants.find(p=>p.id===incoming.serveReceiver):null;
   if(!chaser){
    chaser=team===0&&!remoteActive?chooseNearChaser(forecastX,forecastZ,future):participants.reduce((best,p)=>{
     const d=hypot(forecastX-p.x,forecastZ-p.z);
     return (!best||d<best.d)?{p,d}:best;
    },null).p;
   }
  }
  for(const p of ais){
   const teammate=members[team].find(v=>v!==p),lane=p===robot||p===partner?-1:1;
   let goX=lane*2.35,goZ=team===0?4.0:15.4;
   if(phase==='serveReady'||phase==='serveDrop'){goX=p.x;goZ=p.z;}
   else if(defending&&p===chaser){p.thinking+=dt;
    const delay=team===0?.28:botSkill.reaction;
    if(p.thinking>=delay){goX=forecastX;goZ=forecastZ;}else {goX=p.x;goZ=p.z;}
   }else{
    p.thinking=0;
    // Cover the open lane, don't stand next to the teammate.
    goX=team===0?partnerLane*2.35:(teammate.x<0?2.3:-2.3);
    goZ=team===0?(teammate.z>5.5?4.8:5.35):(teammate.z<14?15.4:14.55);
   }
   if(p===owner&&phase==='serveDrop'){goX=p.x;goZ=p.z;}
   const dx=goX-p.x,dz=goZ-p.z,len=hypot(dx,dz),speed=team===0?3.62:botSkill.speed;
   const prevMoving=p.moving,prevSpeed=p===partner?p.visualSpeed||0:0,oldX=p.x,oldZ=p.z;
   p.dx=dx;p.moving=len>.17;
   if(len>.17){const move=Math.min(len,speed*dt);p.x=clamp(p.x+dx/len*move,-4.5,4.5);p.z=clamp(p.z+dz/len*move,team===0?.45:10.7,team===0?9.3:19.45);if(p!==partner)p.frameT+=dt;p.stamina=clamp(p.stamina-1.8*dt,0,100);}
   else p.stamina=clamp(p.stamina+8*dt,0,100);
   if(p===partner){
    const travelled=hypot(p.x-oldX,p.z-oldZ);p.visualSpeed=dt>0?travelled/dt:0;
    if(p.moving)p.stridePhase=(p.stridePhase+travelled*1.95)%4096;
    if(prevMoving&&!p.moving&&prevSpeed>.2&&p.pose<=0)p.recoverT=.19;
    p.lean=clamp(dx*.055,-.075,.075);
    if(!incoming||incoming.lastHit===0)p.splitArmed=true;
    if(incoming&&p.splitArmed&&!p.moving&&p.pose<=0&&incoming.z>=7.4&&incoming.z<=11){p.splitStepT=.15;p.splitArmed=false;}
    p.motion=p.pose>0?p.motion:p.moving?(Math.abs(dx)>Math.abs(dz)?dx>0?'run_right':'run_left':dz>0?'forward':'backward'):'idle';
    stabilizeYellowFacing(p,dt);
   }
  }
  // Allow exactly one AI return attempt per incoming ball on each side.
  if(!incoming||!chaser||chaser===human||(remoteActive&&chaser===partner))continue;
  const p=chaser;
  if(team===0&&contactPossible(0,'forehand',human))continue;
  if((team===0?allyAttempted:robotAttempted)||!contactPossible(team,'forehand',p))continue;
  // Robot uses the existing difficulty curve; yellow teammate has balanced skills.
  const miss=team===0?.13:botSkill.miss;
  const shot=incoming.h>1.45&&Math.random()<(team===0?.12:.20)?'smash':Math.random()<.13?'lob':incoming.x<p.x?'backhand':'forehand';
  if(!contactPossible(team,shot,p))continue;
  if(team===0)allyAttempted=true;else robotAttempted=true;
  if(Math.random()>=miss){
   const power=team===0?random(.43,.72):random(botSkill.low,botSkill.high);
   let bankRoute=null;
   if(p===partner&&!incoming.serveReceiver&&incoming.h<=1.80&&Math.random()<.23){
    if(p.z<=3.35&&incoming.z<=3.8)bankRoute='rear';
    else if(p.z<=7.0&&incoming.z<=7.4&&Math.abs(incoming.x)>3.5&&Math.abs(p.x)>3.0)
     bankRoute=incoming.x<0?'left':'right';
   }
   const didHit=bankRoute?playHit(team,'glass',power,true,bankRoute,p):false;
   if(!didHit)playHit(team,shot,power,false,'rear',p);
   lastInterception=p.id;
  }
  else{message(team===0?'COMPAÑERO FALLÓ':'LA IA FALLÓ EL CONTACTO',.55);}
 }
 robotStamina=(robot.stamina+robot2.stamina)*.5;
 robotCharge=Math.max(robot.charge||0,robot2.charge||0);
}
function updateBall(dt){if(!ball)return;const b=ball;b.age+=dt;
if(phase==='serveDrop'){serveT+=dt;b.vh-=G*dt;b.h+=b.vh*dt;
 if(b.h<=0&&serveBounceT===0){b.h=0;b.vh=2.8;serveBounceT=serveT;}
 if(serveBounceT>0&&serveT-serveBounceT>.17){finishServe();}return;}
if(phase!=='rally')return;
const old={x:b.x,z:b.z,h:b.h};b.trail.push(project(b.x,b.z,b.h));if(b.trail.length>7)b.trail.shift();
b.vh-=G*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.h+=b.vh*dt;
// Wall physics uses velocity reflection. Bank shots are not teleported to a chosen spot.
if(b.bankRoute?.startsWith('rear')&&b.bankStage===0&&b.z<=0&&b.vz<0){
 fx('vidrio',{who:0});b.z=-b.z;b.vz=Math.abs(b.vz)*.78;b.vx*=.92;b.vh*=.95;
 b.bankStage=b.bankRoute==='rear'?2:1;b.bank=b.bankStage!==2;
 b.wallCount++;lastBank='FONDO';message(b.bank?'FONDO · BUSCANDO LATERAL':'REBOTE CONTRAPARED',.54);
}
// The net has height ~0.88m. Interpolate actual crossing instead of testing frame endpoint.
if((old.z-10)*(b.z-10)<=0&&!b.netCrossed){const ratio=(10-old.z)/(b.z-old.z||1),height=old.h+(b.h-old.h)*ratio;b.netCrossed=true;if(height<.90){endPoint(1-b.lastHit,'RED');return;}}
// Shots hitting any wall before bouncing on the opponent's floor are faults.
const xOut=Math.abs(b.x)>5,zOut=b.z<0||b.z>20;
if((xOut||zOut)&&!b.wallOK&&!b.bank){endPoint(1-b.lastHit,'VIDRIO ANTES DEL PIQUE');return;}
if(b.h<=0){const side=b.z<10?0:1;
if(Math.abs(b.x)>5||b.z<0||b.z>20){endPoint(1-b.lastHit,'FUERA');return;}
if(side===b.lastHit&&b.bounces===0){endPoint(1-b.lastHit,'PIQUE EN CAMPO PROPIO');return;}
if(b.serveFlight&&b.bounces===0){const validBox=b.lastHit===0?(b.z>=10&&b.z<=17):(b.z>=3&&b.z<=10);
const validDiagonal=Math.sign(b.x)===-b.serveSide;
if(!validBox||!validDiagonal){endPoint(1-b.lastHit,'FALTA DE SAQUE');return;}b.serveFlight=false;serveFaults=0;}
fx('pique',{who:side});b.bounces++;b.h=0;if(b.bounces>=2){endPoint(b.lastHit,'DOBLE PIQUE');return;}
b.vh=Math.max(1.7,Math.abs(b.vh)*.69);b.vz*=.81;b.vx*=.88;b.wallOK=true;}
if(Math.abs(b.x)>=5){const side=b.x<0?'left':'right';
 const bankSide=(b.bankRoute==='left'||b.bankRoute==='right')&&b.bankStage===0||
                 b.bankRoute==='rear_'+side&&b.bankStage===1;
 fx('vidrio',{who:b.z>10?1:0});b.x=clamp(b.x,-5,5);b.vx=-b.vx*.77;b.wallCount++;
 if(bankSide){b.bankStage=2;b.bank=false;lastBank=side==='left'?'IZQUIERDO':'DERECHO';message('REBOTE · '+lastBank,.6);}
 }
if(b.z<=0||b.z>=20){fx('vidrio',{who:b.z>=20?1:0});b.z=clamp(b.z,0,20);b.vz=-b.vz*.75;b.wallCount++;}
if(b.age>11){endPoint(1-b.lastHit,'LÍMITE DE TIEMPO');}
}
// A4.4: purely cosmetic serve-stage selector, synchronized by existing ball
// state and real bounce. This does not schedule, accelerate, or delay a serve.
function selectA44ServeSprite(p){
 if(!a44Enabled||server!==0||servingActor(0)!==p)return null;
 const isYellow=p===partner;
 if(isYellow&&!a44Yellow)return null;
 // Walk normally while lining up a serve; only show the stationary
 // serve-ready pose after the feet have stopped. No changes to serve rules.
 if(phase==='serveReady'){
  if(p===human&&(human.moving||hypot(human.vx,human.vz)>.16))return null;
  return isYellow?a44.yellow_serve_prepare:(a45Enabled?a44.white_serve_prepare_no_ball:a44.white_serve_prepare);
 }
 if(phase==='serveDrop'&&ball?.serveData?.actor===p.id){
  const backhand=ball.serveData.visualShot==='backhand';
  if(isYellow)return serveBounceT>0?a44.yellow_serve_finish:a44.yellow_serve_recover;
  if(a45Enabled&&serveBounceT===0&&serveT<.16)return a44.white_serve_prepare_no_ball;
  return serveBounceT>0?(backhand?a44.white_serve_backhand:a44.white_serve_forehand):a44.white_low_defense;
 }
 // Real ball age governs how long the serve follow-through remains visible.
 if(phase==='rally'&&ball?.serveFlight&&ball.lastHit===0&&ball.age<.24){
  if(isYellow)return a44.yellow_serve_finish;
  return (ball.lastVisualServeShot==='backhand'?a44.white_serve_backhand:a44.white_serve_forehand);
 }
 return null;
}
// WHITE PLAYER VISUAL MOTION TEST (A1): Sprite timing only, physics unchanged.
function selectHumanSprite(){
 const special=selectA44ServeSprite(human);if(special)return special;
 const m=human.motion;
 const list=(a44Enabled&&m==='smash'&&human.pose>0&&a44.white_smash_prepare)
  ?[a44.white_smash_prepare,a44.white_smash_strike,a44.white_smash_recover]
  :(assets.human[m]||assets.human.idle||[]);
 if(!list.length)return null;
 if(human.pose>0&&['smash','forehand','backhand','glass'].includes(m)){
  if(human.savePoseT>0&&['forehand','backhand'].includes(m))
   return list[Math.min(human.saveFrame,list.length-1)];
  const total=Math.max(.35,human.pose+human.frameT);
  const progress=clamp(human.frameT/total,0,1);
  return list[Math.min(list.length-1,Math.floor(progress*list.length))];
 }
 if(m==='glass'&&human.pose<=0)return list[Math.floor(human.frameT*7)%list.length];
 const facing=human.visualFacing;
 if(human.moving&&whiteRunCycles[facing])return whiteRunFrame(facing);
 if(human.visualIdleT<=.125&&whiteRunCycles[facing])return whiteRunFrame(facing);
 if(human.recoverT>0&&assets.human.idle?.length>5)return assets.human.idle[5];
 // Ready stance stays aligned with the last body orientation, rather than
 // cycling through different torso angles every half second while stationary.
 return whiteIdleFrame();
}
// A4.2: eight adjacent leg-motion frames per facing, all derived from one
// original sprite. The frame rate depends on actual metres travelled, NOT
// elapsed time, so slow/normal/fast tempos share realistic step density.
const yellowGaits={
 run_left:'screen_right',run_right:'screen_left',
 forward:'forward',backward:'backward'
};
const yellowGaitFrames={};
for(const [motion,name] of Object.entries(yellowGaits)){
 const base=motion==='run_left'?yellow.run_screen_right_back_01:
            motion==='run_right'?yellow.run_screen_left_back_01:
            motion==='backward'?yellow.recovery_back:yellow.ready_back;
 yellowGaitFrames[motion]=Array.from({length:8},(_,i)=>({
  src:`assets/yellow/a42_walk/${name}_strip.webp`,
  bounds:[(base?.bounds?.[0]||0)+i*512,base?.bounds?.[1]||0,
          (base?.bounds?.[2]||512)+i*512,base?.bounds?.[3]||512]
 }));
}
for(const frames of Object.values(yellowGaitFrames))load(frames[0].src);
function yellowGaitFrame(motion,stride){
 const frames=yellowGaitFrames[motion];
 if(!frames?.length)return yellow.ready_back;
 return frames[Math.floor((((stride%1)+1)%1)*frames.length)%frames.length];
}
// A4 visual-only animation: preserve world positions, collision and ball behaviour.
function selectYellowSprite(p){
 const special=selectA44ServeSprite(p);if(special)return special;
 const m=p.motion||'idle';
 if(p.pose>0){
  const progress=clamp(p.frameT/Math.max(.38,p.pose+p.frameT),0,1);
  const stage=progress<.28?'prepare':progress<.64?'contact':'followthrough';
  if(m==='forehand'||m==='glass')return yellow['forehand_back_'+stage]||yellow.ready_back;
  if(m==='backhand')return yellow['backhand_back_'+stage]||yellow.ready_back;
  if(m==='smash')return yellow[stage==='prepare'?'serve_back_toss':'serve_back_contact']||yellow.ready_back;
 }
 // The original run_01 and run_02 assets are different *body orientations*,
 // not adjacent walk-cycle frames. Alternating them made the yellow player
 // spin and sway on every stride, especially at fast tempo.
 // Keep one anatomically coherent facing per direction until a proper
 // matching walk cycle is available. Cadence remains a tiny foot-planted bob.
 const facing=p.visualFacing||m;
 if((p.moving||p.visualIdleT<=.115)&&facing!=='idle'){
  if(a45Enabled&&!a45YellowOld){
   const steps=facing==='run_left'?a45.yellow_left:facing==='run_right'?a45.yellow_right:null;
   if(steps?.length)return steps[Math.floor((p.stridePhase||0)*1.25)%steps.length];
  }
  return yellowGaitFrame(facing,p.stridePhase||0);
 }
 if(p.recoverT>0)return yellow.recovery_back;
 if(p.splitStepT>0)return yellow.split_step_back;
 return yellow.ready_back;
}
function drawHumanActor(p,which){
 const src=p===human?selectHumanSprite():selectYellowSprite(p);
 if(!src)return;const im=images[src.src];if(!im?.complete||!im.naturalWidth)return;
 const pr=project(p.x,p.z),[x0,y0,x1,y1]=src.bounds;const sw=x1-x0,sh=y1-y0;
 const height=215*pr.scale*(p===human?1:1.02),width=sw/sh*height;
 // Smaller visual body tilt, same world coordinates and actual running speed.
 const lateral=p===human?human.vx/7.15:(p.moving?(p.lean||0)*1.4:0);
 const lean=clamp(lateral*(p===human?.033:.057),-.055,.055);
 const stride=p===human?human.stridePhase:(p.stridePhase||0);
 const lateralStepA45=a45Enabled&&p===human&&(p.visualFacing==='run_left'||p.visualFacing==='run_right');
 const vertical=p.moving&&!lateralStepA45?1-(p===human?.008:.004)*Math.abs(Math.sin(stride*Math.PI)):1;
 ctx.save();ctx.translate(pr.x,pr.y);ctx.transform(1,0,-lean,1,0,0);
 const drawBody=(frame,opacity=1)=>{
  const bmp=images[frame?.src];if(!bmp?.complete||!bmp.naturalWidth)return;
  const [ax0,ay0,ax1,ay1]=frame.bounds,aw=ax1-ax0,ah=ay1-ay0;
  const bw=aw/ah*height;
  ctx.globalAlpha=opacity;
  // Register the white player's torso to the same court coordinate when
  // individual sprite bounds widen or narrow due to strides and rackets.
  const anchor=p===human?(frame.anchorX??.5):.5;
  ctx.drawImage(bmp,ax0,ay0,aw,ah,-bw*anchor,-height*vertical,bw,height*vertical);
 };
 if(p===human&&human.pose<=0&&human.visualFrom&&human.visualBlendT>0){
  const f=clamp(human.visualBlendT/.075,0,1);
  drawBody(human.visualFrom,f);drawBody(src,1-f);
 }else drawBody(src);
 ctx.restore();
 drawTag(pr.x,pr.y+15,p.id,p===human?'#35d8ff':'#ffe14f');
}
function drawRobotActor(p){
 let name='robot-ready-clean';
 if(p.pose>0)name=p.motion==='backhand'?'robot-backhand-clean':'robot-forehand-clean';
 else if(p.moving){const files=p.dx>0?['robot-run-right-a','robot-run-right-b']:['robot-run-left-a','robot-run-left-b'];name=files[Math.floor(p.frameT*8)%2];}
 const im=images[assets.robot[name]||assets.robot['robot-ready-clean']];if(!im?.complete||!im.naturalWidth)return;
 const pr=project(p.x,p.z),height=196*pr.scale,width=height*(im.width/im.height);
 ctx.save();if(p===robot2){ctx.filter='hue-rotate(135deg) saturate(1.3)';}
 ctx.drawImage(im,pr.x-width/2,pr.y-height,width,height);ctx.restore();
 drawTag(pr.x,pr.y+12,p.id,p===robot?'#ff6078':'#ffa944');
}
function drawTag(x,y,t,color){ctx.save();ctx.font='bold 13px system-ui';ctx.textAlign='center';const w=Math.max(44,ctx.measureText(t).width+15);ctx.fillStyle='#081b2dbd';ctx.fillRect(x-w/2,y-13,w,19);ctx.fillStyle=color;ctx.fillText(t,x,y);ctx.restore();}
function drawServeBallPoint(p,scale){
 const r=clamp(4.4*scale,2.4,4.1);
 ctx.save();ctx.shadowColor='#caff44';ctx.shadowBlur=r*2.4;
 ctx.fillStyle='#eaff35';ctx.strokeStyle='#ffffff';ctx.lineWidth=.9;
 ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();ctx.stroke();ctx.restore();
}
function drawBall(){
 // A4.5: ball held in left hand during white serve prep. Same physical ball
 // follows existing bounce/flight on release; visual-only correction.
 if(a45Enabled&&server===0&&servingActor(0)===human&&(phase==='serveReady'||phase==='serveDrop')&&(!ball||ball.serveData?.actor===human.id)){
  const pp=project(human.x,human.z),ht=215*pp.scale;
  const inHand={x:pp.x+ht*.278,y:pp.y-ht*.590};
  let point=inHand;
  if(phase==='serveDrop'&&ball){
   const phys=project(ball.x,ball.z,ball.h);
   const t=clamp((serveT-.015)/.20,0,1);
   point={x:inHand.x+(phys.x-inHand.x)*t,y:inHand.y+(phys.y-inHand.y)*t};
   if(t>=1){/* continue below with standard physical rendering */}
   else {drawServeBallPoint(point,pp.scale);return;}
  }else{drawServeBallPoint(point,pp.scale);return;}
 }
 if(!ball||phase==='pointEnd')return;const ground=project(ball.x,ball.z),p=project(ball.x,ball.z,ball.h),r=clamp(4.4*p.scale,2.4,4.1);
ctx.save();ctx.fillStyle='#00112090';ctx.beginPath();ctx.ellipse(ground.x,ground.y+3,r*1.8,r*.53,0,0,Math.PI*2);ctx.fill();
for(let i=0;i<ball.trail.length;i++){const pos=ball.trail[i],op=(i+1)/ball.trail.length;ctx.globalAlpha=op*.15;ctx.fillStyle='#dffd5a';ctx.beginPath();ctx.arc(pos.x,pos.y,r*.5,0,7);ctx.fill();}
ctx.globalAlpha=1;ctx.shadowColor='#caff44';ctx.shadowBlur=r*2.4;ctx.fillStyle='#eaff35';ctx.strokeStyle='#ffffff';ctx.lineWidth=.9;ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();ctx.stroke();ctx.restore();}
function drawGuide(){if(!ball||phase!=='rally')return;const b=ball,disc=b.vh*b.vh+2*G*b.h,T=clamp((b.vh+Math.sqrt(Math.max(0,disc)))/G,.05,2.3);
const x=b.x+b.vx*T,z=b.z+b.vz*T;if(Math.abs(x)>5||z<0||z>20)return;const p=project(x,z);
ctx.save();ctx.strokeStyle=b.lastHit===1?'#5cfffba8':'#ffffffe0';ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(p.x,p.y,12*p.scale,7*p.scale,0,0,7);ctx.stroke();ctx.restore();}
function rect(x,y,w,h,r=0){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawMeter(x,y,w,h,value,energy=false){value=clamp(value,0,1);ctx.save();ctx.fillStyle='#061b32';rect(x,y,w,h,2);ctx.fill();ctx.strokeStyle='#427ca5';ctx.strokeRect(x+.5,y+.5,w-1,h-1);
if(value>0){if(!energy){const gd=ctx.createLinearGradient(x,0,x+w,0);gd.addColorStop(0,'#e82c35');gd.addColorStop(.2,'#ffa62d');gd.addColorStop(.44,'#f5ef43');gd.addColorStop(.63,'#3cf2a5');gd.addColorStop(1,'#17405b');ctx.fillStyle=gd;}else ctx.fillStyle='#21dbc5';
ctx.fillRect(x+2,y+2,(w-4)*value,h-4);}
if(!energy){ctx.strokeStyle='#f6faff';ctx.lineWidth=2.5;const indicator=clamp(x+value*w,x+1,x+w-1);ctx.beginPath();ctx.moveTo(indicator,y-4);ctx.lineTo(indicator,y+h+4);ctx.stroke();}
ctx.restore();}
function drawTop(){ctx.save();ctx.fillStyle='#071429';rect(727,28,192,85,5);ctx.fill();ctx.textAlign='center';ctx.fillStyle='#f3fbff';ctx.font='bold 41px system-ui';ctx.fillText(score(0),767,72);ctx.fillText(score(1),878,72);
ctx.fillStyle='#38ccff';ctx.fillRect(822,42,2,31);ctx.font='bold 15px system-ui';ctx.fillText(`JUEGOS ${games[0]} – ${games[1]}`,824,104);ctx.restore();}
function drawHUD(){ctx.save();const playerPower=netMode==='guest'?netHostPower:charging?clamp((clock-charging.started)/1.15,0,1):queued?queued.power:0;
// Positions belong exactly to the user's artwork: two independent bars, one for each player.
drawMeter(127,858,231,18,playerPower);drawMeter(205,895,150,15,boost/100,true);
drawMeter(1326,858,231,18,remoteActive?(netMode==='guest'?netRemotePower:remoteCharge?clamp((clock-remoteCharge.started)/1.15,0,1):remoteQueued?.power||0):robotCharge);drawMeter(1404,895,150,15,remoteActive?partner.stamina/100:robotStamina/100,true);
// Redesigned match-control panel. Covers the tiny baked-in raster HUD only.
const hudX=664,hudY=825,hudW=344,hudH=106;
ctx.fillStyle='#061626f8';rect(hudX,hudY,hudW,hudH,9);ctx.fill();
ctx.strokeStyle='#438db7';ctx.lineWidth=2;ctx.stroke();
ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='bold 27px system-ui';
ctx.fillText('RALLY '+rally,750,862);
ctx.fillStyle='#b6dbef';ctx.font='bold 16px system-ui';
ctx.fillText('RÉCORD ANTERIOR: '+longestRally,919,859);
ctx.fillStyle='#91bed8';ctx.font='13px system-ui';ctx.fillText('Golpes en el punto',750,880);
const drawAction=(x,title)=>{ctx.fillStyle='#156491';rect(x,890,151,35,5);ctx.fill();ctx.strokeStyle='#64b9e1';ctx.lineWidth=1.3;ctx.stroke();ctx.fillStyle='#f7fcff';ctx.font='bold 16px system-ui';ctx.fillText(title,x+75.5,913);};
drawAction(676,'PAUSA');drawAction(845,'REINICIAR');
if(powerBannerT>0){ctx.fillStyle='#122845d9';rect(664,189,344,46,9);ctx.fill();ctx.strokeStyle='#f3c961';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff1b7';ctx.font='bold 25px system-ui';ctx.fillText('POWER SHOT',836,221);}
if(showShotStats){ctx.fillStyle='#081b2ddd';rect(1101,42,480,40,7);ctx.fill();ctx.fillStyle='#e8faff';ctx.textAlign='center';ctx.font='bold 17px system-ui';ctx.fillText('LATERALES  NORMALES: '+lateralNormal+'  |  POWER: '+lateralPower,1341,69);}
// PAUSA and REINICIAR are clickable; TECLAS is the separate HTML button.
if(phase==='intro'||phase==='loading'||paused)drawSettingsPanel();
if(alertT>0&&!paused&&phase!=='intro'&&phase!=='loading'){ctx.textAlign='center';ctx.font='bold 16px system-ui';const width=clamp(ctx.measureText(alert).width+48,220,760);ctx.fillStyle='#001b30cf';rect(836-width/2,150,width,39,6);ctx.fill();ctx.fillStyle='#dffaff';ctx.fillText(alert,836,176);}
ctx.restore();}
function settingsButton(x,y,w,h,title,selected){
 ctx.fillStyle=selected?'#177ac0':'#123650';rect(x,y,w,h,7);ctx.fill();ctx.strokeStyle=selected?'#58d8fc':'#47758e';ctx.lineWidth=selected?2.5:1.1;ctx.stroke();
 ctx.fillStyle='#f2fcff';ctx.font=title.length>9?'bold 13px system-ui':'bold 17px system-ui';ctx.textAlign='center';ctx.fillText(title,x+w/2,y+h/2+6);
}
function drawSettingsPanel(){
 ctx.save();ctx.fillStyle='#020e1acf';ctx.fillRect(0,0,W,H);
 rect(495,179,686,570,18);ctx.fillStyle='#0a2340f5';ctx.fill();ctx.strokeStyle='#259dda';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 32px system-ui';ctx.fillText(phase==='loading'?'CARGANDO RECURSOS':phase==='intro'?'PADEL RALLY — DOBLES 2 VS 2':help?'COMANDOS Y AJUSTES':'PARTIDA EN PAUSA — AJUSTES',838,247);
 ctx.font='17px system-ui';ctx.fillStyle='#a9cfe8';ctx.fillText('RITMO DE JUEGO',836,292);
 tempos.forEach((v,i)=>settingsButton(505+i*134,307,124,42,v.name,tempoIndex===i));
 ctx.fillStyle='#a9cfe8';ctx.fillText('DIFICULTAD DEL ROBOT',836,367);
 skillLevels.forEach((v,i)=>settingsButton(619+i*112,379,105,42,v.name,skillIndex===i));
 settingsButton(615,461,214,47,'AMBIENTE REAL: '+(ambientOn?'SÍ':'NO'),ambientOn);
 settingsButton(846,461,214,47,'EFECTOS REALES: '+(sfxOn?'SÍ':'NO'),sfxOn);
 ctx.fillStyle='#d6f2ff';ctx.font='16px system-ui';
 ctx.fillText(netMode==='offline'?'TÚ + COMPAÑERO IA contra DOS ROBOTS':'BLANCO + AMARILLO ONLINE contra DOS ROBOTS',836,535);
 ctx.fillText('Flechas: mover y dirigir    ·    Z: revés    ·    X: derecha',836,557);
 ctx.fillText('C: globo · V: dejada · ESPACIO: remate · S: fondo · A/D: laterales',836,584);
 ctx.fillText('S + A: fondo→izq · S + D: fondo→der · Shift: correr',836,609);
 ctx.fillStyle='#85b3d2';ctx.font='14px system-ui';ctx.fillText('1–3, 8–9 ritmo · 4–7 dificultad · M ambiente · N efectos · F pantalla completa',836,636);
 settingsButton(698,655,272,54,netMode==='guest'?'ESPERANDO ANFITRIÓN':phase==='intro'?'JUGAR':help?'VOLVER AL PARTIDO':'REANUDAR',true);
 if(phase==='loading'){ctx.fillStyle='#fff';ctx.fillText('Cargando '+loaded+'/'+requested,836,735);}
 ctx.restore();
}
function tick(dt){
 if(netMode==='guest'||phase==='loading'||phase==='intro'||paused)return;
 const tempo=tempos[tempoIndex];dt=Math.min(.04,dt)*tempo.scale;
 const fastBallFactor=(tempo.ballScale||tempo.scale)/tempo.scale;
 // Faster-ball modes substep BOTH actors and ball to prevent shots skipping
 // contact windows at high velocities; base three modes run as before.
 const substeps=fastBallFactor>1?Math.max(1,Math.ceil(dt*fastBallFactor/.009)):1;
 for(let i=0;i<substeps;i++){
  const d=dt/substeps;
  clock+=d;alertT=Math.max(0,alertT-d);contactMsgT=Math.max(0,contactMsgT-d);hCool=Math.max(0,hCool-d);human.cool=hCool;
  powerBannerT=Math.max(0,powerBannerT-d);
  stepHuman(d);stepDoublesAI(d);if(remoteActive)stepRemotePartner(d);
  separateTeammates();
  updateBall(phase==='rally'?d*fastBallFactor:d);
  if(queued?.bank)attemptSpecial();else attemptQueued();
  if(steer&&ball===steer.ref&&clock<steer.until){const a=arrows();if(a.dx||a.dz){ball.vx=steer.vx+(a.dx-steer.base.dx)*1.5;ball.vz=steer.vz+(a.dz-steer.base.dz)*.55;}}
  if(steer&&clock>=steer.until)steer=null;
  if(phase==='pointEnd'){pointDelay-=d;if(pointDelay<=0){phase='serveReady';resetPositions();message(serveFaults===1?'SEGUNDO SAQUE':server===0?(servingActor(0)===human?'TU SAQUE · Z O X':'SAQUE DEL COMPAÑERO'):'SAQUE DE LA IA',1.7);}}
 }
}
function render(){ctx.clearRect(0,0,W,H);const court=images['assets/court_clean.png'];if(court?.complete&&court.naturalWidth)ctx.drawImage(court,0,0,W,H);else{ctx.fillStyle='#156ace';ctx.fillRect(0,0,W,H);}drawGuide();drawRobotActor(robot);drawRobotActor(robot2);drawHumanActor(partner);drawHumanActor(human);drawBall();drawTop();drawHUD();}
// The bridge can be used only by online.html (same origin iframe).
function getSnapshot(){if(netMode!=='host'||phase==='loading')return null;
 const fields=p=>({x:p.x,z:p.z,motion:p.motion,visualFacing:p===partner?p.visualFacing:undefined,visualIdleT:p===partner?p.visualIdleT:undefined,previous:p.previous,frameT:p.frameT,pose:p.pose,moving:p.moving,dx:p.dx,stamina:p.stamina,charge:p.charge,cool:p.cool,stridePhase:p.stridePhase,recoverT:p.recoverT,savePoseT:p.savePoseT,saveFrame:p.saveFrame,visualFacing:p===human?p.visualFacing:p.visualFacing,visualPending:p===human?p.visualPending:undefined,visualPendingT:p===human?p.visualPendingT:undefined,visualIdleT:p===human?p.visualIdleT:p.visualIdleT,visualBlendT:p===human?p.visualBlendT:undefined});
 return {phase,paused,help,clock,serveBounceT,server,scoreP:[...scoreP],games:[...games],rally,longestRally,pointDelay,pointInGame,nearServerMember,farServerMember,
  tempoIndex,skillIndex,alert,alertT,boost,robotCharge,robotStamina,serveFaults,remoteActive,powerBannerT,lateralNormal,lateralPower,lastLateralMode,
  power1:charging?clamp((clock-charging.started)/1.15,0,1):queued?.power||0,
  power2:remoteCharge?clamp((clock-remoteCharge.started)/1.15,0,1):remoteQueued?.power||0,
  human:fields(human),partner:fields(partner),robot:fields(robot),robot2:fields(robot2),
  ball:ball?{...ball,trail:(ball.trail||[]).slice(-7)}:null,
  audioEvents:audioEvents.slice(-8)};
}
function applySnapshot(state,seq){
 if(netMode!=='guest'||!state||!['intro','serveReady','serveDrop','rally','pointEnd','loading'].includes(state.phase)||seq<=guestSnapshotSeq)return;
 guestSnapshotSeq=seq;
 phase=state.phase;paused=!!state.paused;help=!!state.help;clock=Number(state.clock)||0;serveBounceT=Number(state.serveBounceT)||0;
 server=Number(state.server)||0;scoreP=Array.isArray(state.scoreP)?state.scoreP.slice(0,2):[0,0];games=Array.isArray(state.games)?state.games.slice(0,2):[0,0];
 rally=Number(state.rally)||0;longestRally=Number(state.longestRally)||0;pointDelay=Number(state.pointDelay)||0;pointInGame=Number(state.pointInGame)||0;
 nearServerMember=Number(state.nearServerMember)||0;farServerMember=Number(state.farServerMember)||0;
 tempoIndex=clamp(Number(state.tempoIndex)||0,0,tempos.length-1);skillIndex=clamp(Number(state.skillIndex)||0,0,3);
 alert=String(state.alert||'');alertT=Number(state.alertT)||0;powerBannerT=Number(state.powerBannerT)||0;lateralNormal=Number(state.lateralNormal)||0;lateralPower=Number(state.lateralPower)||0;lastLateralMode=String(state.lastLateralMode||'');boost=Number(state.boost)||0;
 robotCharge=Number(state.robotCharge)||0;robotStamina=Number(state.robotStamina)||0;serveFaults=Number(state.serveFaults)||0;
 remoteActive=!!state.remoteActive;netHostPower=Number(state.power1)||0;netRemotePower=Number(state.power2)||0;
 for(const [name,p] of [['human',human],['partner',partner],['robot',robot],['robot2',robot2]]){
  const o=state[name];if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.z))continue;
  Object.assign(p,o);
 }
 ball=state.ball?{...state.ball,trail:Array.isArray(state.ball.trail)?state.ball.trail:[]}:null;
 for(const evt of (state.audioEvents||[])){
  if(Number.isSafeInteger(evt.id)&&evt.id>lastRemoteAudioEvent){
   lastRemoteAudioEvent=evt.id;
   if(evt.kind&&['pala','vidrio','pique','reaccion'].includes(evt.kind))
    fx(evt.kind,{who:evt.who,power:evt.power,shot:evt.shot});
  }
 }
 status.textContent=alert;
}
function setRemoteConnected(active){if(netMode!=='host')return;
 remoteActive=!!active;
 if(!remoteActive){remoteButtons={};remoteCharge=null;remoteQueued=null;remoteGlassCombo=false;remoteGlass.clear();}
}
window.PadelOnlineBridge={
 setMode(mode){if(!['host','guest','offline'].includes(mode))return;netMode=mode;guestSnapshotSeq=-1;},
 setRemoteConnected,receiveRemoteInput:updateRemoteInput,getSnapshot,applySnapshot,
 unlockAudio:ensureAudio,
 debug(){return{mode:netMode,remoteActive,remoteButtons:{...remoteButtons},remoteCharge,remoteQueued,guestSnapshotSeq};}
};
function loop(t){const dt=last?(t-last)/1000:0;last=t;tick(dt);musicLoop();render();requestAnimationFrame(loop);}requestAnimationFrame(loop);
window.__padelDebug=()=>({mode:'2v2',phase,paused,help,clock,loaded,requested,errors,server,nearServerMember,farServerMember,servingActor:servingActor().id,allyAttempted,robotAttempted,lastInterception,roster:[...members[0],...members[1]].map(p=>({id:p.id,team:p.team,x:p.x,z:p.z,cool:p.cool,moving:p.moving})),score:[score(0),score(1)],games:[...games],rally,longestRally,serveFaults,pointInGame,servingSide:pointInGame%2===0?'DERECHA':'IZQUIERDA',boost,robotStamina,lastBank,lastLateralMode,lateralNormal,lateralPower,powerBannerT,showShotStats,partnerVisual:{motion:partner.motion,visualFacing:partner.visualFacing,visualPending:partner.visualPending,stridePhase:partner.stridePhase,frameT:partner.frameT,recoverT:partner.recoverT,splitStepT:partner.splitStepT,visualSpeed:partner.visualSpeed},ball:ball?{x:ball.x,z:ball.z,h:ball.h,vx:ball.vx,vz:ball.vz,vh:ball.vh,lastHit:ball.lastHit,bounces:ball.bounces,serveFlight:ball.serveFlight,bank:ball.bank,bankRoute:ball.bankRoute,bankStage:ball.bankStage,wallCount:ball.wallCount}:null,human:{x:human.x,z:human.z,motion:human.motion,visualFacing:human.visualFacing,visualPending:human.visualPending,visualBlendT:human.visualBlendT,stridePhase:human.stridePhase,height:215*project(human.x,human.z).scale},robot:{x:robot.x,z:robot.z,motion:robot.motion},tempo:tempos[tempoIndex].name,tempoScale:tempos[tempoIndex].scale,skill:skillLevels[skillIndex].name,skillParams:skillLevels[skillIndex],ambientOn,sfxOn,robotAttempted,partnerLane,playerSeparation:hypot(partner.x-human.x,partner.z-human.z),lastRobotTarget,robotAimWhite,robotAimYellow,ballSpeedFactor:(tempos[tempoIndex].ballScale||tempos[tempoIndex].scale)/tempos[tempoIndex].scale,velocity:{vx:human.vx,vz:human.vz},charging:charging?.shot||null,queued:queued?.shot||null,queuedRoute:queued?.route||null});
})();

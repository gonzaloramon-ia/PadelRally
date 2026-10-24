/* PADEL RALLY — ONLINE COOP ALPHA. Beta 09 cloned intact; authoritative host, remote yellow player. */
(()=>{'use strict';
const gameQuery=typeof location==='undefined'||typeof URLSearchParams==='undefined'?{get:()=>null}:new URLSearchParams(location.search);
const careerMode=gameQuery.get('career')==='1',careerTournament=Math.max(0,Number(gameQuery.get('tournament'))||0),careerRound=Math.max(1,Number(gameQuery.get('round'))||1);
const requestedFormat=gameQuery.get('format')||'2v2',specialMode=gameQuery.get('special')||'';
const careerPlayerName=(gameQuery.get('player')||'P1').trim().slice(0,12)||'P1';
const quickPlayerName=(gameQuery.get('player')||'P1').trim().slice(0,12)||'P1';
const careerPartnerName=(gameQuery.get('ally')||'ALIADO').trim().slice(0,12)||'ALIADO';
const careerRacket=(gameQuery.get('racket')||'clasica').trim().slice(0,20)||'clasica';
const careerShoes=(gameQuery.get('shoes')||'clasicas').trim().slice(0,20)||'clasicas';
const careerRival1=(gameQuery.get('opp1')||'IA1').trim().slice(0,12)||'IA1';
const careerRival2=(gameQuery.get('opp2')||'IA2').trim().slice(0,12)||'IA2';
const quickRival1=(gameQuery.get('opp1')||'IA1').trim().slice(0,12)||'IA1';
const quickRival2=(gameQuery.get('opp2')||'IA2').trim().slice(0,12)||'IA2';
const quickRival3=(gameQuery.get('opp3')||'IA3').trim().slice(0,12)||'IA3';
const W=1672,H=941,BASE_G=9.81,G=specialMode==='celestial'?8.50:BASE_G, canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),status=document.getElementById('status');
const assets=window.PADEL_ASSETS||{human:{},robot:{}};
const yellow=window.PADEL_YELLOW||{};
// A4.4: optional VISUAL assets only. No movement, ball, physics or hitbox changes.
const a44=window.PADEL_A44_SPRITES||{};
const a44Enabled=window.PADEL_A44_ENABLED!==false;
const a44Yellow=window.PADEL_A44_YELLOW===true;
const a45=window.PADEL_A45_SPRITES||{};
const a45Enabled=window.PADEL_A45_ENABLED===true;
const a45YellowOld=window.PADEL_A45_YELLOW_OLD===true;
const a48=window.PADEL_A48_SPRITES||{};
const a48Enabled=window.PADEL_A48_ENABLED!==false;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),random=(a,b)=>a+(b-a)*Math.random(),hypot=Math.hypot;
// A5.7 EXTERIOR TEST — the 10x20 court remains unchanged. Side glass is solid
// except for the two real access openings around the net. Players may only
// cross the side boundary through those openings, then run in the exterior strip.
const COURT_X=5,NET_Z=10,DOOR_Z_MIN=8.35,DOOR_Z_MAX=11.65;
const SIDE_GLASS_H=3.0,BACK_GLASS_H=4.0,OUTER_X=7.25,OUTER_Z_MIN=.25,OUTER_Z_MAX=19.75;
const inDoorZ=z=>z>=DOOR_Z_MIN&&z<=DOOR_Z_MAX;
const actorOutside=p=>Math.abs(p.x)>COURT_X+.03;
const ballOutside=b=>!!b&&(Math.abs(b.x)>COURT_X+.03||b.z<0||b.z>20);
// Visual centre limits for the white player while normal play remains inside the court.
// They are intentionally slightly asymmetric to match the fixed broadcast perspective.
const PLAYER_LEFT_X=-4.25,PLAYER_RIGHT_X=4.45,PLAYER_NEAR_Z_MIN=.45;
function ballCanExitSide(b){
 if(!b||phase!=='rally'||b.lastHit!==1||Math.abs(b.vx)<.001)return false;
 const sx=b.vx<0?-COURT_X:COURT_X,t=(sx-b.x)/b.vx;
 if(!(t>0&&t<1.4))return false;
 const zAt=b.z+b.vz*t,hAt=b.h+b.vh*t-.5*G*t*t;
 return inDoorZ(zAt)||hAt>SIDE_GLASS_H;
}
function exteriorAccessOpen(team){
 if(!ball||phase!=='rally')return false;
 if(ballOutside(ball))return true;
 return team===0&&ballCanExitSide(ball);
}
function resolveActorMove(p,nx,nz,team){
 const ox=p.x,oz=p.z;let blockedX=false,blockedZ=false;
 nx=clamp(nx,-OUTER_X,OUTER_X);nz=clamp(nz,OUTER_Z_MIN,OUTER_Z_MAX);
 // During normal play the white player stays visually inside the playable floor.
 // Crossing toward the glass is only opened when an opponent ball is actually
 // leaving / already outside, and only while aligned with a real access opening.
 if(p===human&&!actorOutside(p)){
  const access=exteriorAccessOpen(team),doorApproach=access&&(inDoorZ(oz)||inDoorZ(nz));
  if(!doorApproach){nx=clamp(nx,PLAYER_LEFT_X,PLAYER_RIGHT_X);nz=Math.max(nz,PLAYER_NEAR_Z_MIN);}
 }
 // Long-side glass: crossing x=±5 is legal only through the access opening.
 for(const sx of [-COURT_X,COURT_X]){
  const crossed=(ox<sx&&nx>=sx)||(ox>sx&&nx<=sx);
  if(!crossed)continue;
  const den=nx-ox,t=Math.abs(den)<1e-8?0:(sx-ox)/den;
  const zCross=oz+(nz-oz)*clamp(t,0,1);
  const wasInside=Math.abs(ox)<COURT_X;
  const throughDoor=inDoorZ(zCross);
  const accessAllowed=p!==human||!wasInside||exteriorAccessOpen(team);
  if(!throughDoor||!accessAllowed){
   nx=sx+(wasInside?(sx>0?-.055:.055):(sx>0?.055:-.055));blockedX=true;
  }
 }
 // Inside the court the net still separates the two teams. Outside the glass
 // players can run alongside the net and reach the other side of the opening.
 if(Math.abs(nx)<COURT_X-.02){
  if(team===0&&nz>9.3){nz=9.3;blockedZ=true;}
  if(team===1&&nz<10.7){nz=10.7;blockedZ=true;}
 }
 return{x:nx,z:nz,blockedX,blockedZ};
}
function exteriorRoute(p,tx,tz,team){
 const pOut=actorOutside(p),tOut=Math.abs(tx)>COURT_X+.03;
 if(pOut===tOut)return{x:tx,z:tz};
 const side=tOut?(Math.sign(tx)||Math.sign(p.x)||1):(Math.sign(p.x)||Math.sign(tx)||1);
 const doorZ=team===0?9.05:10.95;
 // First line up with the door on the current side of the glass; once aligned,
 // cross the opening. No path can cut through glass.
 if(Math.abs(p.z-doorZ)>.34)return{x:side*(pOut?5.30:4.70),z:doorZ};
 return{x:side*(tOut?5.42:4.58),z:doorZ};
}
function crossing(a,b,boundary){
 if((a<boundary&&b>=boundary)||(a>boundary&&b<=boundary)){
  const den=b-a;return Math.abs(den)<1e-8?0:(boundary-a)/den;
 }
 return null;
}
function ensureExteriorClearance(b,p,flight){
 // A shot struck from outside must physically clear the enclosure unless its
 // path is aligned with the door. We only raise the vertical component; x/z aim
 // and all normal landing physics stay untouched.
 if(Math.abs(p.x)>COURT_X+.03&&Math.abs(b.vx)>.001){
  const sx=Math.sign(p.x)*COURT_X,t=(sx-b.x)/b.vx;
  if(t>0&&t<flight){
   const zAt=b.z+b.vz*t;
   if(!inDoorZ(zAt)){
    const need=(SIDE_GLASS_H+.16-b.h+.5*G*t*t)/t;
    if(Number.isFinite(need))b.vh=Math.max(b.vh,need);
   }
  }
 }
 if((p.z<0||p.z>20)&&Math.abs(b.vz)>.001){
  const sz=p.z<0?0:20,t=(sz-b.z)/b.vz;
  if(t>0&&t<flight){const need=(BACK_GLASS_H+.16-b.h+.5*G*t*t)/t;if(Number.isFinite(need))b.vh=Math.max(b.vh,need);}
 }
}

let phase='loading',paused=false,help=false,clock=0,last=0,server=0,scoreP=[0,0],games=[0,0],rally=0,pointDelay=0;
let ball=null,serveT=0,serveBounceT=0,queued=null,charging=null,steer=null,alert='',alertT=0,contactMsgT=0;
let hCool=0,rCool=0,robotServeTimer=0,robotThinking=0,robotCharge=0,boost=100,robotStamina=100,serveNumber=0,serveFaults=0;
let nextShotInfo='',lastBank='',pointInGame=0;
let nearServerMember=0,farServerMember=0,allyAttempted=false,allyServeTimer=0;
let teamHits=[0,0],lastInterception='';
let longestRally=0;
let lastLateralMode='',lateralNormal=0,lateralPower=0,powerBannerT=0,showShotStats=false;
const heldGlass=new Set();let glassComboUsed=false;
// A5.10: G is a timed defensive stance, not an auto-return. The ball must
// physically cross the raised-racket contact window while the stance is active.
let tapiaGuard=null;
// QA AUTO REAL: hidden F7 mode. The white player is driven by the same live
// simulation (movement, contacts, physics and scoring), so a full Career match
// can run unattended without faking points. State persists only to continue
// the same tournament between its seven matches.
const AUTO_REAL_STORE='padel-rally-auto-real-v1';
function readAutoReal(){try{if(typeof localStorage==='undefined')return null;const v=JSON.parse(localStorage.getItem(AUTO_REAL_STORE)||'null');return v&&typeof v==='object'?v:null;}catch(_){return null;}}
function saveAutoReal(enabled){try{if(typeof localStorage==='undefined')return;if(!enabled){localStorage.removeItem(AUTO_REAL_STORE);return;}localStorage.setItem(AUTO_REAL_STORE,JSON.stringify({enabled:true,tournament:careerTournament,format:matchFormat}));}catch(_){}}
const savedAutoReal=readAutoReal();
let autoReal=!!(careerMode&&savedAutoReal?.enabled&&Number(savedAutoReal.tournament)===careerTournament);
let autoServeTimer=0,autoHumanAttempted=false;
// Online: host owns all physics, rules and two rival AIs. Guest only sends input
// and renders host snapshots. Offline uses the A4.6 team-aware partner AI.
let netMode='offline',remoteActive=false,guestSnapshotSeq=-1,netHostPower=0,netRemotePower=0;
let remoteButtons={},remoteCharge=null,remoteQueued=null,remoteGlassCombo=false;
const remoteGlass=new Set();let remoteLastAim={dx:0,dz:0};
let audioEventSeq=0,lastRemoteAudioEvent=0;const audioEvents=[];

// A4.8 PILOTO DE VELOCIDADES: movement tempo and ball travel use separate multipliers.
// Keep approved ball tempo for all five modes while using naturally paced actors:
// Lento .81, Normal 1.00, Rapido 1.02, Muy Rapido 1.06, Extremo 1.08.
// Racket strokes, collision formulas, stamina rules and animation-distance cycles stay intact.
const tempos=[{name:'LENTO',scale:.81,ballScale:.81},{name:'NORMAL',scale:1.00,ballScale:1.05},
 {name:'RÁPIDO',scale:1.02,ballScale:1.32},{name:'MUY RÁPIDO',scale:1.06,ballScale:1.45},
 {name:'EXTREMO',scale:1.08,ballScale:1.584},{name:'TURBO',scale:1.08,ballScale:1.774},
 {name:'INSANO',scale:1.08,ballScale:2.04}];
const skillLevels=[
 {name:'FÁCIL',reaction:.50,speed:2.80,reach:1.00,miss:.40,aimError:1.30,low:.32,high:.63},
 {name:'MEDIO',reaction:.34,speed:3.58,reach:1.02,miss:.23,aimError:.80,low:.38,high:.72},
 {name:'DIFÍCIL',reaction:.20,speed:4.45,reach:1.04,miss:.10,aimError:.38,low:.44,high:.84},
 // Expert is harder through recognition, movement and placement, not invisible racket reach.
 {name:'EXPERTO',reaction:.155,speed:4.98,reach:1.06,miss:.06,aimError:.265,low:.49,high:.89}
];
// AI movement speed is difficulty-dependent, but robot sprite cadence is not.
const ROBOT_RUN_FPS=8;
// Robot rendering calibration only. These values never feed AI, contacts or physics.
// Global size makes far-court rivals easier to read; per-sprite anchors keep the
// planted foot / support point stable while changing poses.
const ROBOT_VISUAL_GLOBAL_SCALE=1.10;
const ROBOT_POSE_PREP_END=.24,ROBOT_POSE_IMPACT_END=.57;
const ROBOT_VISUAL_TUNE={
 'robot-backhand-followthrough-up':{ax:.396,ay:.990,scale:.98},
 'robot-backhand-prepare-clean-v2':{ax:.307,ay:.992,scale:1.01},
 'robot-backhand-up':{ax:.672,ay:.990,scale:.98},
 'robot-forehand-01':{ax:.490,ay:.992,scale:1.00},
 'robot-forehand-followthrough-up':{ax:.604,ay:.990,scale:.98},
 'robot-forehand-up':{ax:.329,ay:.990,scale:.98},
 'robot-move-left-01':{ax:.511,ay:.992,scale:1.00},
 'robot-move-left-02':{ax:.282,ay:.992,scale:1.02},
 'robot-move-right-01':{ax:.489,ay:.992,scale:1.00},
 'robot-move-right-02':{ax:.718,ay:.992,scale:1.02},
 'robot-ready-01':{ax:.510,ay:.992,scale:1.00},
 'robot-ready-02':{ax:.516,ay:.988,scale:1.00},
 'robot-ready-clean-v2':{ax:.419,ay:.992,scale:.97},
 'robot-ready-diagonal-left':{ax:.726,ay:.992,scale:1.02},
 'robot-ready-diagonal-right-01':{ax:.296,ay:.992,scale:1.01},
 'robot-ready-diagonal-right-02':{ax:.319,ay:.992,scale:1.00},
 'robot-ready-diagonal-right':{ax:.274,ay:.992,scale:1.02},
 'robot-run-left-01':{ax:.272,ay:.990,scale:1.03},
 'robot-run-left-02':{ax:.292,ay:.992,scale:1.03},
 'robot-run-right-01':{ax:.729,ay:.990,scale:1.03},
 'robot-run-right-02':{ax:.708,ay:.992,scale:1.03},
 'robot-slice-left':{ax:.537,ay:.992,scale:1.01},
 'robot-slice-rigth':{ax:.463,ay:.992,scale:1.01},
 'robot-stretching-left-2':{ax:.422,ay:.992,scale:1.01},
 'robot-stretching-left':{ax:.401,ay:.992,scale:1.01},
 'robot-stretching-right-2':{ax:.578,ay:.992,scale:1.01},
 'robot-stretching-right':{ax:.599,ay:.992,scale:1.01}
};
// Menu launcher: pass user selections to the exact same game engine.
// Direct game and online iframe retain the original defaults.
const menuQuery=gameQuery,fromMainMenu=menuQuery.get('fromMenu')==='1';
function menuChoice(key,maximum,defaultValue){
 const v=menuQuery.get(key);return v!==null&&/^\d+$/.test(v)?clamp(Number(v),0,maximum):defaultValue;
}
let tempoIndex=fromMainMenu?menuChoice('tempo',6,1):1;
let skillIndex=fromMainMenu?menuChoice('skill',3,1):1;
let ambientOn=fromMainMenu?menuQuery.get('ambiente')!=='0':true;
let sfxOn=fromMainMenu?menuQuery.get('efectos')!=='0':true;
let robotAttempted=false;
// Near-team court assignments and per-hit robot target telemetry.
let partnerLane=1,lastRobotTarget='',robotAimWhite=0,robotAimYellow=0;
// One designated returner per incoming shot; keep the decision stable.
let nearChaseBall=null,nearChaseOwner=null,nearChaseLockT=0,nearChaseSwitches=0;
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
const human={id:careerMode?careerPlayerName:quickPlayerName,team:0,x:-2.0,z:2.35,motion:'idle',previous:'idle',frameT:0,pose:0,moving:false,prevX:0,prevZ:0,vx:0,vz:0,cool:0,stridePhase:0,recoverT:0,savePoseT:0,saveFrame:0,visualFacing:'idle',visualPending:'',visualPendingT:0,visualIdleT:0,visualBlendT:0,visualFrom:null,visualExitT:0,jumpT:0,jumpDuration:.46};
const partner={id:careerMode?careerPartnerName:'ALIADO',team:0,x:2.0,z:4.0,motion:'idle',previous:'idle',frameT:0,pose:0,moving:false,dx:0,poseT:0,cool:0,stamina:100,thinking:0,charge:0,stridePhase:0,recoverT:0,splitStepT:0,splitArmed:true,visualSpeed:0,lean:0,visualFacing:'idle',visualPending:'',visualPendingT:0,visualIdleT:0,jumpT:0,jumpDuration:.42};
// 3v3 experimental actors. They reuse the approved yellow/robot visuals and the
// exact same ball/shot physics; only team composition and coverage are extended.
const partner2={id:'ALIADO 2',team:0,x:0,z:4.2,motion:'idle',previous:'idle',frameT:0,pose:0,moving:false,dx:0,poseT:0,cool:0,stamina:100,thinking:0,charge:0,stridePhase:0,recoverT:0,splitStepT:0,splitArmed:true,visualSpeed:0,lean:0,visualFacing:'idle',visualPending:'',visualPendingT:0,visualIdleT:0,jumpT:0,jumpDuration:.42};
const robot={id:careerMode?careerRival1:quickRival1,team:1,x:1.9,z:16.2,motion:'ready',frameT:0,pose:0,moving:false,dx:0,cool:0,thinking:0,charge:0,stamina:100};
const robot2={id:careerMode?careerRival2:quickRival2,team:1,x:-1.9,z:16.2,motion:'ready',frameT:0,pose:0,moving:false,dx:0,cool:0,thinking:0,charge:0,stamina:100};
const robot3={id:quickRival3,team:1,x:0,z:15.5,motion:'ready',frameT:0,pose:0,moving:false,dx:0,cool:0,thinking:0,charge:0,stamina:100};
const matchFormat=['1v1','2v2','2v1','1v2','3v3'].includes(requestedFormat)?requestedFormat:'2v2';
const is3v3=matchFormat==='3v3';
const nearHasPartner=matchFormat==='2v2'||matchFormat==='2v1'||is3v3;
const farHasRobot2=matchFormat==='2v2'||matchFormat==='1v2'||is3v3;
const members=[[human,...(nearHasPartner?[partner]:[]),...(is3v3?[partner2]:[])],[robot,...(farHasRobot2?[robot2]:[]),...(is3v3?[robot3]:[])]];
const activeActors=new Set([...members[0],...members[1]]);
function servingActor(who=server){const team=members[who];const idx=who===0?nearServerMember:farServerMember;return team[Math.min(idx,team.length-1)]||team[0];}
function teammates(who){return members[who];}

const images={},errors=[];let requested=0,loaded=0;
function load(path){if(images[path])return images[path];const im=new Image();requested++;images[path]=im;im.onload=()=>{loaded++;if(phase==='loading'&&loaded+errors.length===requested){phase='intro';message('Recursos listos',2);if(fromMainMenu)newMatch();}};im.onerror=()=>{errors.push(path);console.warn('Asset failed',path);if(phase==='loading'&&loaded+errors.length===requested){phase='intro';if(fromMainMenu)newMatch();}};im.src=path;return im;}
const courtAsset=menuQuery.get('court')||'assets/court_clean.png';load(courtAsset);for(const a of Object.values(assets.human))for(const s of a)load(s.src);for(const path of Object.values(assets.robot))load(path);for(const v of Object.values(yellow))load(v.src);if(a44Enabled)for(const v of Object.values(a44))load(v.src);
if(a45Enabled)for(const seq of Object.values(a45))for(const v of seq)load(v.src);
if(a48Enabled)for(const seq of Object.values(a48))for(const v of seq)load(v.src);
function message(t,secs=1.1){const important=/^(PUNTO|JUEGO|DOBLE PIQUE|DOBLE FALTA|PRIMER SAQUE|FALTA DE SAQUE|FUERA|RED|VIDRIO|PIQUE EN CAMPO|LA IA FALLÓ|COMPAÑERO FALLÓ|PARTIDO GANADO|PARTIDO PERDIDO)/.test(String(t));alert=t;alertT=Math.max(secs,important?2.45:secs);status.textContent=t;}
const label={forehand:'DERECHA',backhand:'REVÉS',lob:'GLOBO',smash:'REMATE',glass:'CONTRAPARED',drop:'DEJADA',tapia:'TAPIA',exit_x3:'X3',exit_x4:'X4'};
function Y(z){const v=[[0,811],[3,659],[10,487],[17,393],[20,353]];z=clamp(z,0,20);for(let i=1;i<v.length;i++)if(z<=v[i][0]){const f=(z-v[i-1][0])/(v[i][0]-v[i-1][0]);return v[i-1][1]+(v[i][1]-v[i-1][1])*f;}return 353;}
function halfWidth(z){const v=[[0,777],[3,619],[10,402],[17,272],[20,258]];z=clamp(z,0,20);for(let i=1;i<v.length;i++)if(z<=v[i][0]){const f=(z-v[i-1][0])/(v[i][0]-v[i-1][0]);return v[i-1][1]+(v[i][1]-v[i-1][1])*f;}return 258;}
function project(x,z,h=0){return{x:824+(x/5)*halfWidth(z),y:Y(z)-h*(82/(1+z*.075)),scale:1/(1+z*.075)};}
function readCareerStartEnergy(){
 if(!careerMode||typeof localStorage==='undefined')return{human:100,partner:100};
 try{const raw=JSON.parse(localStorage.getItem('padel-rally-career-v1')||'null'),e=raw?.energy?.[careerTournament];return{human:clamp(Number(e?.human)||100,35,100),partner:clamp(Number(e?.partner)||100,35,100)};}catch(_){return{human:100,partner:100};}
}
let careerEnergyStart=readCareerStartEnergy();
function resetPositions(){
 const side=pointInGame%2===0?1:-1;
 for(const p of [human,partner,partner2,robot,robot2,robot3]){p.pose=0;p.frameT=0;p.moving=false;p.dx=0;p.cool=0;p.thinking=0;p.charge=0;p.ivx=0;p.ivz=0;p.motion=p.team===0?'idle':'ready';p.robotVisualSpeed=0;p.robotVisualIntent='ready';p.robotVisualDir=0;p.robotVisualShot='';p.robotStretchT=0;p.robotStretchDir=0;p.robotLowContact=false;p.robotContactDir=0;}
 const ns=servingActor(0),fs=servingActor(1);
 const nf=members[0].find(x=>x!==ns)||null,ff=members[1].find(x=>x!==fs)||null;
 if(is3v3){
  // 3v3 uses a staggered 2+1 formation instead of three players in one line.
  // White + first ally behave as the normal doubles pair; the extra ally protects
  // the deep middle. The robots mirror the same idea: two forward, one deep.
  const nearFront=[human,partner],farFront=[robot,robot2];
  nearFront[0].x=-2.25;nearFront[0].z=4.95;
  nearFront[1].x= 2.25;nearFront[1].z=4.95;
  partner2.x=0;partner2.z=1.75;
  farFront[0].x=-2.25;farFront[0].z=14.85;
  farFront[1].x= 2.25;farFront[1].z=14.85;
  robot3.x=0;robot3.z=18.05;
  if(server===0){
   ns.x=side*2.25;ns.z=2.35;
   // Keep the non-serving member of the doubles pair on the opposite lane.
   const otherFront=nearFront.find(p=>p!==ns);
   if(otherFront){otherFront.x=-side*2.25;otherFront.z=4.95;}
  }else{
   fs.x=-side*2.15;fs.z=17.8;
   const otherFront=farFront.find(p=>p!==fs);
   if(otherFront){otherFront.x=side*2.25;otherFront.z=14.85;}
  }
 }else
 if(server===0){
  ns.x=side*2.25;ns.z=2.35;
  if(nf){nf.x=-side*2.3;nf.z=4.45;}
  if(farHasRobot2){robot.x=-2.15;robot.z=16.9;robot2.x=2.15;robot2.z=16.9;}
  else {robot.x=0;robot.z=16.9;}
 }else{
  if(nearHasPartner){human.x=2.25;human.z=2.95;partner.x=-2.25;partner.z=2.95;}
  else {human.x=0;human.z=2.95;}
  fs.x=-side*2.15;fs.z=17.8;
  if(ff){ff.x=side*2.1;ff.z=15.55;}
 }
 partnerLane=nearHasPartner?(partner.x>=0?1:-1):0;
 human.vx=0;human.vz=0;human.stridePhase=0;human.a45WasMoving=false;human.visualExitT=0;human.jumpT=0;human.recoverT=0;human.savePoseT=0;human.saveFrame=0;human.visualFacing='idle';human.visualPending='';human.visualPendingT=0;human.visualIdleT=0;human.visualBlendT=0;human.visualFrom=null;
 for(const p of [partner,partner2]){p.stridePhase=0;p.jumpT=0;p.recoverT=0;p.splitStepT=0;p.splitArmed=true;p.visualSpeed=0;p.lean=0;p.visualFacing='idle';p.visualPending='';p.visualPendingT=0;p.visualIdleT=0;}
 nearChaseBall=null;nearChaseOwner=null;nearChaseLockT=0;ball=null;queued=null;charging=null;steer=null;tapiaGuard=null;human.tapiaReadyT=0;hCool=0;rCool=0;robotServeTimer=0;robotThinking=0;robotCharge=0;contactMsgT=0;robotAttempted=false;allyAttempted=false;allyServeTimer=0;autoServeTimer=0;autoHumanAttempted=false;
}
function newMatch(){robotAimWhite=0;robotAimYellow=0;lastRobotTarget='';ensureAudio();server=0;nearServerMember=0;farServerMember=0;pointInGame=0;scoreP=[0,0];games=[0,0];rally=0;longestRally=0;serveFaults=0;robotAttempted=false;allyAttempted=false;careerEnergyStart=readCareerStartEnergy();boost=careerMode?careerEnergyStart.human:100;partner.stamina=careerMode?careerEnergyStart.partner:100;partner2.stamina=100;robot.stamina=100;robot2.stamina=100;robot3.stamina=100;robotStamina=100;paused=false;help=false;phase='serveReady';resetPositions();message((matchFormat==='2v2'?'DOBLES':matchFormat==='3v3'?'3 VS 3 · PRUEBA':matchFormat.toUpperCase())+' · TU SAQUE · MANTENÉ X O Z Y SOLTÁ',2);resumeAmbience();}
function start(){ensureAudio();if(phase==='loading')return;if(phase==='intro'){newMatch();return;}help=false;paused=false;message('JUGANDO',.5);}
function pause(){if(phase==='loading'||phase==='intro')return;help=false;paused=!paused;resumeAmbience();message(paused?'PAUSA':'JUGANDO',.7);}
function commands(){if(phase==='intro'){newMatch();}help=!help;paused=help;resumeAmbience();message(help?'COMANDOS':'JUGANDO',.3);}
function score(i){const a=scoreP[i],b=scoreP[1-i];if(a<=3)return ['0','15','30','40'][a];return a>b?'A':'40';}
function endPoint(winner,reason){if(phase==='pointEnd')return;
const failedServe=ball?.serveFlight&&winner===1-ball.lastHit;
if(failedServe&&serveFaults===0){fx('error');serveFaults=1;phase='pointEnd';pointDelay=1.10;ball=null;queued=null;charging=null;steer=null;message('PRIMER SAQUE FALLIDO · SEGUNDO SAQUE',1.25);return;}
if(failedServe&&serveFaults===1)reason='DOBLE FALTA';
longestRally=Math.max(longestRally,rally);fx(reason==='RED'?'red':'punto');serveFaults=0;phase='pointEnd';pointDelay=1.45;ball=null;queued=null;charging=null;steer=null;pointInGame++;scoreP[winner]++;if(scoreP[winner]>=4&&scoreP[winner]-scoreP[1-winner]>=2){games[winner]++;scoreP=[0,0];pointInGame=0;
 // Rotate the player who HAS JUST served, not the next server. The order is
 // white -> robot 1 -> yellow -> robot 2 (repeat within this set).
 if(server===0&&members[0].length>1)nearServerMember=(nearServerMember+1)%members[0].length;
 else if(server===1&&members[1].length>1)farServerMember=(farServerMember+1)%members[1].length;
 server=1-server;
 if(careerMode&&games[winner]>=2){finishCareerMatch(winner);return;}
 message((winner?'JUEGO IA':'JUEGO HUMANOS')+' · '+reason,1.8);}else message((winner?'PUNTO IA':'PUNTO HUMANO')+' · '+reason,1.5);}
function finishCareerMatch(winner){
 if(!careerMode||window.__careerFinishing)return;window.__careerFinishing=true;phase='pointEnd';pointDelay=99;ball=null;queued=null;charging=null;steer=null;
 const won=winner===0;message(won?'PARTIDO GANADO':'PARTIDO PERDIDO',2);
 try{
  const key='padel-rally-career-v1',base={won:[],rounds:{},formats:{},playerName:careerPlayerName,partnerName:careerPartnerName,racket:careerRacket,shoes:careerShoes,energy:{}},saved=JSON.parse(localStorage.getItem(key)||'null'),p=saved&&typeof saved==='object'?{...base,...saved}:base;
  p.won=Array.isArray(p.won)?p.won:[];p.rounds=p.rounds&&typeof p.rounds==='object'?p.rounds:{};p.formats=p.formats&&typeof p.formats==='object'?p.formats:{};p.energy=p.energy&&typeof p.energy==='object'?p.energy:{};
  if(won){
   if(careerRound>=7){if(!p.won.includes(careerTournament))p.won.push(careerTournament);p.rounds[careerTournament]=1;p.energy[careerTournament]={human:100,partner:100};}
   else {p.rounds[careerTournament]=careerRound+1;p.energy[careerTournament]={human:clamp(boost+16,35,100),partner:clamp((partner.stamina||100)+16,35,100)};}
  }else {p.rounds[careerTournament]=careerRound;p.energy[careerTournament]={human:clamp(boost+20,35,100),partner:clamp((partner.stamina||100)+20,35,100)};}
  if(!p.formats[careerTournament])p.formats[careerTournament]=matchFormat;
  if(!p.playerName)p.playerName=careerPlayerName;
  if(!p.partnerName)p.partnerName=careerPartnerName;
  if(!p.racket)p.racket=careerRacket;
  if(!p.shoes)p.shoes=careerShoes;
  localStorage.setItem(key,JSON.stringify(p));
 }catch(_){}
 setTimeout(()=>{location.href='carrera.html';},1800);
}
function makeBall(x,z,h,vx=0,vz=0,vh=0,hit=0){return{x,z,h,vx,vz,vh,lastHit:hit,bounces:0,wallOK:false,wallCount:0,age:0,serveFlight:false,serveSide:0,bank:false,bankRoute:null,bankStage:0,trail:[],netCrossed:false,serveReceiver:null,externalReturn:false,exitTest:null};}
function arrows(){return{dx:(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dz:(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0)};}
function aim(){let d=arrows();if(d.dx===0&&d.dz===0&&clock-lastArrow.t<.20)d={dx:lastArrow.dx,dz:lastArrow.dz};return d;}
function target(who,shot,aimDir){const near=who===0;
// Pick an actual intended receiver for each robot RETURN. A4.8 uses 55/45 as a
// probability per shot, not a forced sequence; teammate interceptions are
// decided separately. Both robots share this policy (all skill settings).
const selected=near?null:(members[0].length===1?human:(Math.random()<.45?human:members[0][1+Math.floor(Math.random()*(members[0].length-1))]));
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
function serveFaultRisk(who,power){
 let risk=.012;
 if(power<.28)risk+=( .28-power)*2.5;
 if(power>.82)risk+=(power-.82)*3.0;
 if(serveFaults===1)risk*=.42;
 if(who===1)risk*=[1.05,.80,.58,.42][skillIndex]||.8;
 else if(servingActor(0)!==human)risk*=.72;
 return clamp(risk,0,.72);
}
function aiServePower(){
 if(serveFaults===1)return random(.42,.67);
 const ranges=[[.34,.78],[.40,.83],[.46,.88],[.50,.91]],r=ranges[skillIndex]||ranges[1];return random(r[0],r[1]);
}
function finishServe(){if(!ball||phase!=='serveDrop')return;const b=ball,d=b.serveData,who=d.who,dir=who?-1:1;
// Fixed release position: a serve cannot teleport when the player moves.
b.x=d.x;b.z=d.z+dir*.36;b.h=.55;
let shotX=clamp(-d.side*(2.4+(d.aim.dx===-d.side?.5:0)), -3.4,3.4);
let landingZ=who?5.45:14.55;
const fault=Math.random()<serveFaultRisk(who,d.power);
if(fault){
 if(d.power<.28)landingZ=who?10.45:9.55; // demasiado corto: pica del lado del sacador
 else if(d.power>.82)landingZ=who?2.45:17.55; // demasiado largo
 else shotX=-shotX; // error lateral: cuadro equivocado
}else{
 const precision=who===1?[.24,.18,.12,.09][skillIndex]:(servingActor(0)===human?.13:.17);
 shotX=clamp(shotX+random(-precision,precision),-3.6,3.6);
 landingZ+=random(-precision*.65,precision*.65);
}
const landing={x:shotX,z:landingZ},flight=clamp(1.50-d.power*.31,1.12,1.50);
ballistic(b,landing,flight);
// On an opponent's serve, reserve the diagonal receiving court for its receiver.
// The AI teammate does not poach the designated player's serve.
b.serveReceiver=who===1?members[0].reduce((best,p)=>Math.abs(p.x-landing.x)<Math.abs(best.x-landing.x)?p:best,members[0][0]).id:null;
b.serveFlight=true;b.serveSide=d.side;b.lastVisualServeShot=d.visualShot||'forehand';b.serveData=null;b.bounces=0;b.lastHit=who;b.wallOK=false;b.age=0;b.netCrossed=false;b.trail=[];
phase='rally';rally=1;robotAttempted=false;allyAttempted=false;autoHumanAttempted=false;
fx('pala',{who,power:d.power,shot:'forehand'});
const serverActor=members[who].find(p=>p.id===d.actor)||servingActor(who);
serverActor.motion='forehand';serverActor.pose=.42;serverActor.frameT=0;serverActor.cool=.35;
if(serverActor===human)hCool=.35; if(serverActor===robot)rCool=.35;

message('SAQUE EJECUTADO',.5);}
function contactPossible(who,shot,actor=null){if(!ball||phase!=='rally'||ball.lastHit===who)return false;const p=actor||(who?robot:human);
// A serve must first bounce in the correct service box: no volleying the serve.
if(ball.serveFlight&&ball.bounces===0)return false;
const dx=ball.x-p.x,dz=ball.z-p.z;
const tapia=who===0&&p===human&&shot==='tapia';
const exitShot=who===0&&p===human&&(shot==='exit_x3'||shot==='exit_x4');
// Tapia: a deliberately small raised-racket window. G no longer gives the
// player a giant invisible ellipse. The racket is treated as being above and
// slightly behind the body while the player is turned away from the net.
if(tapia){
 if(!tapiaGuard||clock<tapiaGuard.activeFrom||clock>tapiaGuard.until)return false;
 const tdx=dx,tdz=dz-.22;
 const tapiaNorm=(tdx*tdx)/(1.12*1.12)+(tdz*tdz)/(.96*.96);
 if(tapiaNorm>1||ball.h<1.28||ball.h>3.05||p.cool>0||hCool>0)return false;
 return true;
}
// E uses essentially the normal physical reach. Difficulty / special-shot
// selection must never create a magical two-metre contact.
const baseReach=who?skillLevels[skillIndex].reach:1.88;
const rx=exitShot?1.90:baseReach,rz=exitShot?1.88:(who?skillLevels[skillIndex].reach:1.85);
const reachNorm=(dx*dx)/(rx*rx)+(dz*dz)/(rz*rz);
const maxH=exitShot?2.85:2.62;
if(reachNorm>1||ball.h<.13||ball.h>maxH||p.cool>0||(p===human?hCool:0)>0)return false;
if(shot==='smash'&&ball.h<1.32)return false;return true;}
function playHit(who,shot,power,bank=false,bankRoute='rear',actor=null,directionOverride=null){const p=actor||(who?robot:human);if(!contactPossible(who,shot,p))return false;const b=ball;
if(bank){
  const rear=bankRoute.startsWith('rear'),side=bankRoute==='left'||bankRoute==='right';
  const valid=who===0&&b.h<=1.85&&(rear?p.z<=5.3&&b.z<=5.75:side&&p.z<=7.7&&b.z<=8.0);
  if(!valid){message(rear?'ACERCATE AL VIDRIO TRASERO':'CONTRAPARED: POSICIÓN INCORRECTA',.85);return false;}
 }
const dx=b.x-p.x,dz=b.z-p.z,shotSide=shot==='forehand'?dx>=-.1:shot==='backhand'?dx<=.1:true;
const positioned=clamp(1-Math.max(0,hypot(dx,dz)-.5)*.17,.68,1),quality=(shotSide?1:.78)*positioned;
const powerC=clamp(power,.08,1),direction=who===0?(p===human?(directionOverride|| (autoReal?autoHumanAim():aim())):remoteActive?remoteAim():{dx:robot.x+robot2.x>=0?-1:1,dz:1}):{dx:0,dz:0};
const landing=target(who,shot,direction);
 if(who||(p.team===0&&p!==human&&!remoteActive)){const err=who?skillLevels[skillIndex].aimError:.56;landing.x+=random(-err,err);landing.z+=random(-err,err);}
// DEJADA: only effective from near the net. Very short, deliberately soft trajectory.
// Same collision/net physics as other strokes: it may hit the tape and fail.
if(shot==='drop'){
  const toward=who===0?1:-1;
  if(who===0?p.z<5.3:p.z>14.7){message('DEJADA: ACERCATE A LA RED',.8);return false;}
  landing.x=clamp(p.x+direction.dx*.95+(who?random(-.45,.45):0),-4.25,4.25);
  landing.z=who===0?random(11.15,12.15):random(7.85,8.85);
}

if(!bank){
 const exitShot=who===0&&p===human&&(shot==='exit_x3'||shot==='exit_x4');
 const tapia=who===0&&p===human&&shot==='tapia';
 // Any real contact that is not the original E attempt cancels its pending
 // exit state. This prevents a later opponent return from being misread as
 // the old X3/X4 and awarding the point to the human.
 if(!exitShot)b.exitTest=null;
 let flight;
 b.x=p.x+dx*.16;b.z=p.z+(who?-.48:.48);
 if(exitShot){
  // A5.10: E means INTENTAR una salida, never guarantee it. Contact quality is
  // deterministic: centred racket contact + useful ball height + being farther
  // forward make the post-bounce kick stronger. A mediocre attempt simply
  // stays in play or hits the enclosure under normal physics.
  const side=shot==='exit_x3'?(Math.sign(direction.dx)||Math.sign(b.x)||1):0;
  const contactNorm=Math.sqrt((dx*dx)/(1.90*1.90)+(dz*dz)/(1.88*1.88));
  const centreQ=clamp(1-contactNorm,0,1);
  const idealH=shot==='exit_x3'?1.62:1.82;
  const heightQ=clamp(1-Math.abs(b.h-idealH)/1.45,0,1);
  const courtQ=clamp((p.z-2.0)/6.2,0,1);
  const exitQ=clamp(.18+centreQ*.46+heightQ*.24+courtQ*.12,.12,1);
  if(shot==='exit_x3'){
   landing.x=side*(3.15+.42*exitQ);landing.z=15.25+.55*exitQ;flight=1.08-.08*exitQ;b.h=clamp(b.h,.62,1.95);
   b.exitTest={mode:'x3',side,quality:exitQ,launched:false,cleared:false,winT:0};
  }else{
   landing.x=clamp(direction.dx*1.10,-1.55,1.55);landing.z=16.25+.48*exitQ;flight=1.10-.08*exitQ;b.h=clamp(b.h,.70,2.05);
   b.exitTest={mode:'x4',side:Math.sign(direction.dx)||0,quality:exitQ,launched:false,cleared:false,winT:0};
  }
  ballistic(b,landing,flight);
 }else if(tapia){
  // Emergency block: redirect the incoming pace instead of manufacturing a
  // fixed-speed shot. Slow lobs therefore come back softly; a correctly timed
  // block against a missile can still produce a fast, spectacular return.
  const incomingSpeed=hypot(b.vx,b.vz);
  landing.x=clamp(p.x*.12+direction.dx*2.75,-3.85,3.85);
  landing.z=clamp(15.0+(direction.dz>0?1.8:direction.dz<0?-1.3:0),12.6,18.1);
  flight=clamp(1.72-incomingSpeed*.030,1.00,1.62);b.h=clamp(b.h,1.10,2.75);ballistic(b,landing,flight);
  tapiaGuard=null;human.tapiaReadyT=0;
 }else{
  const errorScale=(1-quality)*1.15+Math.max(0,powerC-.86)*5.4;
  landing.x+=random(-.32,.32)*errorScale;landing.z+=(who? -1:1)*Math.max(0,powerC-.9)*9;
  flight=shot==='lob'?2.22-powerC*.30:shot==='smash'?1.15-powerC*.42:1.79-powerC*.62;
  flight=clamp(flight/(.7+.3*quality),.74,2.6);
  b.h=clamp(b.h,shot==='smash'?1.35:.52,2.5);
  if(shot==='drop'){
   const distance=Math.abs(landing.z-b.z);
   flight=clamp(distance/(5.5+powerC*1.4),.72,1.3);
   b.h=clamp(b.h,.75,1.10);
  }
  ballistic(b,landing,flight);ensureExteriorClearance(b,p,flight);
 }
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
 nearChaseBall=null;nearChaseOwner=null;nearChaseLockT=0;
 b.externalReturn=actorOutside(p);
 b.serveReceiver=null;b.lastHit=who;b.lastActor=p.id;if(who===0)robotAttempted=false;else {allyAttempted=false;autoHumanAttempted=false;}b.bounces=0;b.wallCount=0;b.age=0;b.netCrossed=false;b.serveFlight=false;b.trail=[];
 if(p===human){human.visualBankRoute=bank?bankRoute:null;human.motion=bank?'glass':shot==='lob'||shot==='drop'?'forehand':shot==='tapia'?'backhand':shot==='exit_x3'||shot==='exit_x4'?'smash':shot;human.pose=bank?.55:shot==='tapia'?.62:.48;human.frameT=0;hCool=.31;human.cool=.31;
  if(!bank&&(shot==='smash'||shot==='exit_x3'||shot==='exit_x4')){human.jumpDuration=.46;human.jumpT=human.jumpDuration;human.visualExitT=0;}
  // Visual-only desperate reach: only after a VALID contact near the reach boundary.
  // No extra hit window, auto-save, ball boost or AI advantage.
  const stretch=hypot(dx,dz);const urgent=!bank&&shot!=='smash'&&stretch>=1.37;
  human.savePoseT=urgent?.14:0;
  human.saveFrame=shot==='backhand'?6:5;
  human.recoverT=0;
  steer=bank?null:{ref:b,until:clock+.13,vx:b.vx,vz:b.vz,base:direction};
  if(!bank||bankRoute==='rear'){
   if(shot==='tapia')message('TAPIA · BLOQUEO DE ESPALDAS',.95);
   else if(shot==='exit_x3')message('REMATE DE SALIDA · X3',.95);
   else if(shot==='exit_x4')message('REMATE DE SALIDA · X4',.95);
   else message((bank?({'rear':'FONDO','left':'LATERAL IZQ','right':'LATERAL DER','rear_left':'FONDO → IZQ','rear_right':'FONDO → DER'}[bankRoute]||'CONTRAPARED'):label[shot])+' · '+Math.round(powerC*100)+'%',.68);
  }
 }else{
  const nearAI=p.team===0;
  p.motion=nearAI?(bank?'glass':shot==='smash'?'smash':shot==='backhand'?'backhand':'forehand'):(shot==='backhand'?'backhand':'forehand');p.pose=.42;p.cool=.42;p.frameT=0;
  p.charge=powerC;
  if(nearAI&&!bank&&shot==='smash'){p.jumpDuration=.42;p.jumpT=p.jumpDuration;}
  if(p.team===1){
   robotThinking=0;robotCharge=powerC;
   // The contact is already valid here. These values only choose artwork,
   // so a stretching frame can never enlarge the robot's real racket reach.
   p.robotVisualShot=shot;
   p.robotContactDir=dx<0?-1:1;
   p.robotLowContact=b.h<.82&&shot!=='smash'&&shot!=='lob';
   const rr=skillLevels[skillIndex].reach||1,edgeNorm=Math.sqrt((dx*dx)/(rr*rr)+(dz*dz)/(rr*rr));
   p.robotStretchT=!bank&&shot!=='smash'&&edgeNorm>=.73?.16:0;
   p.robotStretchDir=dx<0?-1:1;
  }else {message('COMPAÑERO DEVUELVE · '+label[shot],.55);}
 }
 fx('pala',{who,power:powerC,shot});if(shot==='smash'&&powerC>.72&&Math.random()<.28)fx('reaccion',{who,power:powerC});rally++;return true;}
function queueShot(shot,power,shotAim=null){if(phase!=='rally'||!ball||ball.lastHit===0)return;
tapiaGuard=null;human.tapiaReadyT=0;queued={shot,power,aim:shotAim?{dx:shotAim.dx||0,dz:shotAim.dz||0}:null,expires:clock+1.48};attemptQueued();}
function attemptQueued(){if(!queued||phase!=='rally'||!ball||ball.lastHit===0)return;
if(queued.activeFrom&&clock<queued.activeFrom)return;
const attemptedShot=queued.shot;
if(playHit(0,queued.shot,queued.power,false,'rear',human,queued.aim)){queued=null;return;}
if(clock>queued.expires){queued=null;if(attemptedShot==='tapia'){tapiaGuard=null;human.tapiaReadyT=0;}if(contactMsgT<=0){fx('fallo');message(attemptedShot==='tapia'?'TAPIA · SIN CONTACTO':attemptedShot==='exit_x3'||attemptedShot==='exit_x4'?'REMATE DE SALIDA · NO LLEGASTE':'GOLPE FUERA DE ALCANCE',.62);contactMsgT=.9;}}}
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
 partner.cool=Math.max(0,partner.cool-dt);partner.pose=Math.max(0,partner.pose-dt);partner.jumpT=Math.max(0,(partner.jumpT||0)-dt);
 partner.frameT+=dt;partner.recoverT=Math.max(0,(partner.recoverT||0)-dt);partner.splitStepT=Math.max(0,(partner.splitStepT||0)-dt);
 if(oldPose>0&&partner.pose<=0)partner.recoverT=.18;
 if(phase==='serveDrop'&&ball?.serveData?.actor===partner.id)return;
 const b=remoteButtons,dx=Number(!!b.right)-Number(!!b.left),dz=Number(!!b.up)-Number(!!b.down),n=hypot(dx,dz);
 const sprint=b.sprint&&partner.stamina>7,speed=(sprint?7.05:5.06)*(.76+.24*clamp(partner.stamina/25,0,1));
 const step=n?Math.min(speed*dt,999)/n:0;
 {const mv=resolveActorMove(partner,partner.x+dx*step,partner.z+dz*step,0);partner.x=mv.x;partner.z=mv.z;}
 partner.moving=n>0;partner.dx=dx;
 const realDist=hypot(partner.x-oldX,partner.z-oldZ);partner.visualSpeed=dt>0?realDist/dt:0;
 if(partner.moving)partner.stridePhase=(partner.stridePhase+realDist*1.95)%4096;
 if(!partner.moving&&oldSpeed>.3&&partner.pose<=0)partner.recoverT=.17;
 partner.lean=clamp(dx*.055,-.075,.075);
 {const recovery=phase==='pointEnd'?4.0:1.8,drain=sprint?8.5:2.5;partner.stamina=clamp(partner.stamina+(n?-drain:recovery)*dt,0,100);}
 if(partner.pose<=0)partner.motion=n?(Math.abs(dx)>=Math.abs(dz)?dx>0?'run_right':'run_left':dz>0?'forward':'backward'):'idle';
 stabilizeYellowFacing(partner,dt);
 if(remoteQueued&&phase==='rally'&&ball&&ball.lastHit===1){
  if(playHit(0,remoteQueued.shot,remoteQueued.power,!!remoteQueued.bank,remoteQueued.route||'rear',partner)){
   remoteQueued=null;
  }else if(clock>remoteQueued.expires)remoteQueued=null;
 }else if(remoteQueued&&(!ball||phase!=='rally'||ball.lastHit!==1))remoteQueued=null;
}
function autoHumanAim(){
 const foes=members[1],avg=foes.reduce((sum,p)=>sum+p.x,0)/Math.max(1,foes.length);
 const dx=avg>.25?-1:avg<-.25?1:(ball?.x||0)>=0?-1:1;
 return{dx,dz:1};
}
function autoHumanMove(){
 let goX=nearHasPartner?-partnerLane*2.25:0,goZ=4.85;
 if(phase==='serveReady'||phase==='serveDrop')return{dx:0,dz:0,sprint:false};
 if(phase==='rally'&&ball&&ball.lastHit===1){
  let future=.12;
  if(ball.vz<-.08)future=clamp((4.9-ball.z)/ball.vz,.05,.88);
  const forecastX=clamp(ball.x+ball.vx*future,-4.30,4.30),forecastZ=clamp(ball.z+ball.vz*future,.70,9.05);
  const chaser=nearHasPartner?chooseNearChaser(forecastX,forecastZ,future):human;
  if(chaser===human){goX=forecastX;goZ=forecastZ;}
  else{goX=-partnerLane*2.25;goZ=clamp(partner.z>5.5?4.65:5.15,3.4,7.0);}
 }
 const dx=goX-human.x,dz=goZ-human.z,dist=hypot(dx,dz);
 return{dx:Math.abs(dx)>.08?dx:0,dz:Math.abs(dz)>.08?dz:0,sprint:dist>2.15&&boost>18};
}
function stepAutoHumanActions(dt){
 if(!autoReal||netMode!=='offline'||paused||phase==='loading'||phase==='intro')return;
 if(phase==='serveReady'&&server===0&&servingActor(0)===human){
  autoServeTimer+=dt;
  if(autoServeTimer>.82){autoServeTimer=0;startServe(0,serveFaults===1?random(.42,.66):random(.30,.90),autoHumanAim(),Math.random()<.22?'backhand':'forehand');}
 }else autoServeTimer=0;
 if(phase!=='rally'||!ball||ball.lastHit!==1||autoHumanAttempted)return;
 if(!contactPossible(0,'forehand',human))return;
 let shot=ball.x<human.x?'backhand':'forehand';
 const r=Math.random();
 if(ball.h>1.45&&r<.24&&contactPossible(0,'smash',human))shot='smash';
 else if(r<.16)shot='lob';
 else if(r>.94&&human.z>=5.3)shot='drop';
 autoHumanAttempted=true;
 if(Math.random()<.08){message('AUTO REAL · HUMANO FALLÓ',.45);return;}
 const power=shot==='lob'?random(.43,.63):shot==='drop'?random(.28,.46):shot==='smash'?random(.64,.84):random(.48,.76);
 if(!playHit(0,shot,power,false,'rear',human))autoHumanAttempted=false;
}
function setAutoReal(enabled){
 if(!careerMode){message('AUTO REAL: SOLO EN MODO CARRERA',1.2);return;}
 autoReal=!!enabled;keys.clear();heldGlass.clear();glassComboUsed=false;charging=null;queued=null;autoServeTimer=0;autoHumanAttempted=false;
 saveAutoReal(autoReal);
 if(autoReal){paused=false;help=false;resumeAmbience();message('QA · AUTO REAL ACTIVADO · F7 PARA DETENER',1.8);}
 else message('QA · AUTO REAL DESACTIVADO',1.3);
}
let exteriorTestSide=1;
function launchExteriorTestBall(){
 if(netMode!=='offline'||careerMode){message('X3 TEST: USALO EN JUEGO RÁPIDO',1);return;}
 exteriorTestSide*=-1;const side=exteriorTestSide;
 // Ball already bounced legally on the near side and is climbing over the 3 m
 // side enclosure. This is only a QA shortcut for testing door/exterior play.
 ball=makeBall(side*3.45,6.15,.48,side*1.75,-.18,9.80,1);ball.bounces=1;ball.wallOK=true;ball.age=.35;ball.serveFlight=false;ball.netCrossed=true;
 phase='rally';robotAttempted=true;allyAttempted=false;autoHumanAttempted=false;queued=null;charging=null;nearChaseBall=null;nearChaseOwner=null;
 message('EXTERIOR TEST · X3 HACIA '+(side<0?'IZQUIERDA':'DERECHA')+' · SALÍ POR LA PUERTA',1.5);
}
function queueTapiaTest(){
 if(phase!=='rally'||!ball||ball.lastHit===0){message('TAPIA: ESPERÁ UNA PELOTA RIVAL',.85);return;}
 // Short, player-controlled guard. Press too early / late and the ball simply
 // passes: no automatic save and no extended invisible reach.
 tapiaGuard={activeFrom:clock+.075,until:clock+.62};
 human.tapiaReadyT=.62;human.tapiaReadyTotal=.62;
 queued={shot:'tapia',power:.68,aim:aim(),activeFrom:tapiaGuard.activeFrom,expires:tapiaGuard.until};
 message('G · ESPALDA + PALA ARRIBA',.72);attemptQueued();
}
function queueExitTest(){
 if(phase!=='rally'||!ball||ball.lastHit===0){message('E: ESPERÁ UNA PELOTA RIVAL',.85);return;}
 const d=aim();
 // G = Tapia; E+left/right = intento X3; E+up (or E alone) = intento X4.
 const lateral=Math.abs(d.dx)>=Math.abs(d.dz)&&d.dx!==0;
 const shot=lateral?'exit_x3':'exit_x4';
 const forcedAim={dx:lateral?Math.sign(d.dx):d.dx,dz:lateral?0:1};
 tapiaGuard=null;human.tapiaReadyT=0;
 queued={shot,power:.88,aim:forcedAim,expires:clock+.72};
 message(lateral?('E · INTENTO X3 '+(forcedAim.dx<0?'IZQUIERDA':'DERECHA')):'E · INTENTO X4 POR EL FONDO',.8);attemptQueued();
}
const strokeKeys={KeyZ:'backhand',KeyX:'forehand',KeyC:'lob',Space:'smash',KeyV:'drop'};
const activeCodes=new Set(['F6','F7','F8','KeyF','KeyG','KeyE','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','KeyM','KeyN','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyZ','KeyX','KeyC','KeyV','Space','KeyS','KeyA','KeyD','KeyP','ShiftLeft','ShiftRight','Escape','Enter']);
function down(e){const code=window.PadelControls?.toLegacy(e.code)||e.code;if(window.PadelControls?.visible())return;if(netMode==='guest'){if(activeCodes.has(code)){e.preventDefault();window.parent?.postMessage({type:'padel-key',code:e.code,down:true},'*');}return;}if(activeCodes.has(code))e.preventDefault();if(e.repeat)return;if(code==='F6'){launchExteriorTestBall();return;}if(code==='F7'){setAutoReal(!autoReal);return;}if(code==='F8'){showShotStats=!showShotStats;message(showShotStats?'CONTADOR DE CONTRAPAREDES: ON':'CONTADOR DE CONTRAPAREDES: OFF',1);return;}ensureAudio();keys.add(code);
if(code.startsWith('Arrow')){const a=arrows();lastArrow.dx=a.dx;lastArrow.dz=a.dz;lastArrow.t=clock;}
if(code==='KeyF'){toggleFullscreen();return;}
if(code==='Escape'){if(help){help=false;paused=false;}else pause();return;}
if(code==='KeyP'){pause();return;}
if(code==='Enter'){if(phase==='intro')newMatch();else if(paused){paused=false;help=false;resumeAmbience();}return;}
 if((phase==='intro'||help||paused)&&!e.repeat){if(!careerMode&&['Digit1','Digit2','Digit3'].includes(code)){tempoIndex=Number(code.slice(-1))-1;return;}if(!careerMode&&['Digit8','Digit9'].includes(code)){tempoIndex=Number(code.slice(-1))-5;return;}if(!careerMode&&['Digit4','Digit5','Digit6','Digit7'].includes(code)){skillIndex=Number(code.slice(-1))-4;return;}if(code==='KeyM'){ambientOn=!ambientOn;resumeAmbience();return;}if(code==='KeyN'){sfxOn=!sfxOn;return;}}
if(paused||phase==='loading'||phase==='intro')return;
if(code==='KeyG'){queueTapiaTest();return;}
if(code==='KeyE'){queueExitTest();return;}
if(glassCode[code]){glassDown(code);return;}
if(strokeKeys[code]){if(phase==='intro')newMatch();charging={code:code,shot:strokeKeys[code],started:clock};}
}
function up(e){const code=window.PadelControls?.toLegacy(e.code)||e.code;if(window.PadelControls?.visible())return;if(netMode==='guest'){if(activeCodes.has(code)){e.preventDefault();window.parent?.postMessage({type:'padel-key',code:e.code,down:false},'*');}return;}keys.delete(code);if(glassCode[code]){glassUp(code);return;}if(code.startsWith('Arrow')){const a=arrows();if(a.dx||a.dz){lastArrow.dx=a.dx;lastArrow.dz=a.dz;lastArrow.t=clock;}}
if(!charging||charging.code!==code)return;
const c=charging;charging=null;if(paused)return;const power=clamp((clock-c.started)/1.15,.14,1);
if(phase==='serveReady'){if(server===0&&servingActor(0)===human&&c.shot!=='smash'&&c.shot!=='lob'){startServe(0,power,aim(),c.shot);}else if(server===0)message('SAQUE BAJO: Z O X',.85);return;}
if(phase==='rally')queueShot(c.shot,power,aim());
}
function toggleFullscreen(){try{const el=document.querySelector('main');if(document.fullscreenElement)document.exitFullscreen();else el.requestFullscreen();}catch(_){message('PANTALLA COMPLETA NO DISPONIBLE',1);}}
window.addEventListener('keydown',down);window.addEventListener('keyup',up);
window.addEventListener('blur',()=>{keys.clear();heldGlass.clear();glassComboUsed=false;charging=null;if(!autoReal&&netMode==='offline'&&phase!=='intro')paused=true;});
// Settings operate on the pause/start overlay, never over live court play.
function settingsClick(x,y){
 if(!careerMode&&y>=304&&y<=350){const bw=88,gap=7,start=505;for(let i=0;i<tempos.length;i++){const bx=start+i*(bw+gap);if(x>=bx&&x<=bx+bw){tempoIndex=i;return true;}}}
 if(!careerMode&&x>=617&&x<1061&&y>=376&&y<=422){skillIndex=clamp(Math.floor((x-619)/112),0,3);return true;}
 if(x>=615&&x<=831&&y>=459&&y<=509){ambientOn=!ambientOn;resumeAmbience();return true;}
 if(x>=847&&x<=1066&&y>=459&&y<=509){sfxOn=!sfxOn;return true;}
 return false;
}
canvas.addEventListener('pointerdown',e=>{if(netMode==='guest')return;ensureAudio();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*(W/r.width),y=(e.clientY-r.top)*(H/r.height);
 if(phase==='intro'||paused||help){if(settingsClick(x,y)){canvas.focus();return;}if(x>=696&&x<=973&&y>=653&&y<=711){if(phase==='intro')newMatch();else{help=false;paused=false;resumeAmbience();message('JUGANDO',.5);}canvas.focus();return;}canvas.focus();return;}
 if(y>=900&&y<=932&&x>=676&&x<=996){if(x<828)pause();else if(x>=845)newMatch();}
 else if(paused)pause();canvas.focus();});
// A4.3: White player's facing is visual only; inputs, speed, physics and
// collision remain authoritative from the original A4.2 simulation.
const whiteRunCycles={
 run_left:[0,1,4,5,4,1],
 run_right:[0,2,4,3,4,2],
 forward:[1,3,2,3,1,2],
 backward:[1,2,3,4,3,2]
};
// A4.8 — The user's approved sequences are individually ordered; no mirroring.
function whiteRunFrame(facing){
 const seq=a48Enabled?({diag_up_right:a48.white_diag_right,diag_up_left:a48.white_diag_left,
   forward:a48.white_up,backward:a48.white_down}[facing]||null):null;
 if(seq?.length){
  const step=Math.floor(human.stridePhase);
  const index=human.visualExitT>0?Math.min(seq.length-1,step%seq.length):step%seq.length;
  return seq[index];
 }
 const custom=a45Enabled?(facing==='run_left'?a45.white_left:facing==='run_right'?a45.white_right:null):null;
 if(custom?.length){
  if(human.visualExitT>0)return custom[custom.length-1];
  const step=Math.floor(human.stridePhase);
  const pattern=facing==='run_left'?[0,1,2,3,4,3,2,1]:[0,1,2,3,4,5,4,3,2,1];
  return custom[pattern[step%pattern.length]];
 }
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
 // Diagonal upward movement uses approved five/six-frame sequences.
 // Retreat diagonally keeps the short, facing-net backward footwork instead of
 // pretending to sprint forward. The world-space movement is unchanged.
 const ratio=az>0.01?ax/az:999;
 const oldDiag=old==='diag_up_left'||old==='diag_up_right';
 const diagUp=vz>0&&ax>.38&&az>.38&&(oldDiag?ratio>.36&&ratio<2.65:ratio>.52&&ratio<2.15);
 const lateral=old==='run_left'||old==='run_right';
 const side=lateral?ax>=az*.82:ax>az*1.18;
 const candidate=diagUp?(vx>0?'diag_up_right':'diag_up_left'):
  (vz<0&&ratio>.37&&ratio<2.25)?'backward':
  side?(vx>0?'run_right':'run_left'):(vz>0?'forward':'backward');
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
  human.visualFrom=null;human.visualBlendT=0;
  human.visualFacing=candidate;human.visualExitT=0;
  // Preserve gait phase while changing directions; no animation restart on every diagonal.
  human.visualPending='';human.visualPendingT=0;
 }
}
function stepHuman(dt){human.pose=Math.max(0,human.pose-dt);human.frameT+=dt;human.jumpT=Math.max(0,(human.jumpT||0)-dt);human.visualExitT=Math.max(0,(human.visualExitT||0)-dt);
 human.tapiaReadyT=Math.max(0,(human.tapiaReadyT||0)-dt);
 if(tapiaGuard&&clock>tapiaGuard.until){tapiaGuard=null;human.tapiaReadyT=0;}
 human.savePoseT=Math.max(0,human.savePoseT-dt);
 human.recoverT=Math.max(0,human.recoverT-dt);
if(phase==='serveDrop'&&ball&&ball.serveData?.actor===human.id){human.moving=false;return;}
const priorSpeed=hypot(human.vx,human.vz),oldX=human.x,oldZ=human.z;
const a=autoReal?autoHumanMove():arrows(),n=hypot(a.dx,a.dz);const sprint=autoReal?!!a.sprint:(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&boost>8;
const exhausted=.76+.24*clamp(boost/25,0,1),outsideSpeed=actorOutside(human)?1.30:1,speed=(sprint?7.15:5.15)*exhausted*outsideSpeed;
// Smooth, responsive acceleration and deceleration in court metres/second.
const wantX=n?a.dx/n*speed:0,wantZ=n?a.dz/n*speed:0;
const blend=1-Math.exp(-(specialMode==='arctic'?(n?5.2:2.6):(n?14.5:19.0))*dt);
human.vx+=(wantX-human.vx)*blend;human.vz+=(wantZ-human.vz)*blend;
if(Math.abs(human.vx)<.04)human.vx=0;if(Math.abs(human.vz)<.04)human.vz=0;
{const mv=resolveActorMove(human,human.x+human.vx*dt,human.z+human.vz*dt,0);human.x=mv.x;human.z=mv.z;if(mv.blockedX)human.vx=0;if(mv.blockedZ)human.vz=0;}
const wasMoving=human.a45WasMoving===true;
const distance=hypot(human.x-oldX,human.z-oldZ);
const actualSpeed=dt>0?distance/dt:0;
 human.moving=actualSpeed>.22;
 if(a45Enabled&&human.moving&&!human.a45WasMoving)human.stridePhase=0;
 human.a45WasMoving=human.moving;
 // Bind steps to ground distance, not a fixed FPS. Stops slide/cadence mismatch.
 if(human.moving)human.stridePhase=(human.stridePhase+distance*1.65)%4096;
 // A small planted-foot settling pose when braking, without changing physics.
 if(!human.moving&&wasMoving&&human.pose<=0){human.recoverT=.17;human.visualExitT=.13;}
if(human.moving&&clock-lastStepAt>.32&&phase==='rally'&&hypot(human.vx,human.vz)>3.1){lastStepAt=clock;fx('pasos');}
if(human.moving){const motion=Math.abs(human.vx)>Math.abs(human.vz)*.65?(human.vx>0?'run_right':'run_left'):(human.vz>0?'forward':'backward');
if(human.previous!==motion){human.previous=motion;if(human.pose===0)human.frameT=0;}if(human.pose===0)human.motion=motion;
}else if(human.pose===0)human.motion='idle';
stabilizeWhiteFacing(dt);
{const recovery=phase==='pointEnd'?4.0:1.8,drain=sprint?8.5:2.5;boost=clamp(boost+(n?-drain:recovery)*dt,0,100);}
if(human.pose===0&&ball&&phase==='rally'&&ball.lastHit===1&&ball.wallCount>0&&ball.z<3.4&&ball.vz>0&&!human.moving)human.motion='glass';}
// Preserve a stable home side until white *actually* crosses into the
// opposite sector. Unlike an immediate x-sign check this avoids lane flicker.
function updatePartnerLane(){
 if(!nearHasPartner)return;
 if(partnerLane===1&&human.x>1.35)partnerLane=-1;
 else if(partnerLane===-1&&human.x< -1.35)partnerLane=1;
}
function chooseNearChaser(x,z,arrival){
 if(!nearHasPartner)return human;
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
 // 3v3 needs pairwise body separation. The human keeps priority: when an AI
 // overlaps P1, the AI yields; AI-vs-AI pairs share the correction.
 for(const team of [0,1]){
  const roster=members[team];
  for(let i=0;i<roster.length;i++)for(let j=i+1;j<roster.length;j++){
   const a=roster[i],b=roster[j],minDist=is3v3?.98:.86;
   let dx=b.x-a.x,dz=b.z-a.z,dist=hypot(dx,dz);
   if(dist>=minDist)continue;
   if(dist<.0001){dx=(j-i)%2?1:-1;dz=0;dist=1;}else{dx/=dist;dz/=dist;}
   const overlap=minDist-dist,near=team===0,zmin=near?.45:10.7,zmax=near?9.3:19.45;
   if(a===human){const m=resolveActorMove(b,b.x+dx*overlap,b.z+dz*overlap,team);b.x=m.x;b.z=m.z;}
   else if(b===human){const m=resolveActorMove(a,a.x-dx*overlap,a.z-dz*overlap,team);a.x=m.x;a.z=m.z;}
   else{
    const ma=resolveActorMove(a,a.x-dx*overlap*.5,a.z-dz*overlap*.5,team),mb=resolveActorMove(b,b.x+dx*overlap*.5,b.z+dz*overlap*.5,team);
    a.x=ma.x;a.z=ma.z;b.x=mb.x;b.z=mb.z;
   }
  }
 }
}
function stepDoublesAI(dt){
 updatePartnerLane();
 for(const p of [partner,partner2,robot,robot2,robot3]){if(!activeActors.has(p)||(p===partner&&remoteActive))continue;const oldPose=p.pose;p.cool=Math.max(0,p.cool-dt);p.pose=Math.max(0,p.pose-dt);if(p.team===0&&p!==human)p.jumpT=Math.max(0,(p.jumpT||0)-dt);if(p.team===1)p.robotStretchT=Math.max(0,(p.robotStretchT||0)-dt);if(p.pose<=0)p.charge=0;
  if(p.team===0&&p!==human){p.frameT+=dt;p.recoverT=Math.max(0,(p.recoverT||0)-dt);p.splitStepT=Math.max(0,(p.splitStepT||0)-dt);if(oldPose>0&&p.pose<=0)p.recoverT=.18;}
 }
 const owner=servingActor();
 if(phase==='serveDrop'&&ball?.serveData?.actor===owner.id){owner.moving=false;}
 if(phase==='serveReady'&&server===1){robotServeTimer+=dt;if(robotServeTimer>.95){startServe(1,aiServePower(),{dx:0,dz:1});robotServeTimer=0;}}
 if(!remoteActive&&phase==='serveReady'&&server===0&&servingActor(0)!==human){allyServeTimer+=dt;if(allyServeTimer>.95){startServe(0,serveFaults===1?random(.43,.64):random(.38,.82),{dx:0,dz:1});allyServeTimer=0;}}
 const botSkill=skillLevels[skillIndex];
 for(const team of [0,1]){
  const ais=team===0?(nearHasPartner?members[0].filter(p=>p!==human&&!(remoteActive&&p===partner)):[]):members[1], defending=phase==='rally'&&ball&&ball.lastHit!==team;
  // A5.10.1: E is only an attempt. Rivals defend it normally while the ball
  // remains playable inside the court; only a physically completed X3/X4 ends the point.
  const incoming=defending?ball:null;
  const future=incoming?clamp((team===0?5.2-incoming.z:15.8-incoming.z)/(incoming.vz||1),.06,.85):0;
  const incomingOut=incoming&&Math.abs(incoming.x)>COURT_X+.03;
  const forecastX=incoming?clamp(incoming.x+incoming.vx*future,incomingOut?-OUTER_X+.15:-4.35,incomingOut?OUTER_X-.15:4.35):0;
  const forecastZ=incoming?clamp(incoming.z+incoming.vz*future,incomingOut?OUTER_Z_MIN:team===0?.8:11.15,incomingOut?OUTER_Z_MAX:team===0?9.3:18.9):0;
  let chaser=null;
  if(incoming){const participants=members[team];
   chaser=team===0&&incoming.serveReceiver?participants.find(p=>p.id===incoming.serveReceiver):null;
   if(!chaser){
    if(team===0&&!remoteActive&&nearHasPartner&&!is3v3){
     const candidate=chooseNearChaser(forecastX,forecastZ,future);
     if(nearChaseBall!==incoming){nearChaseBall=incoming;nearChaseOwner=candidate;nearChaseLockT=clock;}
     // Resist re-planning at every frame. Yellow gives way once white can
     // cover the ball; yellow may still rescue a clearly unreachable return.
     else if(candidate!==nearChaseOwner&&clock-nearChaseLockT>.24){
      const hd=hypot(forecastX-human.x,forecastZ-human.z);
      const whiteReach=1.88+5.15*clamp(future+.22,.20,1.10);
      const inWhiteLane=(forecastX*partnerLane<=.48);
      if(candidate===human&&(inWhiteLane||hd<whiteReach*.85)||
         candidate===partner&&hd>whiteReach+1.15){
       nearChaseOwner=candidate;nearChaseLockT=clock;nearChaseSwitches++;
      }
     }
     chaser=nearChaseOwner;
    }else chaser=participants.reduce((best,p)=>{
     const d=hypot(forecastX-p.x,forecastZ-p.z);
     return (!best||d<best.d)?{p,d}:best;
    },null).p;
   }
  }
  for(const p of ais){
   const roster=members[team],idx=roster.indexOf(p),homeXs=roster.length>=3?[-2.75,0,2.75]:roster.length===2?[-2.35,2.35]:[0];
   let goX=homeXs[Math.max(0,idx)]??0,goZ=team===0?(idx===1&&roster.length>=3?4.35:4.95):(idx===1&&roster.length>=3?15.35:15.0);
   if(is3v3){
    // Staggered 2+1 homes during rallies. Near side keeps the approved doubles
    // behaviour for white + ally; the third player sweeps the deep middle.
    if(team===0){
     if(p===partner){goX=partnerLane*2.35;goZ=5.15;}
     else if(p===partner2){
      const guide=incoming?forecastX:(ball?.x||0);
      goX=clamp(guide*.24,-1.05,1.05);goZ=2.05;
     }
    }else{
     if(p===robot){goX=-2.35;goZ=14.7;}
     else if(p===robot2){goX=2.35;goZ=14.7;}
     else if(p===robot3){
      const guide=incoming?forecastX:(ball?.x||0);
      goX=clamp(guide*.24,-1.05,1.05);goZ=17.75;
     }
     // If one forward robot claims the ball, its partner opens the lane instead
     // of following it, preserving a visible doubles-style front pair.
     if(chaser===robot&&p===robot2){goX=2.65;goZ=14.55;}
     else if(chaser===robot2&&p===robot){goX=-2.65;goZ=14.55;}
    }
   }
   if(phase==='serveReady'||phase==='serveDrop'){goX=p.x;goZ=p.z;}
   else if(defending&&p===chaser){p.thinking+=dt;
    const delay=team===0?.28:botSkill.reaction;
    if(p.thinking>=delay){goX=forecastX;goZ=forecastZ;}else {goX=p.x;goZ=p.z;}
   }else{
    p.thinking=0;
    // Hold a readable lane when not chasing. In 3v3 this prevents all three
    // AIs collapsing onto the same ball while still allowing the nearest one out.
    if(!is3v3&&roster.length===2){
     const teammate=roster.find(v=>v!==p);
     goX=team===0?partnerLane*2.35:(teammate.x<0?2.3:-2.3);
     goZ=team===0?clamp(teammate.z>5.5?4.85:5.20,3.3,7.4):(teammate.z<14?15.4:14.55);
    }
   }
   if(p===owner&&phase==='serveDrop'){goX=p.x;goZ=p.z;}
   {const routed=exteriorRoute(p,goX,goZ,team);goX=routed.x;goZ=routed.z;}
   const dx=goX-p.x,dz=goZ-p.z,len=hypot(dx,dz),baseSpeed=team===0?3.62:botSkill.speed,staminaFactor=.86+.14*clamp((p.stamina||100)/35,0,1),speed=baseSpeed*staminaFactor;
   const prevMoving=p.moving,prevSpeed=p.team===0&&p!==human?p.visualSpeed||0:0,oldX=p.x,oldZ=p.z;
   p.dx=dx;p.moving=len>.17;
   if(specialMode==='arctic'){
    const desiredX=len>.17?dx/len*speed:0,desiredZ=len>.17?dz/len*speed:0,iceBlend=1-Math.exp(-(len>.17?4.3:2.2)*dt);
    p.ivx=(p.ivx||0)+(desiredX-(p.ivx||0))*iceBlend;p.ivz=(p.ivz||0)+(desiredZ-(p.ivz||0))*iceBlend;
    if(Math.abs(p.ivx)<.025)p.ivx=0;if(Math.abs(p.ivz)<.025)p.ivz=0;
    {const mv=resolveActorMove(p,p.x+p.ivx*dt,p.z+p.ivz*dt,team);p.x=mv.x;p.z=mv.z;if(mv.blockedX)p.ivx=0;if(mv.blockedZ)p.ivz=0;}
    p.moving=hypot(p.ivx,p.ivz)>.18;if(p.team===1)p.frameT+=dt;
    p.stamina=clamp(p.stamina+(p.moving?-2.2:(phase==='pointEnd'?3.5:1.6))*dt,0,100);
   }else if(len>.17){const move=Math.min(len,speed*dt),mv=resolveActorMove(p,p.x+dx/len*move,p.z+dz/len*move,team);p.x=mv.x;p.z=mv.z;if(p.team===1)p.frameT+=dt;p.stamina=clamp(p.stamina-2.2*dt,0,100);}
   else p.stamina=clamp(p.stamina+(phase==='pointEnd'?3.5:1.6)*dt,0,100);
   if(p.team===1){
    // Visual locomotion only: derive animation from movement the AI already executed.
    // This never changes destination, speed, reach, hit timing or physics.
    const travelled=hypot(p.x-oldX,p.z-oldZ),oldScreen=project(oldX,oldZ),newScreen=project(p.x,p.z),screenDx=newScreen.x-oldScreen.x;
    p.robotVisualSpeed=dt>0?travelled/dt:0;
    p.robotVisualDir=Math.abs(screenDx)>.12?Math.sign(screenDx):(Math.abs(dx)>.06?Math.sign(dx):(p.robotVisualDir||(p.x<0?-1:1)));
    const mostlyDepth=Math.abs(dz)>Math.abs(dx)*1.18;
    p.robotVisualIntent=p.moving?((incoming&&chaser===p)||len>1.15?'run':mostlyDepth?'shuffle':'move'):'ready';
   }
   if(p.team===0&&p!==human){
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
   if(p.team===0&&p!==human&&!incoming.serveReceiver&&incoming.h<=1.80&&Math.random()<.23){
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
 const farBots=members[1];robotStamina=farBots.reduce((a,p)=>a+(p.stamina||0),0)/farBots.length;
 robotCharge=Math.max(...farBots.map(p=>p.charge||0));
}
function updateBall(dt){if(!ball)return;const b=ball;b.age+=dt;
if(phase==='serveDrop'){serveT+=dt;b.vh-=G*dt;b.h+=b.vh*dt;
 if(b.h<=0&&serveBounceT===0){b.h=0;b.vh=2.8;serveBounceT=serveT;}
 if(serveBounceT>0&&serveT-serveBounceT>.17){finishServe();}return;}
if(phase!=='rally')return;
const old={x:b.x,z:b.z,h:b.h};b.trail.push(project(b.x,b.z,b.h));const trailMax=specialMode==='cyber'?18:specialMode==='neon'?14:7;if(b.trail.length>trailMax)b.trail.shift();
b.vh-=G*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.h+=b.vh*dt;
// Wall physics uses velocity reflection. Bank shots are not teleported to a chosen spot.
if(b.bankRoute?.startsWith('rear')&&b.bankStage===0&&b.z<=0&&b.vz<0){
 fx('vidrio',{who:0});b.z=-b.z;b.vz=Math.abs(b.vz)*.78;b.vx*=.92;b.vh*=.95;
 b.bankStage=b.bankRoute==='rear'?2:1;b.bank=b.bankStage!==2;
 b.wallCount++;lastBank='FONDO';message(b.bank?'FONDO · BUSCANDO LATERAL':'REBOTE CONTRAPARED',.54);
}
// The net has height ~0.88m. Interpolate actual crossing instead of testing frame endpoint.
if((old.z-NET_Z)*(b.z-NET_Z)<=0&&!b.netCrossed){const ratio=(NET_Z-old.z)/(b.z-old.z||1),height=old.h+(b.h-old.h)*ratio,xAt=old.x+(b.x-old.x)*ratio;if(Math.abs(xAt)<=COURT_X){b.netCrossed=true;if(height<.90){endPoint(1-b.lastHit,'RED');return;}}}
// Shots hitting any wall before bouncing on the opponent's floor are faults.
const xOut=Math.abs(b.x)>5,zOut=b.z<0||b.z>20;
if((xOut||zOut)&&!b.wallOK&&!b.bank&&!b.externalReturn){endPoint(1-b.lastHit,'VIDRIO ANTES DEL PIQUE');return;}
if(b.h<=0){const side=b.z<10?0:1;
if(Math.abs(b.x)>5||b.z<0||b.z>20){endPoint(b.externalReturn?1-b.lastHit:(b.wallOK?b.lastHit:1-b.lastHit),b.externalReturn?'DEVOLUCIÓN EXTERIOR FALLIDA':'FUERA');return;}
if(side===b.lastHit&&b.bounces===0){endPoint(1-b.lastHit,'PIQUE EN CAMPO PROPIO');return;}
if(b.serveFlight&&b.bounces===0){const validBox=b.lastHit===0?(b.z>=10&&b.z<=17):(b.z>=3&&b.z<=10);
const validDiagonal=Math.sign(b.x)===-b.serveSide;
if(!validBox||!validDiagonal){endPoint(1-b.lastHit,'FALTA DE SAQUE');return;}b.serveFlight=false;}
fx('pique',{who:side});b.bounces++;b.h=0;if(b.bounces>=2){endPoint(b.lastHit,'DOBLE PIQUE');return;}
b.vh=Math.max(1.7,Math.abs(b.vh)*.69);b.vz*=.81;b.vx*=.88;b.wallOK=true;
if(b.exitTest&&b.lastHit===0&&b.bounces===1&&side===1&&!b.exitTest.launched){
 b.exitTest.launched=true;
 const q=clamp(b.exitTest.quality??.5,0,1);
 if(b.exitTest.mode==='x3'){
  b.vx=b.exitTest.side*(1.18+2.45*q);b.vz=.72+.72*q;b.vh=4.75+5.15*q;
 }else{
  b.vx=(b.exitTest.side||0)*(.18+.28*q);b.vz=2.65+3.25*q;b.vh=6.05+4.85*q;
 }
 message((b.exitTest.mode==='x3'?'X3':'X4')+' · INTENTO DE SALIDA',.72);
}}

for(const sx of [-COURT_X,COURT_X]){const t=crossing(old.x,b.x,sx);if(t===null)continue;const zAt=old.z+(b.z-old.z)*t,hAt=old.h+(b.h-old.h)*t;
 const side=sx<0?'left':'right',bankSide=(b.bankRoute==='left'||b.bankRoute==='right')&&b.bankStage===0||b.bankRoute==='rear_'+side&&b.bankStage===1;
 if(!bankSide&&(inDoorZ(zAt)||hAt>SIDE_GLASS_H))continue;
 fx('vidrio',{who:zAt>10?1:0});b.x=sx+(sx<0?.015:-.015);b.vx=-b.vx*.77;b.wallCount++;
 if(bankSide){b.bankStage=2;b.bank=false;lastBank=side==='left'?'IZQUIERDO':'DERECHO';message('REBOTE · '+lastBank,.6);}
 break;
}
for(const sz of [0,20]){const t=crossing(old.z,b.z,sz);if(t===null)continue;const xAt=old.x+(b.x-old.x)*t,hAt=old.h+(b.h-old.h)*t;if(Math.abs(xAt)>COURT_X||hAt>BACK_GLASS_H)continue;fx('vidrio',{who:sz===20?1:0});b.z=sz+(sz===0?.015:-.015);b.vz=-b.vz*.75;b.wallCount++;break;}
if(b.exitTest?.launched&&!b.exitTest.cleared){
 const cleared=b.exitTest.mode==='x3'?Math.abs(b.x)>COURT_X+.06:b.z>20.06;
 if(cleared){b.exitTest.cleared=true;b.exitTest.winT=.62;message(b.exitTest.mode==='x3'?'¡X3! PELOTA FUERA':'¡X4! PELOTA FUERA',.9);}
}
if(b.exitTest?.cleared){b.exitTest.winT-=dt;if(b.exitTest.winT<=0){endPoint(0,b.exitTest.mode==='x3'?'X3':'X4');return;}}
if(Math.abs(b.x)<COURT_X&&b.z>0&&b.z<20)b.externalReturn=false;
if(b.age>11){endPoint(1-b.lastHit,'LÍMITE DE TIEMPO');}
}
// A4.4: purely cosmetic serve-stage selector, synchronized by existing ball
// state and real bounce. This does not schedule, accelerate, or delay a serve.
function selectA44ServeSprite(p){
 if(!a44Enabled||server!==0||servingActor(0)!==p)return null;
 const isYellow=p.team===0&&p!==human;
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
 // Provisional A5.10 Tapia visual: hold a rear-facing/high-racket frame while
 // the real timed contact window is active. A dedicated sprite sequence can
 // replace this later without touching the mechanic.
 if(human.tapiaReadyT>0){
  const back=assets.human.backhand||[];
  if(back.length)return back[Math.min(back.length-1,Math.max(0,Math.floor(back.length*.62)))];
  const down=a48Enabled?a48.white_down:null;
  if(down?.length)return down[Math.min(down.length-1,Math.floor(down.length*.45))];
 }
 const special=selectA44ServeSprite(human);if(special)return special;
 // During charging keep regular movement/ready pose. Prepare appears only after a valid smash contact.
 if(a44Enabled&&human.jumpT>0&&a44.white_smash_strike){
  const progress=clamp(1-human.jumpT/human.jumpDuration,0,1);
  return progress<.16?(a44.white_smash_prepare||a44.white_smash_strike):progress<.65?a44.white_smash_strike:(a44.white_smash_recover||a44.white_smash_strike);
 }
 const m=human.motion;
 if(m==='smash'&&human.pose>0&&a44Enabled&&a44.white_smash_recover)return a44.white_smash_recover;
 const lateralBank=(m==='glass'&&human.pose>0&&(human.visualBankRoute==='left'||human.visualBankRoute==='right'));
 const list=lateralBank
  ?(assets.human[human.visualBankRoute==='left'?'backhand':'forehand']||assets.human.glass||[])
  :((assets.human[m]||assets.human.idle||[]));
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
 const hasGait=whiteRunCycles[facing]||(a48Enabled&&['diag_up_left','diag_up_right'].includes(facing));
 if(human.moving&&hasGait)return whiteRunFrame(facing);
 if(human.visualExitT>0&&hasGait)return whiteRunFrame(facing);
 if(human.visualIdleT<=.125&&hasGait)return whiteRunFrame(facing);
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
 let src=p===human?selectHumanSprite():selectYellowSprite(p);
 if(!src)return;let im=images[src.src];
 if(!im?.complete||!im.naturalWidth){src=p===human?whiteIdleFrame():yellow.ready_back;im=src?images[src.src]:null;}
 if(!src||!im?.complete||!im.naturalWidth)return;
 const pr=project(p.x,p.z),[x0,y0,x1,y1]=src.bounds;const sw=x1-x0,sh=y1-y0;
 const smashVisual=p===human&&a44Enabled&&src.src?.startsWith('assets/a44/white_smash_');
 const smashScale=smashVisual?(src.src.includes('_prepare')?1.23:src.src.includes('_strike')?1.19:1.06):1;
 const height=215*pr.scale*(p===human?smashScale:1.02),width=sw/sh*height;
 // Smaller visual body tilt, same world coordinates and actual running speed.
 const lateral=p===human?human.vx/7.15:(p.moving?(p.lean||0)*1.4:0);
 const lean=clamp(lateral*(p===human?.033:.057),-.055,.055);
 const stride=p===human?human.stridePhase:(p.stridePhase||0);
 const lateralStepA45=a45Enabled&&p===human&&(p.visualFacing==='run_left'||p.visualFacing==='run_right');
 const vertical=p.moving&&!lateralStepA45?1-(p===human?.008:.004)*Math.abs(Math.sin(stride*Math.PI)):1;
 const airborne=(p.jumpT||0)>0&&p.jumpDuration>0;
 const hopPhase=airborne?clamp(1-p.jumpT/p.jumpDuration,0,1):0;
 const hop=airborne?Math.sin(Math.PI*hopPhase)*(p===human?29:19)*pr.scale:0;
 if(airborne){
  ctx.save();ctx.fillStyle='#071b2b66';ctx.beginPath();
  ctx.ellipse(pr.x,pr.y+2,Math.max(8,23*pr.scale)*(1-hopPhase*.12),Math.max(2.5,4*pr.scale),0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 ctx.save();ctx.translate(pr.x,pr.y-hop);ctx.transform(1,0,-lean,1,0,0);
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
 drawBody(src);
 ctx.restore();
 drawTag(pr.x,pr.y+15,p.id,p===human?'#35d8ff':'#ffe14f');
}
function drawRobotActor(p){
 // Normalized robot set: animation mirrors existing world movement; no AI,
 // collision, hitbox, timing or ball-physics value is read back from these sprites.
 const available=name=>{const path=assets.robot[name],im=path&&images[path];return im?.complete&&im.naturalWidth?{name,path,im}:null;};
 const pick=(names,fallback='robot-ready-clean')=>{for(const n of names){const hit=available(n);if(hit)return hit;}return available(fallback);};
 let choice=null;
 if((p.robotStretchT||0)>0){
  const left=(p.robotStretchDir||-1)<0,idx=Math.floor((.16-p.robotStretchT)*18)%2;
  choice=pick(left?(idx?['robot-stretching-left-2','robot-stretching-left']:['robot-stretching-left','robot-stretching-left-2']):(idx?['robot-stretching-right-2','robot-stretching-right']:['robot-stretching-right','robot-stretching-right-2']));
 }else if(p.pose>0){
  const shot=p.robotVisualShot||p.motion,progress=clamp(1-p.pose/.42,0,1),stage=progress<ROBOT_POSE_PREP_END?0:progress<ROBOT_POSE_IMPACT_END?1:2;
  if(p.robotLowContact){
   choice=pick((p.robotContactDir||1)<0?['robot-slice-left']:['robot-slice-rigth']);
  }else if(shot==='backhand'){
   const seq=['robot-backhand-prepare-clean-v2','robot-backhand-up','robot-backhand-followthrough-up'];
   choice=pick([seq[stage],stage===0?'robot-backhand-prepare-clean':'robot-backhand-clean','robot-backhand-clean']);
  }else{
   const seq=['robot-forehand-01','robot-forehand-up','robot-forehand-followthrough-up'];
   choice=pick([seq[stage],stage===2?'robot-forehand-followthrough-clean':'robot-forehand-clean','robot-forehand-clean']);
  }
 }else if(p.moving){
  const dir=p.robotVisualDir||Math.sign(p.dx)||1,intent=p.robotVisualIntent||'run',idx=Math.floor(p.frameT*ROBOT_RUN_FPS)%2;
  if(intent==='shuffle'){
   choice=dir<0?pick(['robot-ready-diagonal-left','robot-move-left-01']):pick(idx?['robot-ready-diagonal-right-02','robot-ready-diagonal-right-01']:['robot-ready-diagonal-right-01','robot-ready-diagonal-right-02']);
  }else if(intent==='move'){
   choice=dir<0?pick(idx?['robot-move-left-02','robot-move-left-01']:['robot-move-left-01','robot-move-left-02'],'robot-run-left-a'):pick(idx?['robot-move-right-02','robot-move-right-01']:['robot-move-right-01','robot-move-right-02'],'robot-run-right-a');
  }else{
   choice=dir<0?pick(idx?['robot-run-left-02','robot-run-left-01']:['robot-run-left-01','robot-run-left-02'],idx?'robot-run-left-b':'robot-run-left-a'):pick(idx?['robot-run-right-02','robot-run-right-01']:['robot-run-right-01','robot-run-right-02'],idx?'robot-run-right-b':'robot-run-right-a');
  }
 }else{
  const look=ball&&phase==='rally'&&ball.lastHit===0?ball.x-p.x:0,idleIdx=(Math.floor(clock*2.15)+(p===robot2?1:p===robot3?2:0))%3;
  if(look<-.85)choice=pick(['robot-ready-diagonal-left','robot-ready-clean-v2']);
  else if(look>.85)choice=pick(idleIdx%2?['robot-ready-diagonal-right-02','robot-ready-diagonal-right-01']:['robot-ready-diagonal-right-01','robot-ready-diagonal-right-02']);
  else choice=pick([['robot-ready-01','robot-ready-02'][idleIdx%2],'robot-ready-clean-v2','robot-ready-clean']);
 }
 if(!choice)choice=available('robot-ready-clean');if(!choice)return;
 const im=choice.im,pr=project(p.x,p.z),tune=ROBOT_VISUAL_TUNE[choice.name]||{ax:.5,ay:1,scale:1};
 const height=196*pr.scale*ROBOT_VISUAL_GLOBAL_SCALE*tune.scale,width=height*(im.width/im.height);
 const left=pr.x-width*tune.ax,top=pr.y-height*tune.ay;
 ctx.save();if(p===robot2){ctx.filter='hue-rotate(135deg) saturate(1.3)';}else if(p===robot3){ctx.filter='hue-rotate(245deg) saturate(1.25)';}
 ctx.drawImage(im,left,top,width,height);ctx.restore();
 // Rival names stay clear of the net: smaller and above the robot silhouette.
 drawTag(pr.x,top-5,p.id,p===robot?'#ff6078':p===robot2?'#ffa944':'#b98cff',true);
}
function drawTag(x,y,t,color,compact=false){ctx.save();ctx.font=compact?'bold 11px system-ui':'bold 13px system-ui';ctx.textAlign='center';const pad=compact?10:15,w=Math.max(compact?34:44,ctx.measureText(t).width+pad),h=compact?16:19,top=y-(compact?11:13);ctx.fillStyle=compact?'#081b2da8':'#081b2dbd';ctx.fillRect(x-w/2,top,w,h);ctx.fillStyle=color;ctx.fillText(t,x,y);ctx.restore();}
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
  // While the player walks into serving position there is no stable hand pose,
  // so hiding the held ball avoids the visual effect of a ball floating beside him.
  if(phase==='serveReady'&&(human.moving||hypot(human.vx,human.vz)>.16))return;
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
 const cyber=specialMode==='cyber',neon=specialMode==='neon',arctic=specialMode==='arctic',celestial=specialMode==='celestial';
 const fill=cyber?'#54f7ff':neon?'#eaff35':arctic?'#ff6a24':celestial?'#ff3edb':'#eaff35';
 const glow=cyber?'#38ddff':neon?'#9dff2f':arctic?'#ff7b24':celestial?'#ff72e7':'#caff44';
 const trail=cyber?'#55f6ff':neon?'#c8ff4b':arctic?'#ff9b52':celestial?'#ff7de8':'#dffd5a';
ctx.save();ctx.fillStyle='#00112090';ctx.beginPath();ctx.ellipse(ground.x,ground.y+3,r*1.8,r*.53,0,0,Math.PI*2);ctx.fill();
for(let i=0;i<ball.trail.length;i++){const pos=ball.trail[i],op=(i+1)/ball.trail.length;ctx.globalAlpha=op*(cyber?.48:neon?.34:.15);ctx.fillStyle=trail;ctx.shadowColor=(cyber||neon)?glow:'transparent';ctx.shadowBlur=cyber?r*3:neon?r*2.5:0;ctx.beginPath();ctx.arc(pos.x,pos.y,r*(cyber?.72:neon?.66:.5),0,7);ctx.fill();}
ctx.globalAlpha=1;ctx.shadowColor=glow;ctx.shadowBlur=r*(cyber?5.2:neon?4.3:2.4);ctx.fillStyle=fill;ctx.strokeStyle='#ffffff';ctx.lineWidth=cyber?1.3:neon?1.15:.9;ctx.beginPath();ctx.arc(p.x,p.y,r*(cyber?1.12:neon?1.08:1),0,7);ctx.fill();ctx.stroke();ctx.restore();}
function drawGuide(){if(!ball||phase!=='rally')return;const b=ball,disc=b.vh*b.vh+2*G*b.h,T=clamp((b.vh+Math.sqrt(Math.max(0,disc)))/G,.05,2.3);
const x=b.x+b.vx*T,z=b.z+b.vz*T;if(Math.abs(x)>5||z<0||z>20)return;const p=project(x,z);
ctx.save();ctx.strokeStyle=b.lastHit===1?'#5cfffba8':'#ffffffe0';ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(p.x,p.y,12*p.scale,7*p.scale,0,0,7);ctx.stroke();ctx.restore();}
function rect(x,y,w,h,r=0){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawMeter(x,y,w,h,value,energy=false){value=clamp(value,0,1);ctx.save();ctx.fillStyle='#061b32';rect(x,y,w,h,2);ctx.fill();ctx.strokeStyle='#427ca5';ctx.strokeRect(x+.5,y+.5,w-1,h-1);
if(value>0){if(!energy){const gd=ctx.createLinearGradient(x,0,x+w,0);gd.addColorStop(0,'#e82c35');gd.addColorStop(.2,'#ffa62d');gd.addColorStop(.44,'#f5ef43');gd.addColorStop(.63,'#3cf2a5');gd.addColorStop(1,'#17405b');ctx.fillStyle=gd;}else ctx.fillStyle='#21dbc5';
ctx.fillRect(x+2,y+2,(w-4)*value,h-4);}
if(!energy){ctx.strokeStyle='#f6faff';ctx.lineWidth=2.5;const indicator=clamp(x+value*w,x+1,x+w-1);ctx.beginPath();ctx.moveTo(indicator,y-4);ctx.lineTo(indicator,y+h+4);ctx.stroke();}
ctx.restore();}
function drawServeLights(){
 // Two compact service-attempt indicators per team. The serving side shows
 // both lights on for first serve, one for second serve; the receiver stays dim.
 const groups=[{team:0,x:[610,632],color:'#62ddff'},{team:1,x:[1040,1062],color:'#ff667a'}],y=76;
 for(const g of groups){const remaining=server===g.team?Math.max(0,2-serveFaults):0;for(let i=0;i<2;i++){ctx.save();ctx.beginPath();ctx.arc(g.x[i],y,7.2,0,Math.PI*2);ctx.fillStyle='#07111ed8';ctx.fill();ctx.strokeStyle='#a9c1d06b';ctx.lineWidth=1;ctx.stroke();if(i<remaining){ctx.beginPath();ctx.arc(g.x[i],y,4.8,0,Math.PI*2);ctx.fillStyle=g.color;ctx.shadowColor=g.color;ctx.shadowBlur=8;ctx.fill();}ctx.restore();}}
}
function drawTop(){ctx.save();ctx.fillStyle='#071429';rect(727,28,192,87,5);ctx.fill();ctx.textAlign='center';ctx.fillStyle='#f3fbff';ctx.font='bold 41px system-ui';ctx.fillText(score(0),767,72);ctx.fillText(score(1),878,72);
ctx.fillStyle='#38ccff';ctx.fillRect(822,42,2,31);ctx.font='bold 20px system-ui';ctx.fillText(`JUEGOS ${games[0]} – ${games[1]}`,824,107);ctx.restore();drawServeLights();}
function drawHUD(){ctx.save();const playerPower=netMode==='guest'?netHostPower:charging?clamp((clock-charging.started)/1.15,0,1):queued?queued.power:0;
// Positions belong exactly to the user's artwork: two independent bars, one for each player.
drawMeter(127,858,231,18,playerPower);drawMeter(205,895,150,15,boost/100,true);
drawMeter(1326,858,231,18,remoteActive?(netMode==='guest'?netRemotePower:remoteCharge?clamp((clock-remoteCharge.started)/1.15,0,1):remoteQueued?.power||0):robotCharge);drawMeter(1404,895,150,15,remoteActive?partner.stamina/100:robotStamina/100,true);
// Redesigned match-control panel. Covers the tiny baked-in raster HUD only.
const hudX=664,hudY=837,hudW=344,hudH=98;
ctx.fillStyle='#061626f8';rect(hudX,hudY,hudW,hudH,9);ctx.fill();
ctx.strokeStyle='#438db7';ctx.lineWidth=2;ctx.stroke();
ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='bold 27px system-ui';
ctx.fillText('RALLY '+rally,750,873);
ctx.fillStyle='#b6dbef';ctx.font='bold 20px system-ui';
ctx.fillText('RÉCORD: '+longestRally,919,871);
ctx.fillStyle='#91bed8';ctx.font='13px system-ui';ctx.fillText('Golpes en el punto',750,890);
const drawAction=(x,title)=>{ctx.fillStyle='#156491';rect(x,900,151,31,5);ctx.fill();ctx.strokeStyle='#64b9e1';ctx.lineWidth=1.3;ctx.stroke();ctx.fillStyle='#f7fcff';ctx.font='bold 15px system-ui';ctx.fillText(title,x+75.5,921);};
drawAction(676,'PAUSA');drawAction(845,'REINICIAR');
if(powerBannerT>0){ctx.fillStyle='#122845d9';rect(664,189,344,46,9);ctx.fill();ctx.strokeStyle='#f3c961';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff1b7';ctx.font='bold 25px system-ui';ctx.fillText('POWER SHOT',836,221);}
if(showShotStats){ctx.fillStyle='#081b2ddd';rect(1101,42,480,40,7);ctx.fill();ctx.fillStyle='#e8faff';ctx.textAlign='center';ctx.font='bold 17px system-ui';ctx.fillText('LATERALES  NORMALES: '+lateralNormal+'  |  POWER: '+lateralPower,1341,69);}
// PAUSA and REINICIAR are clickable; TECLAS is the separate HTML button.
if(phase==='intro'||phase==='loading'||paused)drawSettingsPanel();
if(alertT>0&&!paused&&phase!=='intro'&&phase!=='loading'){ctx.textAlign='center';ctx.font='bold 22px system-ui';const width=clamp(ctx.measureText(alert).width+64,270,880);ctx.fillStyle='#001b30e8';rect(836-width/2,145,width,52,8);ctx.fill();ctx.strokeStyle='#3c9bc7aa';ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle='#f0fcff';ctx.fillText(alert,836,179);}
ctx.restore();}
function settingsButton(x,y,w,h,title,selected){
 ctx.fillStyle=selected?'#177ac0':'#123650';rect(x,y,w,h,7);ctx.fill();ctx.strokeStyle=selected?'#58d8fc':'#47758e';ctx.lineWidth=selected?2.5:1.1;ctx.stroke();
 ctx.fillStyle='#f2fcff';ctx.font=title.length>9?'bold 13px system-ui':'bold 17px system-ui';ctx.textAlign='center';ctx.fillText(title,x+w/2,y+h/2+6);
}
function drawSettingsPanel(){
 ctx.save();ctx.fillStyle='#020e1acf';ctx.fillRect(0,0,W,H);
 rect(495,179,686,570,18);ctx.fillStyle='#0a2340f5';ctx.fill();ctx.strokeStyle='#259dda';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 32px system-ui';ctx.fillText(phase==='loading'?'CARGANDO RECURSOS':phase==='intro'?`PADEL RALLY — ${matchFormat.toUpperCase()}`:help?'COMANDOS Y AJUSTES':'PARTIDA EN PAUSA — AJUSTES',838,247);
 ctx.font='17px system-ui';ctx.fillStyle='#a9cfe8';ctx.fillText('RITMO DE JUEGO',836,292);
 {const bw=88,gap=7,start=505;tempos.forEach((v,i)=>settingsButton(start+i*(bw+gap),307,bw,42,v.name,tempoIndex===i));}
 ctx.fillStyle='#a9cfe8';ctx.fillText('DIFICULTAD DEL ROBOT',836,367);
 skillLevels.forEach((v,i)=>settingsButton(619+i*112,379,105,42,v.name,skillIndex===i));
 if(careerMode){ctx.fillStyle='#ffd978';ctx.font='bold 13px system-ui';ctx.fillText(`CARRERA · PARTIDO ${careerRound}/7 · DIFICULTAD FIJA`,836,444);}
 settingsButton(615,461,214,47,'AMBIENTE REAL: '+(ambientOn?'SÍ':'NO'),ambientOn);
 settingsButton(846,461,214,47,'EFECTOS REALES: '+(sfxOn?'SÍ':'NO'),sfxOn);
 ctx.fillStyle='#d6f2ff';ctx.font='16px system-ui';
 const modeDesc=matchFormat==='3v3'?'TÚ + DOS COMPAÑEROS IA contra TRES ROBOTS':matchFormat==='2v2'?'TÚ + COMPAÑERO IA contra DOS ROBOTS':matchFormat==='1v1'?'TÚ contra UN ROBOT':matchFormat==='2v1'?'TÚ + COMPAÑERO IA contra UN ROBOT':'TÚ contra DOS ROBOTS';
 ctx.fillText(netMode==='offline'?modeDesc:'BLANCO + AMARILLO ONLINE contra DOS ROBOTS',836,535);
 ctx.fillText('Flechas: mover y dirigir    ·    Z: revés    ·    X: derecha',836,557);
 ctx.fillText('C: globo · V: dejada · ESPACIO: remate · S: fondo · A/D: laterales',836,584);
 ctx.fillText('G: devolución Tapia · E+←/→: X3 · E+↑ (o E): X4 · Shift: correr',836,609);
 ctx.fillStyle='#85b3d2';ctx.font='14px system-ui';ctx.fillText('F6 EXTERIOR TEST · F7 AUTO REAL · F8 estadísticas · M/N audio · F pantalla completa',836,636);
 settingsButton(698,655,272,54,netMode==='guest'?'ESPERANDO ANFITRIÓN':phase==='intro'?'JUGAR':help?'VOLVER AL PARTIDO':'REANUDAR',true);
 if(phase==='loading'){ctx.fillStyle='#fff';ctx.fillText('Cargando '+loaded+'/'+requested,836,735);}
 ctx.restore();
}
function tick(dt){
 if(netMode==='guest'||phase==='loading'||phase==='intro'||paused)return;
 const tempo=tempos[tempoIndex];dt=Math.min(.04,dt)*tempo.scale;
 const fastBallFactor=(tempo.ballScale||tempo.scale)/tempo.scale;
 // Ball-only acceleration runs in smaller simulation steps, keeping actor contacts
 // and ball collisions in the same substep without modifying any shot trajectory.
 const substeps=fastBallFactor>1?Math.max(1,Math.ceil(dt*fastBallFactor/.009)):1;
 for(let i=0;i<substeps;i++){
  const d=dt/substeps;
  clock+=d;alertT=Math.max(0,alertT-d);contactMsgT=Math.max(0,contactMsgT-d);hCool=Math.max(0,hCool-d);human.cool=hCool;
  powerBannerT=Math.max(0,powerBannerT-d);
  stepHuman(d);stepDoublesAI(d);if(remoteActive)stepRemotePartner(d);stepAutoHumanActions(d);
  separateTeammates();
  updateBall(phase==='rally'?d*fastBallFactor:d);
  if(queued?.bank)attemptSpecial();else attemptQueued();
  if(steer&&ball===steer.ref&&clock<steer.until){const a=autoReal?autoHumanAim():arrows();if(a.dx||a.dz){ball.vx=steer.vx+(a.dx-steer.base.dx)*1.5;ball.vz=steer.vz+(a.dz-steer.base.dz)*.55;}}
  if(steer&&clock>=steer.until)steer=null;
  if(phase==='pointEnd'){pointDelay-=d;if(pointDelay<=0){phase='serveReady';resetPositions();message(serveFaults===1?'SEGUNDO SAQUE':server===0?(servingActor(0)===human?'TU SAQUE · Z O X':'SAQUE DEL COMPAÑERO'):'SAQUE DE LA IA',1.7);}}
 }
}
function render(){ctx.clearRect(0,0,W,H);const court=images[courtAsset];if(court?.complete&&court.naturalWidth)ctx.drawImage(court,0,0,W,H);else{ctx.fillStyle='#156ace';ctx.fillRect(0,0,W,H);}drawGuide();
 if(activeActors.has(robot))drawRobotActor(robot);if(activeActors.has(robot2))drawRobotActor(robot2);if(activeActors.has(robot3))drawRobotActor(robot3);if(activeActors.has(partner))drawHumanActor(partner);if(activeActors.has(partner2))drawHumanActor(partner2);drawHumanActor(human);drawBall();drawTop();drawHUD();
 if(careerMode&&specialMode){ctx.save();ctx.textAlign='right';ctx.font='bold 14px system-ui';ctx.fillStyle='#e9fbff';ctx.shadowColor='#000';ctx.shadowBlur=5;const badge=specialMode==='arctic'?'HIELO':specialMode==='celestial'?'GRAVEDAD REDUCIDA':'PELOTA DE ENERGÍA';ctx.fillText(badge,1580,120);ctx.restore();}
 if(autoReal){ctx.save();ctx.textAlign='right';ctx.font='bold 15px system-ui';ctx.fillStyle='#7fffd4';ctx.shadowColor='#000';ctx.shadowBlur=6;ctx.fillText('QA · AUTO REAL · F7 DETENER',1580,145);ctx.restore();}
}
// The bridge can be used only by online.html (same origin iframe).
function getSnapshot(){if(netMode!=='host'||phase==='loading')return null;
 const fields=p=>({x:p.x,z:p.z,motion:p.motion,visualFacing:p===partner?p.visualFacing:undefined,visualIdleT:p===partner?p.visualIdleT:undefined,previous:p.previous,frameT:p.frameT,pose:p.pose,moving:p.moving,dx:p.dx,stamina:p.stamina,charge:p.charge,cool:p.cool,stridePhase:p.stridePhase,recoverT:p.recoverT,savePoseT:p.savePoseT,saveFrame:p.saveFrame,visualFacing:p===human?p.visualFacing:p.visualFacing,visualPending:p===human?p.visualPending:undefined,visualPendingT:p===human?p.visualPendingT:undefined,visualIdleT:p===human?p.visualIdleT:p.visualIdleT,visualBlendT:p===human?p.visualBlendT:undefined,visualExitT:p===human?p.visualExitT:undefined,jumpT:p.jumpT||0,jumpDuration:p.jumpDuration||.46,robotVisualSpeed:p.robotVisualSpeed||0,robotVisualIntent:p.robotVisualIntent||'',robotVisualDir:p.robotVisualDir||0,robotVisualShot:p.robotVisualShot||'',robotStretchT:p.robotStretchT||0,robotStretchDir:p.robotStretchDir||0,robotLowContact:!!p.robotLowContact,robotContactDir:p.robotContactDir||0});
 return {phase,paused,help,clock,serveBounceT,server,scoreP:[...scoreP],games:[...games],rally,longestRally,pointDelay,pointInGame,nearServerMember,farServerMember,
  tempoIndex,skillIndex,alert,alertT,boost,robotCharge,robotStamina,serveFaults,remoteActive,powerBannerT,lateralNormal,lateralPower,lastLateralMode,
  power1:charging?clamp((clock-charging.started)/1.15,0,1):queued?.power||0,
  power2:remoteCharge?clamp((clock-remoteCharge.started)/1.15,0,1):remoteQueued?.power||0,
  human:fields(human),partner:fields(partner),partner2:fields(partner2),robot:fields(robot),robot2:fields(robot2),robot3:fields(robot3),
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
 for(const [name,p] of [['human',human],['partner',partner],['partner2',partner2],['robot',robot],['robot2',robot2],['robot3',robot3]]){
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
window.__padelDebug=()=>({mode:matchFormat,exteriorTest:{door:[DOOR_Z_MIN,DOOR_Z_MAX],outerX:OUTER_X,innerX:[PLAYER_LEFT_X,PLAYER_RIGHT_X],humanOutside:actorOutside(human),ballOutside:ballOutside(ball),accessOpen:exteriorAccessOpen(0)},autoReal,phase,paused,help,clock,loaded,requested,errors,server,nearServerMember,farServerMember,servingActor:servingActor().id,allyAttempted,robotAttempted,lastInterception,roster:[...members[0],...members[1]].map(p=>({id:p.id,team:p.team,x:p.x,z:p.z,cool:p.cool,moving:p.moving})),score:[score(0),score(1)],games:[...games],rally,longestRally,serveFaults,pointInGame,servingSide:pointInGame%2===0?'DERECHA':'IZQUIERDA',boost,robotStamina,lastBank,lastLateralMode,lateralNormal,lateralPower,powerBannerT,showShotStats,partnerVisual:{motion:partner.motion,visualFacing:partner.visualFacing,visualPending:partner.visualPending,stridePhase:partner.stridePhase,frameT:partner.frameT,recoverT:partner.recoverT,splitStepT:partner.splitStepT,visualSpeed:partner.visualSpeed},ball:ball?{x:ball.x,z:ball.z,h:ball.h,vx:ball.vx,vz:ball.vz,vh:ball.vh,lastHit:ball.lastHit,bounces:ball.bounces,serveFlight:ball.serveFlight,bank:ball.bank,bankRoute:ball.bankRoute,bankStage:ball.bankStage,wallCount:ball.wallCount,exitQuality:ball.exitTest?.quality??null}:null,tapiaGuard:tapiaGuard?{activeFrom:tapiaGuard.activeFrom,until:tapiaGuard.until}:null,human:{x:human.x,z:human.z,motion:human.motion,visualFacing:human.visualFacing,visualPending:human.visualPending,visualBlendT:human.visualBlendT,stridePhase:human.stridePhase,height:215*project(human.x,human.z).scale},robot:{x:robot.x,z:robot.z,motion:robot.motion,visualIntent:robot.robotVisualIntent,visualDir:robot.robotVisualDir,visualShot:robot.robotVisualShot,stretchT:robot.robotStretchT,lowContact:robot.robotLowContact},tempo:tempos[tempoIndex].name,tempoScale:tempos[tempoIndex].scale,skill:skillLevels[skillIndex].name,skillParams:skillLevels[skillIndex],ambientOn,sfxOn,robotAttempted,partnerLane,playerSeparation:hypot(partner.x-human.x,partner.z-human.z),lastRobotTarget,robotAimWhite,robotAimYellow,nearChaseOwner:nearChaseOwner?.id||null,nearChaseSwitches,a48Enabled,a48Facing:human.visualFacing,a48BankRoute:human.visualBankRoute||null,whiteJump:human.jumpT||0,yellowJump:partner.jumpT||0,ballSpeedFactor:(tempos[tempoIndex].ballScale||tempos[tempoIndex].scale)/tempos[tempoIndex].scale,velocity:{vx:human.vx,vz:human.vz},charging:charging?.shot||null,queued:queued?.shot||null,queuedRoute:queued?.route||null});
})();

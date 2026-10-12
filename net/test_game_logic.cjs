// Headless logic smoke test; NO claims about browser rendering or frame latency.
const fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(__dirname+'/../game.js','utf8').replace(/\}\)\(\);\s*$/, `window.__padelTest={
  prepareRemoteHit(){phase='rally';ball=makeBall(partner.x+.25,partner.z+.2,1.0,0,0,0,1);ball.wallOK=true;},
  prepareYellowServe(){server=0;nearServerMember=1;pointInGame=0;phase='serveReady';resetPositions();},
  getLastActor(){return ball?.lastActor;},
  getServeActor(){return ball?.serveData?.actor;},
  getBallLastHit(){return ball?.lastHit;}
 };})();`);
function newSandbox(){
 const events={},frames=[];
 const noop=()=>{};
 const ctx=new Proxy({}, {get(o,key){if(key==='measureText')return()=>({width:80});if(key==='createLinearGradient')return()=>({addColorStop:noop});return o[key]===undefined?noop:o[key];},set(o,k,v){o[k]=v;return true;}});
 const canvas={getContext:()=>ctx,addEventListener:(name,fn)=>{events['canvas:'+name]=fn},getBoundingClientRect:()=>({x:0,y:0,width:1672,height:941}),focus:noop};
 const status={textContent:''};
 class FakeImage{constructor(){this.complete=false;this.naturalWidth=1024;this.width=1024;this.height=512;}
  set src(v){this.path=v;this.complete=true;if(this.onload)this.onload();}}
 class FakeAudio{constructor(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 const window={PADEL_ASSETS:{human:{},robot:{}},PADEL_YELLOW:{},PADEL_RECORDINGS:{},addEventListener:(name,fn)=>{events['window:'+name]=fn}};
 const context={window,document:{getElementById:id=>id==='game'?canvas:status,querySelector:()=>({})},Image:FakeImage,Audio:FakeAudio,requestAnimationFrame:fn=>frames.push(fn),console,performance:{now:()=>0},Math};
 vm.runInNewContext(source,context,{filename:'game.js'});
 let elapsed=0;
 return {bridge:window.PadelOnlineBridge,debug:window.__padelDebug,test:window.__padelTest,
  frames(n=1){for(let i=0;i<n;i++){const callback=frames.shift();if(!callback)throw Error('missing animation callback');elapsed+=16.666;callback(elapsed);}},
  key(code,down=true){events['window:'+(down?'keydown':'keyup')]({code,preventDefault:noop,repeat:false})}};
}
const host=newSandbox();host.bridge.setMode('host');host.bridge.setRemoteConnected(true);host.key('Enter');host.frames(8);
if(host.debug().phase!=='serveReady')throw Error('match not ready '+host.debug().phase);
const x0=host.debug().roster[1].x;
host.bridge.receiveRemoteInput({right:true});host.frames(40);
const x1=host.debug().roster[1].x;
if(!(x1>x0+1.8))throw Error('remote yellow movement failed '+x0+' '+x1);
host.bridge.receiveRemoteInput({});host.frames(6);
const guest=newSandbox();guest.bridge.setMode('guest');guest.frames(6);
const snapshot=host.bridge.getSnapshot();guest.bridge.applySnapshot(snapshot,10);
if(guest.debug().phase!==host.debug().phase)throw Error('guest phases differ');
if(Math.abs(guest.debug().roster[1].x-host.debug().roster[1].x)>1e-4)throw Error('guest yellow sync failed');
// Guest key cannot move or pause simulation
const guestX=guest.debug().roster[1].x;
guest.key('ArrowLeft');guest.key('KeyP');guest.frames(30);
if(guest.debug().phase!==host.debug().phase||guest.debug().roster[1].x!==guestX)throw Error('guest simulated on its own');
// Host starts a serve with host white.
host.key('KeyX');host.frames(12);host.key('KeyX',false);host.frames(3);
if(!['serveDrop','rally'].includes(host.debug().phase))throw Error('host serve failed '+host.debug().phase);
// Server switches to yellow for later game: force via internal simulation is not exposed;
// verify remote input and cue are applied, and snapshots correctly serialize a live ball.
snapshot2=host.bridge.getSnapshot();if(!snapshot2.ball)throw Error('live ball not synchronized');
guest.bridge.applySnapshot(snapshot2,11);
if(guest.debug().phase!==host.debug().phase||!guest.debug().ball)throw Error('guest live ball missing');
// Remote forehand must be executed by the yellow player (not host white).
host.test.prepareRemoteHit();host.bridge.receiveRemoteInput({forehand:true});host.frames(9);
host.bridge.receiveRemoteInput({forehand:false});host.frames(1);
if(host.test.getBallLastHit()!==0||host.test.getLastActor()!=='ALIADO')
 throw Error('remote yellow forehand did not contact ball '+host.test.getLastActor());
// On a yellow service game, the guest must initiate its own serve.
host.test.prepareYellowServe();host.bridge.receiveRemoteInput({forehand:true});host.frames(9);
host.bridge.receiveRemoteInput({forehand:false});
if(host.test.getServeActor()!=='ALIADO')throw Error('remote yellow serve failed '+host.test.getServeActor());
host.bridge.setRemoteConnected(false);if(host.bridge.debug().remoteActive)throw Error('disconnect leaves player controlled');
console.log('JS_LOGIC_OK, REMOTE_YELLOW_MOVES_OK, REMOTE_FOREHAND_OK, YELLOW_SERVE_OK, SNAPSHOT_SYNC_OK, GUEST_READONLY_OK, HOST_SERVES_OK, FALLBACK_AI_ACTIVE');

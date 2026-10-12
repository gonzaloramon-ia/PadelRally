const fs=require('fs'),vm=require('vm');
const file=__dirname+'/../game.js';
const source=fs.readFileSync(file,'utf8').replace(/\}\)\(\);\s*$/,`window.__serviceTest={
  reset:newMatch,
  forceGame(who){phase='rally';server=who;pointInGame=0;scoreP=who===0?[3,0]:[0,3];ball=makeBall(0,10,1);endPoint(who,'TEST');return {server,nearServerMember,farServerMember,games:[...games],actor:servingActor().id};},
  point(who){phase='rally';ball=makeBall(0,10,1);endPoint(who,'TEST');},
  position(){resetPositions();return {actor:servingActor().id,server,pointInGame,nearServerMember,farServerMember,near:members[0].map(p=>({id:p.id,x:p.x,z:p.z})),far:members[1].map(p=>({id:p.id,x:p.x,z:p.z}))};}
};})();`);
const noop=()=>{};
const ctx=new Proxy({}, {get(o,k){if(k==='measureText')return()=>({width:40});if(k==='createLinearGradient')return()=>({addColorStop:noop});return o[k]||noop},set(o,k,v){o[k]=v;return true}});
const canvas={getContext:()=>ctx,addEventListener:noop},status={textContent:''};
class FakeImage{constructor(){this.complete=false;this.naturalWidth=512}set src(x){this.complete=true;this.onload?.()}}
class FakeAudio{constructor(){this.paused=true}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
const window={PADEL_ASSETS:{human:{},robot:{}},PADEL_YELLOW:{},PADEL_RECORDINGS:{},addEventListener:noop};
const doc={getElementById:(id)=>id==='game'?canvas:status,querySelector:()=>({})};
vm.runInNewContext(source,{window,document:doc,Image:FakeImage,Audio:FakeAudio,requestAnimationFrame:noop,console,Math,performance:{now:()=>0}});
const api=window.__serviceTest;
api.reset();
const actors=[api.position().actor];
for(let i=0;i<7;i++){api.forceGame(i%2);actors.push(api.position().actor);}
const expected=['P1','IA1','ALIADO','IA2','P1','IA1','ALIADO','IA2'];
if(actors.join(',')!==expected.join(','))throw Error('ROTATION '+actors);
api.reset();
api.forceGame(0); // far team now serves; receivers near must retain their lanes
let a=api.position();api.point(0);let b=api.position();
if(a.near.some((p,i)=>p.x!==b.near[i].x))throw Error('near side changed '+JSON.stringify([a.near,b.near]));
api.reset();let c=api.position();api.point(0);let d=api.position();
if(c.far.some((p,i)=>p.x!==d.far[i].x))throw Error('far side changed '+JSON.stringify([c.far,d.far]));
if(c.near[0].x===d.near[0].x)throw Error('serving team did not switch');
console.log('A49_SERVE_ORDER_OK',actors.join(' -> '),'RECEIVER_LANES_LOCKED_OK','SERVER_SIDE_ALTERNATES_OK');

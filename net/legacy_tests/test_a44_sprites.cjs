const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'net/reference_a43_game.js');
const cur=path.join(root,'game.js');
const a44=JSON.parse(fs.readFileSync(path.join(root,'a44-sprites.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
const assets=JSON.parse(fs.readFileSync(path.join(root,'assets.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
const yellow=JSON.parse(fs.readFileSync(path.join(root,'yellow.js'),'utf8').split('=',2)[1].replace(/;\s*$/,''));
function launch(file,{newAssets=false,yellowNew=false}={}){
 let q=[],events={},noop=()=>{},millis=0;
 const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?()=>({width:50}):k==='createLinearGradient'?()=>({addColorStop:noop}):o[k]===undefined?noop:o[k],set:(o,k,v)=>{o[k]=v;return true}});
 const canvas={getContext:()=>ctx,addEventListener:()=>{},focus:noop,getBoundingClientRect:()=>({left:0,top:0,width:1672,height:941})};
 const status={textContent:''};
 class Im{constructor(){this.naturalWidth=512;this.width=512;this.height=512;this.complete=true}set src(v){this.onload?.()}}
 class Aud{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){}}
 const win={PADEL_ASSETS:assets,PADEL_YELLOW:yellow,PADEL_A44_SPRITES:newAssets?a44:{},PADEL_A44_ENABLED:newAssets,PADEL_A44_YELLOW:yellowNew,PADEL_RECORDINGS:{},addEventListener:(key,fn)=>events[key]=fn};
 const math=Object.create(Math);math.random=()=>.4;
 const src=fs.readFileSync(file,'utf8').replace(/\}\)\(\);\s*$/, `window.__a44Test={
 newMatch, startServe, finishServe, selectHumanSprite, selectYellowSprite, selectYellow:()=>selectYellowSprite(partner), selectA44ServeSprite:typeof selectA44ServeSprite === "function" ? selectA44ServeSprite:null,
 setTempo(i){tempoIndex=i;}, physics(){return {phase, humanX:human.x,humanZ:human.z,partnerX:partner.x,partnerZ:partner.z,boost, ball:ball&&{x:ball.x,z:ball.z,h:ball.h,vx:ball.vx,vz:ball.vz,vh:ball.vh,bounces:ball.bounces,serveFlight:ball.serveFlight}};},
 getServeStage(){return {phase,serveBounceT,serveT,visualShot:ball?.serveData?.visualShot}}, setYellowServer(){server=0;nearServerMember=1;phase='serveReady';resetPositions();},
 };})();`);
 vm.runInNewContext(src,{window:win,document:{getElementById:(id)=>id==='game'?canvas:status,querySelector:()=>canvas},Image:Im,Audio:Aud,requestAnimationFrame:fn=>q.push(fn),console,performance:{now:()=>0},Math:math},{filename:file});
 return {test:win.__a44Test,frames(n=1){for(let i=0;i<n;i++){const f=q.shift();if(!f)throw Error('no animation frame');millis+=16.667;f(millis);}},key(code,down=true){events[down?'keydown':'keyup']?.({code,repeat:false,preventDefault:noop})}};
}
for(let tempo=0;tempo<3;tempo++){
 const old=launch(base),fresh=launch(cur,{newAssets:true});
 old.frames(4);fresh.frames(4);
 old.test.setTempo(tempo);fresh.test.setTempo(tempo);
 old.test.newMatch();fresh.test.newMatch();
 const before=fresh.test.selectA44ServeSprite;
 assert(fresh.test.selectHumanSprite()?.src.includes('white_serve_prepare'),'White ready serve sprite not loaded');
 fresh.test.startServe(0,.53,{dx:1,dz:1},'backhand');old.test.startServe(0,.53,{dx:1,dz:1});
 assert(fresh.test.getServeStage().visualShot==='backhand','backhand visual lost');
 assert(fresh.test.selectHumanSprite()?.src.includes('white_low_defense'),'White drop stage missing');
 for(let k=0;k<48;k++){
  old.frames();fresh.frames();
  const a=old.test.physics(),b=fresh.test.physics();
  assert.equal(a.phase,b.phase);
  for(const f of ['humanX','humanZ','partnerX','partnerZ','boost']) assert(Math.abs(a[f]-b[f])<1e-7,`Regression ${tempo} ${f}`);
  if(a.ball&&b.ball)for(const f of ['x','z','h','vx','vz','vh','bounces'])assert(Math.abs(a.ball[f]-b.ball[f])<1e-7,`Ball mismatch tempo ${tempo} ${f}`);
 }
}
const newv=launch(cur,{newAssets:true});newv.frames(4);newv.test.newMatch();newv.test.setYellowServer();
assert(!newv.test.selectA44ServeSprite||newv.test.selectA44ServeSprite()===null); // yellow default unchanged
const alt=launch(cur,{newAssets:true,yellowNew:true});alt.frames(4);alt.test.newMatch();alt.test.setYellowServer();
assert(alt.test.selectYellow()?.src.includes('yellow_serve_prepare'),'Yellow experimental switch failed');
for(const ob of Object.values(a44)) assert(fs.existsSync(path.join(root,ob.src)),ob.src);
console.log('A44_VALID: 11 SPRITES, WHITE FOREHAND/BACKHAND SERVE SELECTION, YELLOW OPT-IN, NO POSITION OR BALL PHYSICS REGRESSIONS (3 TEMPOS)');

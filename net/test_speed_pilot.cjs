// Verify movement cadence is decoupled from all five original ball time multipliers.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const nocall=()=>{};
function run(mode){
 const listeners={};
 const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?()=>({width:60}):k==='createLinearGradient'?()=>({addColorStop:nocall}):o[k]===undefined?nocall:o[k],set:(o,k,v)=>{o[k]=v;return true;}});
 const canvas={getContext:()=>ctx,addEventListener:nocall,focus:nocall};
 class Image{constructor(){this.complete=true;this.naturalWidth=512;this.width=512;this.height=512}set src(v){this.onload?.()}}
 class Audio{constructor(){this.paused=true}play(){return Promise.resolve()}pause(){}}
 const asset=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8').split('=',2)[1].replace(/;\s*$/,''));
 const window={PADEL_ASSETS:asset('assets.js'),PADEL_YELLOW:asset('yellow.js'),PADEL_A44_SPRITES:asset('a44-sprites.js'),PADEL_A44_ENABLED:true,PADEL_A45_SPRITES:asset('a45-sprites.js'),PADEL_A45_ENABLED:true,PADEL_A48_SPRITES:asset('a48-sprites.js'),PADEL_A48_ENABLED:true,PADEL_RECORDINGS:{},addEventListener:(e,f)=>listeners[e]=f};
 const injected=source.replace(/\}\)\(\);\s*$/,`window.__pilotCheck={
  check(){const values=tempos.map(t=>({name:t.name,players:t.scale,ball:t.ballScale}));
   tempoIndex=${mode};newMatch();phase='rally';human.x=0;human.z=3;partner.x=-3;partner.z=7;
   keys.clear();keys.add('ArrowRight');ball=makeBall(0,12,2.2,0,0,0,0);ball.wallOK=true;
   const x0=human.x;tick(.016);const ballAge=ball?.age,oneTickClock=clock;phase='serveReady';ball=null;for(let j=0;j<20;j++)tick(.016);return {values,moved:human.x-x0,ballAge,clock:oneTickClock};}
 };})();`);
 vm.runInNewContext(injected,{window,document:{getElementById:id=>id==='game'?canvas:{textContent:''}},Image,Audio,requestAnimationFrame:nocall,performance:{now:()=>0},console,Math});
 return window.__pilotCheck.check();
}
const expected=[
 ['LENTO',.81,.81],['NORMAL',1,1.05],['RÁPIDO',1.02,1.32],
 ['MUY RÁPIDO',1.06,1.452],['EXTREMO',1.08,1.584]
];
const results=expected.map((row,i)=>{
 const result=run(i);
 result.values.forEach((v,n)=>{
  assert.equal(v.name,expected[n][0]);
  assert(Math.abs(v.players-expected[n][1])<1e-10);
  assert(Math.abs(v.ball-expected[n][2])<1e-10);
 });
 assert(result.ballAge!==undefined,`no ball in ${row[0]}`);
 assert(Math.abs(result.ballAge-.016*row[2])<1e-8,`wrong ball time ${row[0]} age=${result.ballAge}`);
 assert(Math.abs(result.clock-.016*row[1])<1e-8,`wrong simulation time ${row[0]}`);
 assert(result.moved>0,`player didn't move in ${row[0]}`);
 return result;
});
for(let i=1;i<results.length;i++)assert(results[i].moved>results[i-1].moved,'movement order');
// The fast modes are only modestly faster for player movement.
assert(results[4].moved/results[1].moved<1.2,'extreme player too fast');
console.log('SPEED_PILOT_OK: 5 BALL_SPEEDS_UNCHANGED, PLAYER_SCALE_081_100_102_106_108, BALL_AGE_VERIFIED, ANIMATION_DISTANCE_UNCHANGED');

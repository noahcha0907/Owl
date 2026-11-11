// Reproduction check for the documented animation snapshot. Node.js 22+.
// Start a dedicated Chrome with --remote-debugging-port=9223 first.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createFlightMotion} from '../effects/phantom-owl/flight-motion.mjs';

function verifyMotion(){
 const counts=new Set();let pauses=0,beats=0,joins=0;
 for(const seed of [1,2,3,4,5,6,12345,98765]){
  const m=createFlightMotion(seed),twin=createFlightMotion(seed);m.sample(300);
  let count=0,previous=null;
  for(const segment of [...m.segments]){
   if(segment.kind==='flap'){
    assert(segment.beats.length>=1&&segment.beats.length<=3);count+=segment.beats.length;
    if(previous?.kind==='flap'){assert.equal(previous.end,segment.start);assert(m.sample(segment.start).velocity>.1);joins++;}
    for(const beat of segment.beats){
     const peak=m.sample(segment.start+beat.start+(beat.end-beat.start)*.56);
     assert(Math.abs(peak.depth+1.02*1.06*1.14)<1e-10);assert.deepEqual(peak.left,peak.right);beats++;
    }
   }else if(segment.start>0){
    assert(count>=5&&count<=7);counts.add(count);pauses++;count=0;
    assert(Math.abs(segment.end-segment.start-.85)<1e-10);
    for(const t of [segment.start+.01,(segment.start+segment.end)/2,segment.end-.01]){
     const p=m.sample(t);assert.equal(p.mode,'glide');assert.equal(p.stroke,0);assert.equal(p.wrist,0);
    }
   }
   for(const t of [segment.start,segment.end]){
    const a=m.sample(Math.max(0,t-1e-6)),b=m.sample(t+1e-6);
    for(const key of ['stroke','wrist','depth','depthTip','fold'])assert(Math.abs(a.left[key]-b.left[key])<.0001);
    assert(Math.abs(a.velocity-b.velocity)<.001);
   }
   previous=segment;
  }
  for(const t of [0,1,9,20,55,120,299])assert.deepEqual(m.sample(t),twin.sample(t));
 }
 assert.deepEqual([...counts].sort(),[5,6,7]);
 return {pauseAfter:[...counts].sort(),pausesChecked:pauses,fullDepthFlapsChecked:beats,continuousJoinsChecked:joins,pauseSeconds:.85};
}
const motionChecks=verifyMotion();
if(process.argv.includes('--motion-only')){console.log(JSON.stringify(motionChecks,null,2));process.exit(0);}
const base=process.argv[2]||'http://127.0.0.1:8000/app/';
const output=process.argv[3]||join(tmpdir(),'phantom-snapshot');
await mkdir(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9223/json')).json();
const page=pages.find(p=>p.type==='page');assert(page,'Open a page in the dedicated QA Chrome.');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{
 const msg=JSON.parse(event.data);
 if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);
 if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry);
 if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(msg.params.args);
 if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(msg.error):p.resolve(msg.result);}}
});
function call(method,params={}){return new Promise((resolve,reject)=>{
 const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP timed out: '+method));},15000);
 pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
try{
 await call('Log.clear');await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
 await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const url=new URL(base);url.searchParams.set('time','0');url.searchParams.set('seed','12345');
 await call('Page.navigate',{url:url.href});
 let ready=false;
 for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,100));if(await evaluate('!!window.__owl')){ready=true;break;}}
 assert(ready,'App did not load: '+JSON.stringify(errors));
 await evaluate('__owl.renderer.setAnimationLoop(null)');
 const frames=await evaluate(`(()=>{
  const m=__owl.flightMotion;m.sample(30);
  const first=m.segments.find(s=>s.kind==='flap'),beat=first.beats[0];
  const pause=m.segments.find(s=>s.kind==='glide'&&s.start>0);
  const next=m.segments.find(s=>s.kind==='flap'&&s.start>=pause.end),b=next.beats[0];
  return [{name:'full-depth',time:first.start+beat.start+(beat.end-beat.start)*.56},
   {name:'recovery',time:first.start+beat.end},
   {name:'pause',time:(pause.start+pause.end)/2},
   {name:'resume',time:next.start+b.start+(b.end-b.start)*.56}];
 })()`);
 for(const f of frames){
  // Rebuild each wake from zero with the same <=1/30-second step sequence.
  await evaluate(`__owl.renderAt(0);__owl.renderAt(${f.time})`);
  const shot=await call('Page.captureScreenshot',{format:'png'});
  await writeFile(join(output,`phantom-${f.name}.png`),Buffer.from(shot.data,'base64'));
 }
 const desktop=await evaluate(`({source:[__owl.maps.width,__owl.maps.height],seed:__owl.seed,
  geometryVertices:__owl.owl.geometry.attributes.position.count,triangles:__owl.owl.geometry.index.count/3,
  finiteGeometry:Array.from(__owl.owl.geometry.attributes.position.array).every(Number.isFinite),
  cloudSize:[__owl.cloud.width,__owl.cloud.height],cloudTextureType:__owl.cloud.dye[0].texture.type,
  colorFrame:__owl.cloud.displayMaterial.uniforms.u_owlFrame.value.toArray(),
  programs:__owl.renderer.info.programs.map(p=>({runnable:p.diagnostics?.runnable??true})),
  text:document.body.innerText,background:getComputedStyle(document.body).backgroundColor})`);
 assert.deepEqual(desktop.source,[2172,724]);assert(desktop.finiteGeometry);
 assert(desktop.colorFrame.every(Number.isFinite));assert(desktop.programs.every(p=>p.runnable));
 assert.equal(desktop.text,'');assert.equal(desktop.background,'rgb(255, 255, 255)');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate(`window.dispatchEvent(new Event('resize'));__owl.renderAt(0);__owl.renderAt(${frames[0].time})`);
 const mobile=await call('Page.captureScreenshot',{format:'png'});
 await writeFile(join(output,'phantom-mobile.png'),Buffer.from(mobile.data,'base64'));
 const report={seed:12345,desktopViewport:[1440,1000],devicePixelRatio:1,mobileViewport:[390,844],frames,motionChecks,desktop,errors};
 await writeFile(join(output,'capture-manifest.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);
}finally{ws.close();}

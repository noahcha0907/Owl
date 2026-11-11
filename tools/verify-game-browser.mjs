// Node 22+, a local server on 8000, and a dedicated Chrome debug port 9223.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.argv[2]||'/tmp/owl-game-qa-captures';await mkdir(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9223/json')).json();
const page=pages.find(p=>p.type==='page');assert(page);
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{
 const msg=JSON.parse(event.data);
 if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);
 if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry);
 if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(msg.params.args);
 if(msg.id){const p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}}
});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP timeout: '+method));},45000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64'));}
async function click(x,y){await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});}
async function clickButton(selector){const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await click(p.x,p.y);}
async function load(url){
 await call('Page.navigate',{url});
 for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,100));if(await evaluate('!!window.__game'))return;}
 throw Error('Game did not load: '+JSON.stringify(errors));
}
const targetPoint=`(()=>{
 const e=[...__game.sprites.values()].sort((a,b)=>b.layout.progress-a.layout.progress)[0];
 if(!e)return null;
 // Find a point on the actual deformed silhouette, then click through the browser.
 for(const v of [.5,.55,.6,.45,.65,.4])for(const u of [.5,.45,.55,.4,.6]){
  if(e.effect.hitTest(u,v))return {id:e.owl.id,x:e.layout.x+(u-.5)*e.layout.width,y:e.layout.y+(.5-v)*e.layout.height};
 }
 return null;
})()`;
try{
 await call('Runtime.enable');await call('Log.enable');await call('Page.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await load('http://127.0.0.1:8000/?seed=12345&test=1');
 assert.equal(await evaluate('location.pathname'),'/app/game/');
 assert.equal(await evaluate('__game.state.status'),'menu');assert.equal(await evaluate('document.querySelector("#hud").hidden'),true);
 const menuFraming=await evaluate('({aspect:__game.menuEffect.camera.aspect,pixels:[__game.renderer.domElement.width,__game.renderer.domElement.height]})');
 assert.equal(menuFraming.aspect,1440/1000);assert.deepEqual(menuFraming.pixels,[1440,1000]);
 await evaluate('__game.step(1)');await shot('00-menu');
 assert.equal(await evaluate('__game.state.elapsed'),0);assert.equal(await evaluate('__game.state.owls.length'),0);
 await clickButton('#start');assert.equal(await evaluate('__game.state.status'),'playing');
 assert.equal(await evaluate('document.querySelector("#lives").textContent'),'4 lives');
 await evaluate('__game.step(.4)');await shot('01-distant');
 assert.equal(await evaluate('__game.state.owls.length'),1);
 await click(10,10);assert.equal(await evaluate('__game.state.score'),0);
 // Advance only rules for staging; visual simulation is still rendered normally.
 await evaluate('__game.state.advance(9);__game.step(.2)');await shot('02-approaching');
 const before=await evaluate('__game.state.owls.length'),point=await evaluate(targetPoint);assert(point,'No silhouette to hit');
 const corner=await evaluate(`(()=>{const e=__game.sprites.get(${point.id});return {x:e.layout.x-e.layout.width*.48,y:e.layout.y-e.layout.height*.48};})()`);
 await click(corner.x,corner.y);assert.equal(await evaluate('__game.state.score'),0,'Transparent rectangle corner must miss');
 await click(point.x,point.y);
 assert.equal(await evaluate('__game.state.score'),10);assert.equal(await evaluate('__game.state.owls.length'),before-1);
 assert.equal(await evaluate('__game.bursts.items.length'),1);assert.equal(await evaluate('document.querySelector("#score").textContent'),'10 pts');
 await click(point.x,point.y);assert.equal(await evaluate('__game.state.score'),10);
 await evaluate('__game.step(.35)');await shot('03-burst');
 assert.equal(await evaluate('__game.bursts.items[0].field.constructor.name'),'CloudField');
 await evaluate('__game.step(3)');assert.equal(await evaluate('__game.bursts.items.length'),0);
 // The round ends only after four missed owls have completed their fly-past.
 await evaluate('__game.state.advance(20);__game.step(.01)');await shot('04-game-over');
 assert.equal(await evaluate('__game.state.status'),'over');assert.equal(await evaluate('document.querySelector("#game-over").hidden'),false);
 assert.equal(await evaluate('__game.state.lives'),0);assert.equal(await evaluate('document.querySelector("#lives").textContent'),'0 lives');
 await click(point.x,point.y);assert.equal(await evaluate('__game.state.score'),10);
 const restart=await evaluate('(()=>{const r=document.querySelector("#restart").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');await click(restart.x,restart.y);
 assert.equal(await evaluate('__game.state.status'),'playing');assert.equal(await evaluate('__game.state.score'),0);assert.equal(await evaluate('__game.state.owls.length'),0);
 assert.equal(await evaluate('__game.state.lives'),4);
 // Watch a missed owl continue through the camera, with exactly one life charged.
 await evaluate(`(()=>{const s=__game.state,o=s.spawn();s.nextSpawn=100;s.elapsed=o.lifetime+.45;__game.refresh();})()`);
 await shot('11-flying-past');assert.equal(await evaluate('__game.state.lives'),4);
 const beforePass=await evaluate('(()=>{const e=[...__game.sprites.values()][0];return {x:e.layout.x,y:e.layout.y,width:e.layout.width};})()');
 await evaluate('__game.step(.25)');
 const afterPass=await evaluate('(()=>{const e=[...__game.sprites.values()][0];return {x:e.layout.x,y:e.layout.y,width:e.layout.width};})()');
 assert(Math.abs(afterPass.x-720)<=Math.abs(beforePass.x-720));assert(Math.abs(afterPass.y-500)<=Math.abs(beforePass.y-500));assert(afterPass.width>=beforePass.width);
 await shot('13-through-camera');
 await evaluate('__game.step(.8)');assert.equal(await evaluate('__game.state.lives'),3);assert.equal(await evaluate('__game.state.status'),'playing');
 assert.equal(await evaluate('document.querySelector("#lives").textContent'),'3 lives');
 await evaluate('__game.step(.1)');assert.equal(await evaluate('__game.state.lives'),3);
 await evaluate('__game.reset()');
 // Deliberately overlap two identical silhouettes: the closer owl wins once.
 await evaluate(`(()=>{const s=__game.state;s.spawn();s.spawn();s.elapsed=8;s.owls.forEach((o,i)=>{o.x=o.y=.5;o.phase=0;o.variant=0;o.born=i;});__game.refresh();})()`);
 const near=await evaluate(targetPoint);assert(near);await click(near.x,near.y);
 assert.equal(await evaluate('__game.state.score'),10);assert.equal(await evaluate(`__game.state.owls.some(o=>o.id===${near.id})`),false);assert.equal(await evaluate('__game.state.owls.length'),1);
 // Portrait resize and real touch input.
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await load('http://127.0.0.1:8000/app/game/?seed=12345&test=1');await shot('12-mobile-menu');
 await clickButton('#start');await evaluate('__game.state.advance(10);__game.step(.1)');await shot('05-mobile');
 const mobile=await evaluate(targetPoint);assert(mobile);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobile.x,y:mobile.y}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await evaluate('__game.state.score'),10);
 // Near-viewer rendering must execute the shader at physical screen resolution.
 // Stage a large target on a Retina-density display, then release its full field.
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:2,mobile:false});
 await load('http://127.0.0.1:8000/app/game/?seed=12345&test=1');
 await clickButton('#start');
 await evaluate(`(()=>{
  const s=__game.state,o=s.spawn();o.x=o.y=.5;o.variant=0;
  s.elapsed=o.lifetime*.992;s.nextSpawn=100;
  __game.refresh();
 })()`);
 const resolution=await evaluate(`(()=>{const e=[...__game.sprites.values()][0];return {
  physicalOwlViewport:e.layout.width*__game.renderer.getPixelRatio(),
  framebuffer:[__game.renderer.domElement.width,__game.renderer.domElement.height],
  directShader:__game.effects.every(effect=>!effect.target&&typeof effect.renderDirect==='function')
 };})()`);
 assert(resolution.physicalOwlViewport>2000);assert(resolution.directShader);
 await shot('07-close-retina');
 const close=await evaluate(targetPoint);assert(close);await click(close.x,close.y);
 assert.equal(await evaluate('__game.state.owls.length'),0);
 assert.equal(await evaluate('__game.bursts.items[0].field.velocity[0]!==__game.effects[0].cloud.velocity[0]'),true);
 await evaluate('__game.step(.2)');await shot('08-cloud-release');
 await evaluate('__game.step(.65)');await shot('09-cloud-drift');
 await evaluate('__game.step(1.2)');await shot('10-cloud-fade');
 await evaluate('__game.step(.5)');assert.equal(await evaluate('__game.bursts.items.length'),0);
 const programs=await evaluate('__game.renderer.info.programs.map(p=>p.diagnostics?.runnable??true)');assert(programs.every(Boolean));
 // Exercise the actual animation loop without test mode, not just manual state.
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await load('http://127.0.0.1:8000/app/game/?seed=12345');
 await clickButton('#start');
 const performance=await evaluate(`new Promise(resolve=>{let frames=0;const start=performance.now(),gameStart=__game.state.elapsed;function count(){frames++;if(performance.now()-start<4000)requestAnimationFrame(count);else resolve({frames,wallSeconds:(performance.now()-start)/1000,gameSeconds:__game.state.elapsed-gameStart,owls:__game.state.owls.length});}requestAnimationFrame(count);})`);
 await shot('06-live');assert(performance.owls>=2);assert(performance.frames>40,'Game should remain responsive');
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={checks:'passed',pointsPerHit:10,desktop:[1440,1000],mobile:[390,844],resolution,programs:programs.length,performance,errors};
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{ws.close();}

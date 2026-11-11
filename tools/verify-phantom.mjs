// Local browser QA and deterministic export of computed surface data.
// Start Chrome with --remote-debugging-port=9223 before running.
import {writeFile,mkdir} from 'node:fs/promises';
const pages=await(await fetch('http://127.0.0.1:9223/json')).json();
const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});}
await call('Log.clear');await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:8000/app/?time=0'});
let ready=false;
for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));const result=await call('Runtime.evaluate',{expression:'!!window.__owl',returnByValue:true});if(result.result.value){ready=true;break;}}
if(!ready)throw new Error(JSON.stringify(errors));
await mkdir('assets/owls/barn-owl/maps',{recursive:true});
for(const name of ['normal','relief']){
const expression=`(()=>{const t=window.__owl.maps.${name};const c=document.createElement('canvas');c.width=t.image.width;c.height=t.image.height;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(t.image.data),c.width,c.height),0,0);return c.toDataURL('image/png');})()`;
const result=await call('Runtime.evaluate',{expression,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
await writeFile(`assets/owls/barn-owl/maps/phantom-front-${name}.png`,Buffer.from(result.result.value.split(',')[1],'base64'));
}
const summary=await call('Runtime.evaluate',{expression:`JSON.stringify({width:__owl.maps.width,height:__owl.maps.height,programs:__owl.renderer.info.programs.map(p=>({runnable:p.diagnostics?.runnable??true})),provenance:__owl.maps.provenance})`,returnByValue:true});
for(const time of [0,12,30]){
 await call('Runtime.evaluate',{expression:`__owl.renderer.setAnimationLoop(null);if(__owl.renderAt){__owl.renderAt(${time});}else{__owl.uniforms.u_time.value=${time};var motion=__owl.flightMotion?.sample(${time});__owl.uniforms.u_flap.value=motion?motion.stroke:Math.sin(${time}*1.6);if(__owl.uniforms.u_wrist)__owl.uniforms.u_wrist.value=motion?.wrist??0;if(__owl.uniforms.u_depth)__owl.uniforms.u_depth.value=motion?.depth??0;if(__owl.uniforms.u_depthTip)__owl.uniforms.u_depthTip.value=motion?.depthTip??0;if(__owl.wingWake)__owl.uniforms.u_wake.value.set(...__owl.wingWake.sample(${time}).offset);__owl.renderer.render(__owl.scene,__owl.camera);}`});
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(`/tmp/phantom-${time}.png`,Buffer.from(shot.data,'base64'));
}
console.log(summary.result.value);console.log(JSON.stringify({errors}));
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await call('Runtime.evaluate',{expression:'window.dispatchEvent(new Event("resize"));__owl.renderer.render(__owl.scene,__owl.camera)'});
const mobile=await call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/phantom-mobile.png',Buffer.from(mobile.data,'base64'));
ws.close();if(errors.length)process.exitCode=1;

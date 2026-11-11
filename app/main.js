import * as THREE from '../vendor/three/three.module.js';
import {buildSurfaceMaps} from '../effects/phantom-owl/surface-maps.js';
import {buildWingVolume} from '../effects/phantom-owl/wing-volume.mjs';
import {CloudField} from '../effects/cloud-wake/cloud-field.mjs';
import {createFlightMotion,createWingWake} from '../effects/phantom-owl/flight-motion.mjs';
const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.autoClear=false;renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(28,1,.1,20);camera.position.z=4;
camera.updateMatrixWorld();
const [response,colorResponse,vertexResponse]=await Promise.all([
 fetch(new URL('../effects/phantom-owl/owl-surface.glsl',import.meta.url)),
 fetch(new URL('../effects/phantom-color/phantom-color.glsl',import.meta.url)),
 fetch(new URL('../effects/phantom-owl/wing-deformation.glsl',import.meta.url))
]);
if(!response.ok||!colorResponse.ok||!vertexResponse.ok)throw new Error('Shader load failed');
const colorShader=await colorResponse.text();
const surfaceShader=(await response.text()).replace('#include <phantom_color>',colorShader);
const texture=await new THREE.TextureLoader().loadAsync(new URL('../assets/owls/barn-owl/generated/phantom-front-v1.png',import.meta.url).href);
texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
const maps=buildSurfaceMaps(texture.image);
const uniforms={u_time:{value:0},u_resolution:{value:new THREE.Vector2(16,9)},u_owl:{value:texture},u_flap:{value:0},u_wrist:{value:0},u_depth:{value:0},u_depthTip:{value:0},u_wake:{value:new THREE.Vector2()},u_imageAspect:{value:maps.width/maps.height},u_normal:{value:maps.normal},u_relief:{value:maps.relief}};
uniforms.u_leftWing={value:new THREE.Vector4()};uniforms.u_rightWing={value:new THREE.Vector4()};uniforms.u_fold={value:new THREE.Vector2()};
uniforms.u_visibility={value:1};
const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:true,depthWrite:true,vertexShader:await vertexResponse.text(),fragmentShader:surfaceShader});
const owl=new THREE.Mesh(buildWingVolume(texture.image),material);owl.renderOrder=100;owl.frustumCulled=false;scene.add(owl);
const cloud=new CloudField(renderer,colorShader);
let simulationTime=0;
function resize(){renderer.setSize(innerWidth,innerHeight);const a=innerWidth/innerHeight;camera.aspect=a;camera.updateProjectionMatrix();const w=Math.min(a*1.4,2.3);owl.scale.set(w,w*maps.height/maps.width,w);cloud.resize(innerWidth,innerHeight);simulationTime=0;}
addEventListener('resize',resize);resize();
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Optional deterministic QA time; no controls/text in the visible experience.
const params=new URLSearchParams(location.search);
const fixed=params.get('time');
const seed=params.has('seed')?Number(params.get('seed')):(fixed===null?crypto.getRandomValues(new Uint32Array(1))[0]:12345);
const flightMotion=createFlightMotion(seed);
const wingWake=createWingWake(flightMotion);
let elapsed=0,previous=performance.now();
function pose(mesh,t,motion){
 const a=innerWidth/innerHeight;
 mesh.position.set(Math.sin(t*.10)*a*.11,Math.sin(t*.18)*.08+motion.heave,0);
 mesh.rotation.z=Math.sin(t*.10)*.025+motion.bank;
}
function setMotion(target,t,motion,wake){
 target.u_time.value=t;target.u_flap.value=motion.stroke;target.u_wrist.value=motion.wrist;
 target.u_depth.value=motion.depth;target.u_depthTip.value=motion.depthTip;
 const l=motion.left,r=motion.right;
 target.u_leftWing.value.set(l.stroke,l.wrist,l.depth,l.depthTip);
 target.u_rightWing.value.set(r.stroke,r.wrist,r.depth,r.depthTip);
 target.u_fold.value.set(l.fold,r.fold);
 target.u_wake.value.set(...wake);
}
const emitterSpans=[.22,.33,.43];
function wingPoints(t){
 const m=flightMotion.sample(t);pose(owl,t,m);owl.updateMatrixWorld(true);
 const points=[];
 for(const side of [-1,1])for(const span of emitterSpans){
  const wing=side<0?m.left:m.right;
  const reach=span-.085;
  const outer=THREE.MathUtils.smoothstep(span,.20,.48);
  const angle=THREE.MathUtils.lerp(wing.stroke,wing.wrist,outer*.55);
  const depth=THREE.MathUtils.lerp(wing.depth,wing.depthTip,outer*.65);
  const power=Math.max(-wing.stroke,0);
  const x=side*(.085+reach*Math.cos(angle*.60)*Math.cos(depth)-outer*power*.018-reach*wing.fold*outer*.13);
  const y=.06+(reach*.68+outer*.075)*Math.sin(angle)*maps.width/maps.height;
  const z=reach*Math.sin(depth)+.045+.075*power+wing.fold*outer*.03;
  const point=new THREE.Vector3(x,y,z).applyMatrix4(owl.matrixWorld).project(camera);
  points.push(new THREE.Vector2(point.x*.5+.5,point.y*.5+.5));
 }
 return points;
}
function updatePose(t){
 const m=flightMotion.sample(t),wake=wingWake.sample(t);
 setMotion(uniforms,t,m,wake.offset);pose(owl,t,m);
}
function renderAt(t){
 if(t<simulationTime){cloud.reset();simulationTime=0;}
 // Backtrace the velocity/color buffers in small time steps; no pose copies.
 while(simulationTime<t-.00001){
  const dt=Math.min(1/30,t-simulationTime),next=simulationTime+dt;
  const before=wingPoints(simulationTime),after=wingPoints(next);
  const emitters=after.map((p,i)=>new THREE.Vector4(p.x,p.y,(p.x-before[i].x)/dt,(p.y-before[i].y)/dt));
  updatePose(next);
  cloud.step(dt,next,emitters,()=>renderer.render(scene,camera));
  simulationTime=next;
 }
 updatePose(t);
 const center=owl.position.clone().project(camera);
 const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*(camera.position.z-owl.position.z);
 cloud.setOwlFrame(center.x*.5+.5,center.y*.5+.5,owl.scale.x/(viewHeight*camera.aspect),owl.scale.y/viewHeight);
 cloud.render(()=>renderer.render(scene,camera));
}
renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.05);previous=now;if(!reduce)elapsed+=dt;
 const t=fixed===null?elapsed:Math.max(0,Number(fixed)||0);renderAt(t);
});
// Inspectable numeric maps for QA; UVs, normal and relief all share source pixels.
window.__owl={renderer,scene,camera,owl,maps,uniforms,flightMotion,wingWake,seed,cloud,renderAt};

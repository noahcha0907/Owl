import * as THREE from '../../vendor/three/three.module.js';
import {buildSurfaceMaps} from './surface-maps.js';
import {buildWingVolume} from './wing-volume.mjs';
import {createFlightMotion,createWingWake} from './flight-motion.mjs';
import {CloudField} from '../cloud-wake/cloud-field.mjs';

export async function loadOwlResources(){
 const read=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`Could not load ${path}`);return response.text();};
 const [color,fragment,vertex,texture]=await Promise.all([
  read('../phantom-color/phantom-color.glsl'),read('./owl-surface.glsl'),read('./wing-deformation.glsl'),
  new THREE.TextureLoader().loadAsync(new URL('../../assets/owls/barn-owl/generated/phantom-front-v1.png',import.meta.url).href)
 ]);
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 return {color,fragment:fragment.replace('#include <phantom_color>',color),vertex,texture,
  maps:buildSurfaceMaps(texture.image),geometry:buildWingVolume(texture.image)};
}

// Share motion and air simulation, but shade every target at screen resolution.
// The original single-owl preview remains independently available at /app/.
export class OwlEffect {
 constructor(renderer,resources,seed,{width=512,height=320}={}){
  this.renderer=renderer;this.resources=resources;this.aspect=width/height;this.time=0;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(28,this.aspect,.1,20);
  this.camera.position.z=4;this.camera.updateMatrixWorld();
  const {maps,texture}=resources;
  this.uniforms={u_time:{value:0},u_visibility:{value:1},u_resolution:{value:new THREE.Vector2(16,9)},
   u_owl:{value:texture},u_normal:{value:maps.normal},u_relief:{value:maps.relief},
   u_imageAspect:{value:maps.width/maps.height},u_flap:{value:0},u_wrist:{value:0},
   u_depth:{value:0},u_depthTip:{value:0},u_wake:{value:new THREE.Vector2()},
   u_leftWing:{value:new THREE.Vector4()},u_rightWing:{value:new THREE.Vector4()},u_fold:{value:new THREE.Vector2()}};
  this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:resources.vertex,
   fragmentShader:resources.fragment,transparent:true,depthTest:true,depthWrite:true});
  this.owl=new THREE.Mesh(resources.geometry,this.material);this.owl.frustumCulled=false;this.owl.renderOrder=100;
  const w=Math.min(this.aspect*1.4,2.3);this.owl.scale.set(w,w*maps.height/maps.width,w);this.scene.add(this.owl);
  this.motion=createFlightMotion(seed);this.wake=createWingWake(this.motion);
  this.cloud=new CloudField(renderer,resources.color,{width,height});
  this.cloudLayer=this.cloud.createLayerMaterial();
  this.maskTarget=new THREE.WebGLRenderTarget(256,160,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  this.maskMaterial=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:resources.vertex,
   fragmentShader:'uniform sampler2D u_owl;varying vec2 vUv;void main(){if(texture2D(u_owl,vUv).a<.55)discard;gl_FragColor=vec4(1.0);}',depthTest:true,depthWrite:true});
  this.draw=()=>renderer.render(this.scene,this.camera);
  this.renderAt(0);
 }
 pose(t,motion){
  this.owl.position.set(Math.sin(t*.10)*this.aspect*.11,Math.sin(t*.18)*.08+motion.heave,0);
  this.owl.rotation.z=Math.sin(t*.10)*.025+motion.bank;
 }
 updatePose(t){
  const motion=this.motion.sample(t),wake=this.wake.sample(t),u=this.uniforms;
  u.u_time.value=t;u.u_flap.value=motion.stroke;u.u_wrist.value=motion.wrist;
  u.u_depth.value=motion.depth;u.u_depthTip.value=motion.depthTip;
  for(const [key,wing] of [['u_leftWing',motion.left],['u_rightWing',motion.right]])u[key].value.set(wing.stroke,wing.wrist,wing.depth,wing.depthTip);
  u.u_fold.value.set(motion.left.fold,motion.right.fold);u.u_wake.value.set(...wake.offset);this.pose(t,motion);
 }
 wingPoints(t){
  const motion=this.motion.sample(t);this.pose(t,motion);this.owl.updateMatrixWorld(true);
  const points=[];
  for(const side of [-1,1])for(const span of [.22,.33,.43]){
   const wing=side<0?motion.left:motion.right,reach=span-.085,outer=THREE.MathUtils.smoothstep(span,.20,.48);
   const angle=THREE.MathUtils.lerp(wing.stroke,wing.wrist,outer*.55);
   const depth=THREE.MathUtils.lerp(wing.depth,wing.depthTip,outer*.65),power=Math.max(-wing.stroke,0);
   const x=side*(.085+reach*Math.cos(angle*.60)*Math.cos(depth)-outer*power*.018-reach*wing.fold*outer*.13);
   const y=.06+(reach*.68+outer*.075)*Math.sin(angle)*this.uniforms.u_imageAspect.value;
   const z=reach*Math.sin(depth)+.045+.075*power+wing.fold*outer*.03;
   const point=new THREE.Vector3(x,y,z).applyMatrix4(this.owl.matrixWorld).project(this.camera);
   points.push(new THREE.Vector2(point.x*.5+.5,point.y*.5+.5));
  }
  return points;
 }
 interactionPoints(t){
  const points=this.wingPoints(t);
  const center=new THREE.Vector3(0,0,.04).applyMatrix4(this.owl.matrixWorld).project(this.camera);
  points.push(new THREE.Vector2(center.x*.5+.5,center.y*.5+.5));
  return points;
 }
 renderAt(time){
  if(time<this.time){this.cloud.reset();this.time=0;}
  while(this.time<time-.00001){
   const dt=Math.min(1/30,time-this.time),next=this.time+dt;
   const before=this.wingPoints(this.time),after=this.wingPoints(next);
   const emitters=after.map((p,i)=>new THREE.Vector4(p.x,p.y,(p.x-before[i].x)/dt,(p.y-before[i].y)/dt));
   this.updatePose(next);this.cloud.step(dt,next,emitters,this.draw);this.time=next;
  }
  this.updatePose(time);
  const center=this.owl.position.clone().project(this.camera);
  const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5))*this.camera.position.z;
  this.cloud.setOwlFrame(center.x*.5+.5,center.y*.5+.5,this.owl.scale.x/(viewHeight*this.aspect),this.owl.scale.y/viewHeight);
 }
 resize(width,height){
  this.aspect=width/height;this.camera.aspect=this.aspect;this.camera.updateProjectionMatrix();
  const w=Math.min(this.aspect*1.4,2.3),maps=this.resources.maps;
  this.owl.scale.set(w,w*maps.height/maps.width,w);this.cloud.resize(width,height);
  this.time=0;this.renderAt(0);
 }
 renderDirect(opacity=1){
  // The caller sets a viewport for this approaching owl. No enlarged bitmap.
  this.uniforms.u_visibility.value=opacity;
  this.cloud.drawLayer(this.cloudLayer,opacity);this.draw();
  this.uniforms.u_visibility.value=1;
 }
 hitTest(u,v,radiusU=0,radiusV=0){
  const r=this.renderer,target=this.maskTarget,previous=r.getRenderTarget();
  const color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
  try{
   this.owl.material=this.maskMaterial;r.setRenderTarget(target);r.setClearColor(0,0);r.clear();this.draw();
   const cx=u*target.width,cy=v*target.height,rx=Math.max(1,radiusU*target.width),ry=Math.max(1,radiusV*target.height);
   const x=Math.max(0,Math.floor(cx-rx)),y=Math.max(0,Math.floor(cy-ry));
   const w=Math.min(target.width,Math.ceil(cx+rx+1))-x,h=Math.min(target.height,Math.ceil(cy+ry+1))-y;
   if(w<=0||h<=0)return false;
   const pixels=new Uint8Array(w*h*4);r.readRenderTargetPixels(target,x,y,w,h,pixels);
   for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    if(((x+i+.5-cx)/rx)**2+((y+j+.5-cy)/ry)**2<=1&&pixels[(j*w+i)*4]>127)return true;
   }
   return false;
  }finally{this.owl.material=this.material;r.setRenderTarget(previous);r.setClearColor(color,alpha);}
 }
 dispose(){
  this.cloudLayer.dispose();this.cloud.dispose();this.material.dispose();
  this.maskMaterial.dispose();this.maskTarget.dispose();
  // Source textures, feature maps, and geometry belong to the shared resources.
 }
}

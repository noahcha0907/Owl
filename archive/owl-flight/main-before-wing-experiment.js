import * as THREE from './vendor/three.module.js';
import {buildSurfaceMaps} from './surface-maps.js';
const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
const response=await fetch('./owl-surface.glsl');if(!response.ok)throw new Error('Shader load failed');
const texture=await new THREE.TextureLoader().loadAsync('../BarnOwl/generated/phantom-front-v1.png');
texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
const maps=buildSurfaceMaps(texture.image);
const uniforms={u_time:{value:0},u_resolution:{value:new THREE.Vector2(16,9)},u_owl:{value:texture},u_flap:{value:0},u_normal:{value:maps.normal},u_relief:{value:maps.relief}};
const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:await response.text()});
const owl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);scene.add(owl);
function resize(){renderer.setSize(innerWidth,innerHeight);const a=innerWidth/innerHeight;camera.left=-a;camera.right=a;camera.updateProjectionMatrix();const w=Math.min(a*1.4,2.3);owl.scale.set(w,w*maps.height/maps.width,1);}
addEventListener('resize',resize);resize();
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Optional deterministic QA time; no controls/text in the visible experience.
const fixed=new URLSearchParams(location.search).get('time');
let elapsed=0,previous=performance.now();
renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.05);previous=now;if(!reduce)elapsed+=dt;
 const t=fixed===null?elapsed:Math.max(0,Number(fixed)||0);
 uniforms.u_time.value=t;uniforms.u_flap.value=Math.sin(t*1.6);
 const a=innerWidth/innerHeight;owl.position.set(Math.sin(t*.10)*a*.11,Math.sin(t*.18)*.08,0);owl.rotation.z=Math.sin(t*.10)*.025;
 renderer.render(scene,camera);
});
// Inspectable numeric maps for QA; UVs, normal and relief all share source pixels.
window.__owl={renderer,scene,camera,owl,maps,uniforms};

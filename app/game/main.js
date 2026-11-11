import * as THREE from '../../vendor/three/three.module.js';
import {GameState,projectOwl} from '../../game/game-state.mjs';
import {loadOwlResources,OwlEffect} from '../../effects/phantom-owl/owl-effect.js';
import {CloudBursts} from '../../effects/cloud-burst/cloud-burst.js';

const canvas=document.querySelector('#scene'),score=document.querySelector('#score');
const loading=document.querySelector('#loading'),overlay=document.querySelector('#game-over'),restart=document.querySelector('#restart');
const menu=document.querySelector('#menu'),startButton=document.querySelector('#start'),hud=document.querySelector('#hud'),lives=document.querySelector('#lives');
const params=new URLSearchParams(location.search),manual=params.get('test')==='1';
const initialSeed=params.has('seed')?Number(params.get('seed')):crypto.getRandomValues(new Uint32Array(1))[0];

async function start(){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
 renderer.autoClear=false;renderer.setClearColor(0xffffff,1);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const gl=renderer.getContext(),maxViewport=Math.min(...gl.getParameter(gl.MAX_VIEWPORT_DIMS))/renderer.getPixelRatio();
 const resources=await loadOwlResources();
 // Match /app/ exactly: full canvas, identical camera framing and pixel ratio.
 let menuEffect=new OwlEffect(renderer,resources,initialSeed,{width:innerWidth,height:innerHeight});
 const effects=Array.from({length:3},(_,i)=>new OwlEffect(renderer,resources,(initialSeed+i*8191)>>>0));
 // Seeded phases keep the shared live effects visibly independent.
 const offsets=[.85,1.6,2.4];effects.forEach((effect,i)=>effect.renderAt(offsets[i]));
 const state=new GameState(initialSeed),sprites=new Map();
 const bursts=new CloudBursts(renderer);
 let width=innerWidth,height=innerHeight,visualTime=0,previous=performance.now(),shownOver=false;
 function resize(){
  const w=innerWidth,h=innerHeight;bursts.resize(w/width,h/height);width=w;height=h;
  renderer.setSize(width,height);
  if(menuEffect){menuEffect.resize(width,height);visualTime=0;}
  syncSprites();draw();
 }
 function syncSprites(){
  const live=new Set(state.owls.map(owl=>owl.id));
  for(const id of sprites.keys())if(!live.has(id))sprites.delete(id);
  for(const owl of state.owls){
   let entry=sprites.get(owl.id);
   if(!entry){
    entry={effect:effects[owl.variant],owl};sprites.set(owl.id,entry);
   }
   const layout=projectOwl(owl,state.elapsed,width,height,maxViewport);entry.layout=layout;
  }
 }
 function draw(){
  renderer.setRenderTarget(null);renderer.setViewport(0,0,width,height);renderer.setClearColor(0xffffff,1);renderer.clear();
  if(state.status==='menu'){
   menuEffect.renderDirect();
   const viewHeight=2*Math.tan(28*Math.PI/360)*4;
   const owlWidth=menuEffect.owl.scale.x/viewHeight*height;
   menu.style.setProperty('--start-top',`${Math.min(height-76,height*.5+owlWidth*.30+24)}px`);
   return;
  }
  for(const entry of [...sprites.values()].sort((a,b)=>a.layout.progress-b.layout.progress)){
   const l=entry.layout;
   if(l.opacity<=.001)continue;
   renderer.setViewport(l.x-l.width/2,height-l.y-l.height/2,l.width,l.height);
   renderer.clearDepth();entry.effect.renderDirect(l.opacity);
  }
  bursts.render(height);renderer.setViewport(0,0,width,height);
 }
 function advance(dt){
  visualTime+=dt;state.advance(dt);
  if(state.status==='menu')menuEffect.renderAt(visualTime);
  else effects.forEach((effect,i)=>effect.renderAt(visualTime+offsets[i]));
  bursts.update(visualTime);syncSprites();
  lives.textContent=`${state.lives} ${state.lives===1?'life':'lives'}`;
  if(state.status==='over'&&!shownOver){
   shownOver=true;document.querySelector('#final-score').textContent=`${state.score} points`;
   overlay.hidden=false;restart.focus({preventScroll:true});
  }
  draw();
 }
 function shootAt(x,y,pointerType='mouse'){
  if(state.status!=='playing')return null;
  const padding=pointerType==='touch'?10:5;
  const candidates=[...sprites.values()].sort((a,b)=>b.layout.progress-a.layout.progress);
  for(const entry of candidates){
   const {layout,effect,owl}=entry,u=(x-layout.x)/layout.width+.5,v=.5-(y-layout.y)/layout.height;
   if(layout.opacity<.1)continue;
   if(u< -padding/layout.width||u>1+padding/layout.width||v< -padding/layout.height||v>1+padding/layout.height)continue;
   if(!effect.hitTest(u,v,padding/layout.width,padding/layout.height))continue;
   if(!state.shoot(owl.id))return null;
   bursts.add(effect,layout,visualTime);score.textContent=`${state.score} pts`;
   syncSprites();draw();return owl.id;
  }
  return null;
 }
 function reset(){
  if(menuEffect){menuEffect.dispose();menuEffect=null;visualTime=0;}
  state.start(params.has('seed')?initialSeed:crypto.getRandomValues(new Uint32Array(1))[0]);
  bursts.clear();shownOver=false;overlay.hidden=true;menu.hidden=true;hud.hidden=false;
  score.textContent='0 pts';lives.textContent='4 lives';previous=performance.now();
  syncSprites();draw();restart.blur();startButton.blur();
 }
 canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary)return;
  event.preventDefault();const rect=canvas.getBoundingClientRect();shootAt(event.clientX-rect.left,event.clientY-rect.top,event.pointerType);
 });
 startButton.addEventListener('click',reset);restart.addEventListener('click',reset);addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>{previous=performance.now();});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);loading.hidden=false;loading.textContent='Graphics interrupted. Reload to play again.';});
 resize();loading.hidden=true;menu.hidden=false;
 renderer.setAnimationLoop(now=>{const dt=Math.min(Math.max(0,(now-previous)/1000),.05);previous=now;if(!manual&&!document.hidden)advance(dt);});
 // Numeric/render state is inspectable. Deterministic stepping is opt-in for QA.
 window.__game={state,renderer,effects,sprites,bursts,reset,shootAt,projectOwl,
  get menuEffect(){return menuEffect;},
  get viewport(){return {width,height};},get visualTime(){return visualTime;},
  ...(manual?{step:advance,refresh:()=>{syncSprites();draw();}}:{})};
}
start().catch(error=>{console.error(error);loading.hidden=false;loading.textContent='The owls could not load. Reload to try again.';});

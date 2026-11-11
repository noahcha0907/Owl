// Game rules stay independent of WebGL, input, and wall-clock time.
export const POINTS_PER_OWL=10;
export const BOARD_ASPECT=1.6;
export const STARTING_LIVES=4;
export const FLY_PAST_SECONDS=1.15;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;

export class GameState {
 constructor(seed=12345){this.reset(seed);}
 reset(seed=this.seed){
  this.seed=seed>>>0;this.randomState=this.seed||1;
  this.elapsed=0;this.score=0;this.lives=STARTING_LIVES;this.status='menu';this.owls=[];
  this.nextId=1;this.nextSpawn=.3;this.reached=null;this.escaped=0;
 }
 start(seed=this.seed){this.reset(seed);this.status='playing';}
 random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
 spawnInterval(){return Math.max(.24,1.65*Math.exp(-this.elapsed/38));}
 spawn(){
  let x=.08+this.random()*.84,y=.12+this.random()*.76;
  // Keep distant spawns away from the score, and spread consecutive arrivals.
  if(x>.75&&y<.2)y=.25+this.random()*.5;
  const previous=this.owls.at(-1);
  if(previous&&Math.hypot(x-previous.x,y-previous.y)<.22)x=x<.5?.78:.22;
  const owl={id:this.nextId++,born:this.elapsed,x,y,
   lifetime:Math.max(6.8,11-this.elapsed*.025)+this.random()*2,
   phase:this.random()*Math.PI*2,variant:Math.floor(this.random()*3)};
  this.owls.push(owl);return owl;
 }
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0||this.status!=='playing')return;
  let remaining=seconds;
  while(remaining>1e-8&&this.status==='playing'){
   const dt=Math.min(remaining,1/60);this.elapsed+=dt;remaining-=dt;
   // Keep an owl visible and hittable during its fly-past. Charge one life
   // only when the target has passed through the camera plane.
   for(const owl of [...this.owls]){
    if(this.elapsed-owl.born<owl.lifetime+FLY_PAST_SECONDS)continue;
    this.owls.splice(this.owls.indexOf(owl),1);this.reached=owl.id;this.escaped++;
    this.lives=Math.max(0,this.lives-1);
    if(this.lives===0){this.status='over';break;}
   }
   if(this.status==='over')break;
   if(this.elapsed>=this.nextSpawn){this.spawn();this.nextSpawn=this.elapsed+this.spawnInterval();}
  }
 }
 shoot(id){
  if(this.status!=='playing')return null;
  const index=this.owls.findIndex(owl=>owl.id===id);
  if(index<0)return null;
  const [owl]=this.owls.splice(index,1);this.score+=POINTS_PER_OWL;return owl;
 }
}

export function projectOwl(owl,time,width,height,maxViewport=Infinity){
 const age=Math.max(0,time-owl.born),progress=Math.max(0,age/owl.lifetime);
 const journey=clamp(age/(owl.lifetime+FLY_PAST_SECONDS),0,1);
 const passing=clamp((age-owl.lifetime)/FLY_PAST_SECONDS,0,1),depth=1-journey;
 const short=Math.min(width,height);
 const start=clamp(short*.17,80,150);
 // One continuous approach, including the final second. No exit waypoint,
 // lateral turn, or change of size law when the owl reaches the viewer.
 const size=Math.min(start/Math.max(depth,.001),Math.max(width,height)*4,maxViewport);
 const pull=journey*journey*(3-2*journey);
 // A short near-camera dissolve avoids a full-screen pop at zero depth.
 const visibility=clamp(depth/.025,0,1),opacity=visibility*visibility*(3-2*visibility);
 return {x:mix(owl.x,.5,pull)*width,y:mix(owl.y,.5,pull)*height,
  width:size,height:size/BOARD_ASPECT,progress,passing,depth,opacity};
}

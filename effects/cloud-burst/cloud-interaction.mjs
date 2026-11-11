const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const screenPoint=(layout,p)=>({x:layout.x+(p.x-.5)*layout.width,y:layout.y+(.5-p.y)*layout.height});

// Transform live wing/body motion into each stationary cloud's UV space.
// Radius is in cloud-height units, matching CloudField's aspect-correct metric.
export function cloudDisturbances(cloud,motions,time){
 const result=[];
 for(const motion of motions){
  if(motion.dt<=0||motion.after.opacity<.02)continue;
  const fraction=clamp((time-motion.startTime)/motion.dt,0,1);
  const size=mix(motion.before.width,motion.after.width,fraction);
  const depth=mix(motion.before.depth,motion.after.depth,fraction);
  const proximity=.30+.70*Math.exp(-(((depth-cloud.depth)/.28)**2));
  for(let i=0;i<motion.to.length;i++){
   const from=screenPoint(motion.before,motion.from[i]),to=screenPoint(motion.after,motion.to[i]);
   const x=mix(from.x,to.x,fraction),y=mix(from.y,to.y,fraction);
   const body=i===6,radius=size*(body?.13:.055);
   const dx=Math.max(Math.abs(x-cloud.x)-cloud.width*.5,0),dy=Math.max(Math.abs(y-cloud.y)-cloud.height*.5,0);
   if(Math.hypot(dx,dy)>radius*2.5)continue;
   // Bound impulses from extreme near-camera magnification, without a hard
   // cutoff in spatial influence. All nearby owls contribute, in GPU batches.
   result.push({x:.5+(x-cloud.x)/cloud.width,y:.5-(y-cloud.y)/cloud.height,
    vx:clamp((to.x-from.x)/motion.dt/cloud.width,-1.4,1.4),
    vy:clamp(-(to.y-from.y)/motion.dt/cloud.height,-1.4,1.4),
    radius:Math.max(radius/cloud.height,.015),swirl:body?0:(i<3?1:-1),
    strength:proximity*motion.after.opacity*(body?.85:1),
    expansion:body?clamp((motion.after.width-motion.before.width)/motion.dt/cloud.height*.08,0,.45):0});
  }
 }
 return result;
}

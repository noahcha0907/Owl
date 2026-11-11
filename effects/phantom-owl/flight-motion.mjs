// Continuous strokes across 1–3-beat cycles, with a short glide after exactly
// 5, 6, or 7 completed flaps. Every downstroke keeps the same depth.
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10);};
// Preserve the deep power stroke at its full strength for every flap.
const upper=.59,lower=-1.02;
const amplitude=1.06,depthScale=1.14,tipGain=.94,tipPhaseLag=.08,foldStrength=.24;
function curve(keys,time){
 for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){
  const a=keys[i-1],b=keys[i];return a[1]+(b[1]-a[1])*smooth((time-a[0])/(b[0]-a[0]));
 }
 return 0;
}
const restingWing=()=>({stroke:0,wrist:0,depth:0,depthTip:0,fold:0});
function rest(sequence='coast'){return {mode:'glide',type:'glide',sequence,left:restingWing(),right:restingWing(),stroke:0,wrist:0,depth:0,depthTip:0,envelope:0,bank:0};}
export function createFlightMotion(seed=12345){
 let state=(seed>>>0)||1;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const between=(a,b)=>a+(b-a)*random();
 const segments=[],keys=[[0,0],[.8,0]],tipKeys=[[0,0],[.8,0]];let end=0,counts=[];
 let flapsSincePause=0,pauseAfter=5+Math.floor(random()*3);
 function glide(duration){segments.push({kind:'glide',start:end,end:end+duration});end+=duration;}
 function nextCount(){
  if(!counts.length){
   counts=[1,2,3];
   for(let i=counts.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[counts[i],counts[j]]=[counts[j],counts[i]];}
  }
  return counts.pop();
 }
 function burst(){
  const count=Math.min(nextCount(),pauseAfter-flapsSincePause),beats=[];let duration=0;
  for(let i=0;i<count;i++){
   const length=between(1.20,1.95);
   beats.push({type:'full-depth',start:duration,end:duration+length});
   keys.push([end+duration+length*.24,upper],[end+duration+length*.56,lower]);
   tipKeys.push([end+duration+length*(.24+tipPhaseLag),upper],[end+duration+length*(.56+tipPhaseLag),lower]);
   duration+=length;
  }
  segments.push({kind:'flap',sequence:`${count}-flap`,start:end,end:end+duration,beats});end+=duration;
  flapsSincePause+=count;
  if(flapsSincePause===pauseAfter){
   // Finish the last recovery at neutral, then hold it during the glide.
   // All preceding recoveries remain continuous through cycle boundaries.
   keys.push([end,0]);tipKeys.push([end,0]);
   glide(.85);
   keys.push([end,0]);tipKeys.push([end,0]);
   flapsSincePause=0;pauseAfter=5+Math.floor(random()*3);
  }
 }
 glide(.8);
 function raw(t){
  t=Math.max(0,t);
  // Generate the next upstroke before evaluating the last recovery, so the
  // curve can flow across a cycle boundary without stopping at neutral.
  while(end<=t||keys.at(-1)[0]<=t||tipKeys.at(-1)[0]<=t)burst();
  const segment=segments.find(s=>t<s.end);
  if(segment.kind==='glide')return rest();
  const local=t-segment.start,beat=segment.beats.find(b=>local>=b.start&&local<b.end);
  if(!beat)return rest(segment.sequence);
  // There are no neutral keys or gaps between beats. Only stroke extrema
  // reverse direction; neutral is crossed with nonzero upward velocity.
  const height=curve(keys,t);
  const envelope=(height/lower)**2;
  const stroke=height*amplitude,wrist=curve(tipKeys,t)*amplitude*tipGain;
  const left={stroke,wrist,depth:stroke*depthScale,depthTip:wrist*depthScale,fold:envelope*foldStrength};
  const right={...left};
  return {mode:'flap',type:beat.type,sequence:segment.sequence,left,right,
   stroke,wrist,depth:left.depth,depthTip:left.depthTip,envelope,bank:0};
 }
 function sample(t){
  t=Number.isFinite(t)?Math.max(0,t):0;
  const motion=raw(t),before=raw(Math.max(0,t-.004)),after=raw(t+.004);
  return {...motion,velocity:(after.stroke-before.stroke)/.008,
   depthVelocity:(after.depth-before.depth)/.008,heave:-motion.stroke*.009};
 }
 return {sample,segments};
}

// A small, non-oscillating slip for pigment still on the feathers. Detached
// color lives in CloudField; it has no spring or attraction back to the owl.
export function createWingWake(motion){
 const step=1/120,response=1-Math.exp(-3.2*step);
 let tick=0,offset=[0,0],velocity=[0,0];
 function sample(t){
  t=Number.isFinite(t)?Math.max(0,t):0;const targetTick=Math.floor(t/step);
  if(targetTick<tick){tick=0;offset=[0,0];velocity=[0,0];}
  while(tick<targetTick){
   const m=motion.sample((tick+.5)*step);
   const target=[-m.velocity*.035,-m.depthVelocity*.030];
   for(let i=0;i<2;i++){
    const delta=(target[i]-offset[i])*response;
    velocity[i]=delta/step;
    offset[i]+=delta;
   }
   tick++;
  }
  return {offset:[...offset],velocity:[...velocity]};
 }
 return {sample};
}

import assert from 'node:assert/strict';
import {GameState,projectOwl,STARTING_LIVES,FLY_PAST_SECONDS} from '../game/game-state.mjs';
import {cloudDisturbances} from '../effects/cloud-burst/cloud-interaction.mjs';

const game=new GameState(12345);
assert.equal(game.status,'menu');assert.equal(game.lives,4);
game.advance(30);assert.equal(game.elapsed,0);assert.equal(game.owls.length,0);
game.start();
game.advance(.29);assert.equal(game.owls.length,0);game.advance(.02);assert.equal(game.owls.length,1);
const owl=game.owls[0];let last=0;
assert.equal(projectOwl(owl,owl.born,1440,1000).width,150);
assert.equal(projectOwl(owl,owl.born,390,844).width,80);
for(let i=0;i<=100;i++){
 const layout=projectOwl(owl,owl.born+owl.lifetime*i/100,1440,1000);
 assert(layout.width>last);last=layout.width;
 assert(Number.isFinite(layout.x)&&Number.isFinite(layout.y));
}
assert.equal(game.shoot(-1),null);assert.equal(game.score,0);
assert.equal(game.shoot(owl.id).id,owl.id);assert.equal(game.score,10);
assert.equal(game.shoot(owl.id),null);assert.equal(game.score,10);
const spawnTimes=[],positions=[];
for(let i=0;i<9000;i++){
 game.advance(1/60);
 for(const target of [...game.owls]){spawnTimes.push(target.born);positions.push([target.x,target.y]);game.shoot(target.id);}
}
assert.equal(game.status,'playing');assert(spawnTimes.length>250);
assert(spawnTimes.at(-1)-spawnTimes.at(-2)<.3);
assert(spawnTimes[1]-spawnTimes[0]>1.4);
assert(positions.some(([x])=>x<.2)&&positions.some(([x])=>x>.8));
assert(positions.some(([,y])=>y<.25)&&positions.some(([,y])=>y>.75));
game.start();assert.equal(game.score,0);assert.equal(game.elapsed,0);assert.equal(game.owls.length,0);assert.equal(game.nextSpawn,.3);assert.equal(game.lives,STARTING_LIVES);
game.nextSpawn=Infinity;
for(let missed=1;missed<=4;missed++){
 const target=game.spawn();
 game.advance(target.lifetime+.3);assert.equal(game.lives,5-missed);assert(game.owls.includes(target));
 const passing=projectOwl(target,game.elapsed,1440,1000);assert(passing.passing>0);assert(passing.width>1320);
 const gone=projectOwl(target,target.born+target.lifetime+FLY_PAST_SECONDS,1440,1000);
 assert(gone.opacity<1e-12);
 assert(Math.abs(gone.x-720)>1440||Math.abs(gone.y-500)>1000);
 // Individual perspective lines continue outward without a turn or a common
 // destination. A centered line stays centered and passes through the camera.
 let previous=projectOwl(target,target.born,1440,1000);
 for(let i=1;i<=240;i++){
  const p=projectOwl(target,target.born+(target.lifetime+FLY_PAST_SECONDS)*i/240,1440,1000);
  assert(Math.abs(p.x-720)>=Math.abs(previous.x-720)-1e-8);
  assert(Math.abs(p.y-500)>=Math.abs(previous.y-500)-1e-8);
  assert(p.width>=previous.width);assert(Number.isFinite(p.width));
  const cross=(p.x/1440-.5)*(target.y-.5)-(p.y/1000-.5)*(target.x-.5);assert(Math.abs(cross)<1e-10);
  previous=p;
 }
 const center=projectOwl({...target,x:.5,y:.5,aimX:.5,aimY:.5},target.born+target.lifetime+.5,1440,1000);
 assert.equal(center.x,720);assert.equal(center.y,500);
 const t=target.born+target.lifetime,eps=.001;
 const left=projectOwl(target,t-eps,1440,1000),middle=projectOwl(target,t,1440,1000),right=projectOwl(target,t+eps,1440,1000);
 for(const key of ['x','y','width'])assert(Math.abs((right[key]-middle[key])-(middle[key]-left[key]))<.01);
 game.advance(FLY_PAST_SECONDS-.3+.02);assert.equal(game.lives,4-missed);assert(!game.owls.includes(target));
 assert.equal(game.status,missed===4?'over':'playing');
 game.advance(.1);assert.equal(game.lives,4-missed,'Each escape costs exactly one life');
}
assert.equal(game.escaped,4);assert(game.reached!==null);
const score=game.score,time=game.elapsed;assert.equal(game.shoot(game.reached),null);game.advance(10);assert.equal(game.elapsed,time);assert.equal(game.score,score);
game.start(7);game.nextSpawn=Infinity;const passingTarget=game.spawn();game.advance(passingTarget.lifetime+.2);
assert(game.shoot(passingTarget.id));game.advance(2);assert.equal(game.lives,4);assert.equal(game.score,10);
game.start(7);const twin=new GameState(7);twin.start();game.advance(5);twin.advance(5);assert.deepEqual(game.owls,twin.owls);
const cloud={x:300,y:300,width:400,height:250,depth:.4};
const points=Array.from({length:7},()=>({x:.5,y:.5}));
const motion={from:points,to:points,dt:.1,startTime:0,
 before:{...cloud,opacity:1},after:{...cloud,x:340,opacity:1}};
const nearby=cloudDisturbances(cloud,[motion],.1);
assert.equal(nearby.length,7);assert(Math.abs(nearby[0].x-.6)<1e-10);assert.equal(nearby[0].y,.5);
assert.equal(nearby[0].vx,1);assert.equal(nearby[0].swirl,1);assert.equal(nearby[3].swirl,-1);
const far={...motion,before:{...motion.before,x:2000},after:{...motion.after,x:2040}};
assert.equal(cloudDisturbances(cloud,[far],.1).length,0);
assert.equal(cloudDisturbances(cloud,[motion,motion],.1).length,14,'All nearby owls contribute');
const growing={...motion,after:{...motion.after,width:440}};
assert(cloudDisturbances(cloud,[growing],.1)[6].expansion>0);
const smallCloud={...cloud,width:40,height:25};
assert(cloudDisturbances(smallCloud,[motion],.1)[6].radius>1.2,'A large owl must disturb the full extent of a small cloud');
console.log(JSON.stringify({stateChecks:'passed',startingLives:STARTING_LIVES,flyPastSeconds:FLY_PAST_SECONDS,progressionSpawns:spawnTimes.length,initialGap:spawnTimes[1]-spawnTimes[0],finalGap:spawnTimes.at(-1)-spawnTimes.at(-2),pointsPerHit:10},null,2));

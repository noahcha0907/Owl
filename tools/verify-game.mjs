import assert from 'node:assert/strict';
import {GameState,projectOwl,STARTING_LIVES,FLY_PAST_SECONDS} from '../game/game-state.mjs';

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
 assert(layout.x>=0&&layout.x<=1440&&layout.y>=0&&layout.y<=1000);
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
 assert(gone.opacity<1e-12);assert(Math.abs(gone.x-720)<1e-9);assert(Math.abs(gone.y-500)<1e-9);
 // No sideways exit: movement remains on the spawn-to-camera line, and its
 // velocity and growth stay continuous across the old turn boundary.
 let previous=projectOwl(target,target.born,1440,1000);
 for(let i=1;i<=240;i++){
  const p=projectOwl(target,target.born+(target.lifetime+FLY_PAST_SECONDS)*i/240,1440,1000);
  assert(Math.abs(p.x-720)<=Math.abs(previous.x-720)+1e-8);
  assert(Math.abs(p.y-500)<=Math.abs(previous.y-500)+1e-8);
  assert(p.width>=previous.width);assert(Number.isFinite(p.width));
  const cross=(p.x/1440-.5)*(target.y-.5)-(p.y/1000-.5)*(target.x-.5);assert(Math.abs(cross)<1e-10);
  previous=p;
 }
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
console.log(JSON.stringify({stateChecks:'passed',startingLives:STARTING_LIVES,flyPastSeconds:FLY_PAST_SECONDS,progressionSpawns:spawnTimes.length,initialGap:spawnTimes[1]-spawnTimes[0],finalGap:spawnTimes.at(-1)-spawnTimes.at(-2),pointsPerHit:10},null,2));

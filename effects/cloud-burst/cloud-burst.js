import * as THREE from '../../vendor/three/three.module.js';
import {CloudField} from '../cloud-wake/cloud-field.mjs';
import {cloudDisturbances} from './cloud-interaction.mjs';

export const CLOUD_RELEASE_LIFETIME=2.2;
const noSource=()=>{};
// A shot releases the entire owl into the exact fluid field used by its wings.
// Only density and velocity are transferred; no image ghosts or point sprites.
export class CloudBursts {
 constructor(renderer){this.renderer=renderer;this.items=[];this.emitters=Array.from({length:6},()=>new THREE.Vector4());}
 add(effect,layout,time){
  const field=new CloudField(this.renderer,effect.resources.color,{width:512,height:320});
  field.releaseFrom(effect.cloud,()=>effect.renderDirect());
  const layer=field.createLayerMaterial();
  this.items.push({field,layer,born:time,age:0,clock:effect.time,layout:{...layout}});
 }
 update(time,motions=[]){
  for(let i=this.items.length-1;i>=0;i--){
   const item=this.items[i],age=Math.max(0,time-item.born);
   if(age>=CLOUD_RELEASE_LIFETIME){this.disposeItem(item);this.items.splice(i,1);continue;}
   while(item.age<age-.00001){
    const dt=Math.min(1/30,age-item.age);item.age+=dt;
    const disturbances=cloudDisturbances(item.layout,motions,item.born+item.age);
    item.disturbanceCount=disturbances.length;
    item.field.step(dt,item.clock+item.age,this.emitters,noSource,disturbances);
   }
  }
 }
 render(viewportHeight){
  for(const item of this.items){
   const {x,y,width,height}=item.layout;
   this.renderer.setViewport(x-width/2,viewportHeight-y-height/2,width,height);
   const fade=1-THREE.MathUtils.smoothstep(item.age,.5,CLOUD_RELEASE_LIFETIME);
   item.field.drawLayer(item.layer,fade);
  }
 }
 disposeItem(item){item.layer.dispose();item.field.dispose();}
 clear(){for(const item of this.items)this.disposeItem(item);this.items=[];}
 resize(sx,sy){
  for(const item of this.items){const l=item.layout;l.x*=sx;l.y*=sy;l.width*=Math.min(sx,sy);l.height*=Math.min(sx,sy);}
 }
}

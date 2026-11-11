import * as THREE from '../../vendor/three/three.module.js';
// One image-derived closed shell, not an owl assembled from primitive parts.
// Upper and lower surfaces join around the sampled alpha contour.
export function buildWingVolume(image,columns=256,rows=96){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 const {data}=context.getImageData(0,0,canvas.width,canvas.height);
 const covered=(u,v)=>{const x=Math.min(canvas.width-1,Math.max(0,Math.floor(u*canvas.width))),y=Math.min(canvas.height-1,Math.max(0,Math.floor((1-v)*canvas.height)));return data[(y*canvas.width+x)*4+3]>140;};
 const cells=new Uint8Array(columns*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)cells[y*columns+x]=covered((x+.5)/columns,(y+.5)/rows)?1:0;
 // Approximate distance to the alpha contour, measured in object space.
 // Taper the two skins into a rounded feather edge instead of extruded walls.
 const stride=columns+1, distances=new Float32Array(stride*(rows+1));
 const dx=1/columns,dy=(image.naturalHeight/image.naturalWidth)/rows,diagonal=Math.hypot(dx,dy);
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)distances[y*stride+x]=covered(x/columns,y/rows)?1:0;
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
  const i=y*stride+x;let d=distances[i];
  if(x>0)d=Math.min(d,distances[i-1]+dx);
  if(y>0){d=Math.min(d,distances[i-stride]+dy);if(x>0)d=Math.min(d,distances[i-stride-1]+diagonal);if(x<columns)d=Math.min(d,distances[i-stride+1]+diagonal);}
  distances[i]=d;
 }
 for(let y=rows;y>=0;y--)for(let x=columns;x>=0;x--){
  const i=y*stride+x;let d=distances[i];
  if(x<columns)d=Math.min(d,distances[i+1]+dx);
  if(y<rows){d=Math.min(d,distances[i+stride]+dy);if(x>0)d=Math.min(d,distances[i+stride-1]+diagonal);if(x<columns)d=Math.min(d,distances[i+stride+1]+diagonal);}
  distances[i]=d;
 }
 const positions=[],uvs=[],shell=[],edge=[],roundness=[],indices=[];
 function vertex(u,v,side,isEdge){const n=shell.length;positions.push(u-.5,v-.5,0);uvs.push(u,v);shell.push(side);edge.push(isEdge);roundness.push(Math.min(1,distances[Math.round(v*rows)*stride+Math.round(u*columns)]/.035));return n;}
 const planeSize=(columns+1)*(rows+1);
 for(const side of [1,-1])for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)vertex(x/columns,y/rows,side,0);
 const active=(x,y)=>x>=0&&y>=0&&x<columns&&y<rows&&cells[y*columns+x];
 function wall(a,b){
  const au=uvs[a*2],av=uvs[a*2+1],bu=uvs[b*2],bv=uvs[b*2+1];
  const ta=vertex(au,av,1,1),tb=vertex(bu,bv,1,1),ba=vertex(au,av,-1,1),bb=vertex(bu,bv,-1,1);
  indices.push(ta,ba,bb,ta,bb,tb);
 }
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(active(x,y)){
  const a=y*(columns+1)+x,b=a+1,d=a+columns+1,c=d+1;
  indices.push(a,b,c,a,c,d);
  indices.push(a+planeSize,c+planeSize,b+planeSize,a+planeSize,d+planeSize,c+planeSize);
  if(!active(x,y-1))wall(a,b);
  if(!active(x+1,y))wall(b,c);
  if(!active(x,y+1))wall(c,d);
  if(!active(x-1,y))wall(d,a);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('a_shell',new THREE.Float32BufferAttribute(shell,1));geometry.setAttribute('a_edge',new THREE.Float32BufferAttribute(edge,1));geometry.setAttribute('a_roundness',new THREE.Float32BufferAttribute(roundness,1));geometry.setIndex(indices);geometry.computeBoundingSphere();
 return geometry;
}

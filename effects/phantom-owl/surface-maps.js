import * as THREE from '../../vendor/three/three.module.js';

// Image-registered relief, NOT recovered anatomy. All maps share the exact
// source pixels and orientation; no independent AI-generated normal image.
export function buildSurfaceMaps(image) {
  const width=image.naturalWidth, height=image.naturalHeight;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,width,height).data;
  const luminance=new Float32Array(width*height), relief=new Float32Array(width*height);
  const valid=(x,y)=>pixels[(y*width+x)*4+3]>180;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=y*width+x, j=k*4;
    luminance[k]=(pixels[j]*0.2126+pixels[j+1]*0.7152+pixels[j+2]*0.0722)/255;
    if(!valid(x,y))continue;
    const u=(x+0.5)/width, v=1-(y+0.5)/height;
    // Hand-tuned broad volume for this front-facing image only; dimensions
    // are artistic choices. Feather/face relief comes from image contrast.
    const head=Math.exp(-(((u-.5)/.075)**2)-((v-.69)/.23)**2);
    const breast=Math.exp(-(((u-.5)/.068)**2)-((v-.43)/.27)**2);
    const wings=Math.exp(-(((v-.56)/.20)**2))*Math.exp(-(((u-.5)/.55)**2));
    relief[k]=0.52*head+0.35*breast+0.10*wings+0.045*luminance[k];
  }
  const data=new Uint8Array(width*height*4), heightData=new Uint8Array(width*height*4);
  // +X right, +Y up, +Z toward viewer. Alpha retains the source coverage.
  const step=2;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=y*width+x,j=k*4;
    const sample=(sx,sy)=>valid(sx,sy)?relief[sy*width+sx]:relief[k];
    const left=Math.max(0,x-step),right=Math.min(width-1,x+step);
    const top=Math.max(0,y-step),bottom=Math.min(height-1,y+step);
    let nx=-(sample(right,y)-sample(left,y))*width/(right-left)*0.09;
    let ny=-(sample(x,top)-sample(x,bottom))*height/(bottom-top)*0.09;
    const inv=1/Math.hypot(nx,ny,1);
    data[j]=Math.round((nx*inv*.5+.5)*255);data[j+1]=Math.round((ny*inv*.5+.5)*255);data[j+2]=Math.round((inv*.5+.5)*255);data[j+3]=pixels[j+3];
    const h=Math.round(Math.min(1,relief[k])*255);
    heightData[j]=h;heightData[j+1]=Math.round(luminance[k]*255);heightData[j+2]=0;heightData[j+3]=pixels[j+3];
  }
  function texture(bytes){const t=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);t.flipY=true;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
  return {normal:texture(data),relief:texture(heightData),width,height,
    provenance:'Image-registered approximate relief; broad volume is hand-tuned and fine relief is derived from luminance, not measured depth.'};
}

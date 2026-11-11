import * as THREE from '../../vendor/three/three.module.js';
// A persistent advected velocity/color field. No stored wing images or ghost meshes.
export class CloudField {
 constructor(renderer,colorShader,{width=innerWidth,height=innerHeight}={}){
  this.renderer=renderer;
  this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.scene=new THREE.Scene();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);this.scene.add(this.quad);
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const header=`precision highp float;varying vec2 vUv;uniform sampler2D u_velocity;uniform sampler2D u_dye;uniform sampler2D u_source;uniform vec2 u_texel;uniform float u_dt;uniform float u_time;uniform float u_aspect;uniform vec4 u_emitters[6];
  uniform float u_zero;
  vec2 decode(vec2 v){return (v-u_zero)*.9;}
  vec2 encode(vec2 v){return v/.9+u_zero;}
  vec2 metric(vec2 d){return d*vec2(u_aspect,1.0);}
  float airHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float airNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(airHash(i),airHash(i+vec2(1,0)),f.x),mix(airHash(i+vec2(0,1)),airHash(i+vec2(1,1)),f.x),f.y);}
  `;
  const material=body=>new THREE.ShaderMaterial({vertexShader,fragmentShader:header+body,depthTest:false,depthWrite:false,uniforms:{u_zero:{value:.5},u_velocity:{value:null},u_dye:{value:null},u_source:{value:null},u_texel:{value:new THREE.Vector2()},u_dt:{value:0},u_time:{value:0},u_aspect:{value:1},u_emitters:{value:Array.from({length:6},()=>new THREE.Vector4())}}});
  // Write numerical RGBA directly; a translucent clear color is premultiplied
  // by the renderer and would corrupt both zero velocity and displacement.
  this.resetMaterial=material('void main(){gl_FragColor=vec4(u_zero);}');
  this.velocityMaterial=material(`void main(){
    vec2 vel=decode(texture2D(u_velocity,vUv).rg);
    vec2 back=clamp(vUv-vel*u_dt,0.001,0.999);
    vec4 carried=texture2D(u_velocity,back);
    vel=decode(carried.rg)*exp(-u_dt*1.05);
    for(int i=0;i<6;i++){
      vec2 delta=metric(vUv-u_emitters[i].xy);
      float speed=length(metric(u_emitters[i].zw));
      float falloff=exp(-dot(delta,delta)/.0045)*smoothstep(.01,.12,speed);
      vec2 force=clamp(u_emitters[i].zw*.80,vec2(-.32),vec2(.32));
      vel+= (force-vel)*falloff*(1.0-exp(-u_dt*5.5));
      // Tip-shed swirl carries and curls the disturbance rather than stamping shapes.
      vec2 tangent=vec2(-delta.y,delta.x)/max(length(delta),.015);
      float handed=i<3?1.0:-1.0;
      vel+=tangent/vec2(u_aspect,1.0)*handed*speed*falloff*u_dt*.95;
    }
    float energy=length(metric(vel));
    vec2 q=metric(vUv)*39.0+vec2(u_time*.38,-u_time*.31);
    vec2 curl=vec2(sin(q.x)*cos(q.y),-cos(q.x)*sin(q.y));
    vec2 fine=q*1.91+vec2(-u_time*.21,u_time*.27);
    curl+=vec2(sin(fine.x)*cos(fine.y),-cos(fine.x)*sin(fine.y))*.55;
    float mass=length(texture2D(u_dye,vUv).rgb);
    float occupied=smoothstep(.002,.08,mass);
    vel+=curl/vec2(u_aspect,1.0)*(energy*.85+.022*occupied)*u_dt;
    // Light ambient lift keeps shed wisps drifting after a wing reverses.
    vel+=vec2(.005*sin(u_time*.27)/u_aspect,.016)*occupied*u_dt;
    vel=clamp(vel,vec2(-.44),vec2(.44));
    // BA carries accumulated displacement, not instantaneous velocity.
    // Pigment travels with the air and never springs back to its old position.
    vec2 displacement=decode(carried.ba)+vel*u_dt;
    gl_FragColor=vec4(encode(vel),encode(clamp(displacement,vec2(-.44),vec2(.44))));
  }`);
  this.dyeMaterial=material(`void main(){
    vec2 vel=decode(texture2D(u_velocity,vUv).rg);
    vec2 back=clamp(vUv-vel*u_dt,0.001,0.999);
    vec3 dye=texture2D(u_dye,back).rgb;
    vec3 neighbors=(texture2D(u_dye,back+vec2(u_texel.x,0)).rgb+texture2D(u_dye,back-vec2(u_texel.x,0)).rgb+texture2D(u_dye,back+vec2(0,u_texel.y)).rgb+texture2D(u_dye,back-vec2(0,u_texel.y)).rgb)*.25;
    float breakup=airNoise(metric(back)*43.0+vec2(u_time*.24,-u_time*.35));
    dye=mix(dye,neighbors,1.0-exp(-u_dt*8.0))*exp(-u_dt*(.85+breakup*.6));
    float injection=0.0;
    for(int i=0;i<6;i++){
      vec2 d=metric(vUv-u_emitters[i].xy);
      float speed=length(metric(u_emitters[i].zw));
      injection+=exp(-dot(d,d)/.0120)*smoothstep(.012,.18,speed);
    }
    // Diffuse samples of the LIVE shader provide its existing color spectrum.
    // Only color mass enters the field; the owl silhouette is not retained.
    vec3 source=vec3(0.0);
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)
      source+=1.0-texture2D(u_source,vUv+vec2(float(x),float(y))*u_texel*3.5).rgb;
    source/=9.0;
    float wisps=.45+.75*airNoise(metric(vUv)*57.0+vec2(u_time*.3,-u_time*.2));
    dye+=source*min(injection,1.5)*wisps*(1.0-exp(-u_dt*5.0));
    gl_FragColor=vec4(clamp(dye,0.0,.7),1.0);
  }`);
  this.displayMaterial=material(`
  uniform vec2 u_resolution;
  uniform vec4 u_owlFrame;
  uniform float u_transparent;
  uniform float u_opacity;
  ${colorShader}
  void main(){
    vec3 dye=texture2D(u_dye,vUv).rgb;
    vec2 displacement=decode(texture2D(u_velocity,vUv).ba);
    // Transported pigment controls density. Restore its fine color structure
    // with the SAME shader as the wings: diffusion must not mix it into brown.
    float mass=max(dye.r,max(dye.g,dye.b));
    float density=smoothstep(.004,.095,mass);
    vec2 transported=vUv-displacement;
    vec2 air=metric(transported)*37.0+vec2(u_time*.12,-u_time*.18);
    float pockets=airNoise(air)*.65+airNoise(air*2.07+5.3)*.35;
    float porous=smoothstep(.22,.70,pockets);
    density*=mix(porous,1.0,smoothstep(.14,.30,mass));
    vec2 fieldUv=(transported-u_owlFrame.xy)/u_owlFrame.zw+.5;
    float clock=u_time*.075;
    vec2 p=fieldUv*vec2(2.0,1.3);
    vec2 flow=vec2(fbm(p+vec2(clock,-clock*.33)),fbm(p+vec2(-clock*.4,clock*.6)+9.2));
    float liquid=fbm(p*1.4+flow*2.3+vec2(-clock*.65,clock*.2));
    vec2 curved=fieldUv+(flow-.5)*.34;
    curved.y=mix(curved.y,.5+(liquid-.5)*.42,.78);
    curved.y+=sin(clock*.7)*.05;
    vec3 absorption=(1.0-strandColor(curved,clock))*4.455;
    // Same optical-density ceiling and full core opacity as the wing bands.
    vec3 ink=clamp(absorption,0.0,.7)*density;
    if(u_transparent>.5){
      float alpha=max(ink.r,max(ink.g,ink.b));
      if(alpha<.001)discard;
      gl_FragColor=vec4(1.0-ink/max(alpha,.00001),alpha*u_opacity);
    }else gl_FragColor=vec4(1.0-ink,1.0);
  }`);
  this.displayMaterial.uniforms.u_resolution={value:new THREE.Vector2(16,9)};
  this.displayMaterial.uniforms.u_owlFrame={value:new THREE.Vector4(.5,.5,.7,.3)};
  this.displayMaterial.uniforms.u_transparent={value:0};
  this.displayMaterial.uniforms.u_opacity={value:1};
  this.releaseVelocityMaterial=material(`
   uniform vec4 u_owlFrame;
   void main(){
    vec4 carried=texture2D(u_velocity,vUv);
    vec2 d=metric(vUv-u_owlFrame.xy);
    vec2 radial=d/max(length(d),.06);
    vec2 tangent=vec2(-radial.y,radial.x);
    float region=exp(-dot(d,d)/.30);
    vec2 impulse=(radial*.11+tangent*.045*sin(d.x*12.0))/vec2(u_aspect,1.0)*region;
    gl_FragColor=vec4(encode(clamp(decode(carried.rg)+impulse,vec2(-.44),vec2(.44))),carried.ba);
   }`);
  this.releaseVelocityMaterial.uniforms.u_owlFrame={value:new THREE.Vector4()};
  this.releaseDyeMaterial=material(`void main(){
   // Transfer a broad body of pigment, not separate point samples or particles.
   vec3 pigment=vec3(0.0);
   for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++)
    pigment+=1.0-texture2D(u_source,vUv+vec2(float(x),float(y))*u_texel*2.5).rgb;
   pigment/=25.0;
   vec3 carried=texture2D(u_dye,vUv).rgb;
   gl_FragColor=vec4(clamp(max(carried,pigment*3.0),0.0,.7),1.0);
  }`);
  this.resize(width,height);
 }
 setOwlFrame(x,y,width,height){
  // Establish a color scale once. Detached air is not pulled with the owl.
  if(!this.frameReady){this.displayMaterial.uniforms.u_owlFrame.value.set(x,y,width,height);this.frameReady=true;}
 }
 resize(width,height){
  this.aspect=width/height;this.width=512;this.height=Math.max(192,Math.min(768,Math.round(512/this.aspect)));
  const type=this.renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  for(const material of [this.resetMaterial,this.velocityMaterial,this.dyeMaterial,this.displayMaterial,this.releaseVelocityMaterial,this.releaseDyeMaterial])material.uniforms.u_zero.value=type===THREE.HalfFloatType?.5:128/255;
  const make=(depthBuffer=false)=>new THREE.WebGLRenderTarget(this.width,this.height,{type,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer,stencilBuffer:false});
  for(const t of [...(this.velocity||[]),...(this.dye||[]),this.source])t?.dispose();
  this.velocity=[make(),make()];this.dye=[make(),make()];this.source=make(true);this.reset();
 }
 pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);}
 reset(){
  this.frameReady=false;
  const r=this.renderer;
  for(const target of this.velocity)this.pass(this.resetMaterial,target);
  r.setClearColor(0,1);for(const target of this.dye){r.setRenderTarget(target);r.clear();}
  r.setRenderTarget(null);r.setClearColor(0xffffff,1);
 }
 step(dt,time,emitters,renderOwl){
  this.displayMaterial.uniforms.u_time.value=time;
  this.displayMaterial.uniforms.u_aspect.value=this.aspect;
  const r=this.renderer;r.setRenderTarget(this.source);r.setClearColor(0xffffff,1);r.clear();renderOwl();
  const update=material=>{
   const u=material.uniforms;u.u_velocity.value=this.velocity[0].texture;u.u_dye.value=this.dye[0].texture;u.u_source.value=this.source.texture;
   u.u_texel.value.set(1/this.width,1/this.height);u.u_dt.value=dt;u.u_time.value=time;u.u_aspect.value=this.aspect;
   emitters.forEach((v,i)=>u.u_emitters.value[i].copy(v));
  };
  update(this.velocityMaterial);this.pass(this.velocityMaterial,this.velocity[1]);this.velocity.reverse();
  update(this.dyeMaterial);this.pass(this.dyeMaterial,this.dye[1]);this.dye.reverse();
  r.setRenderTarget(null);
 }
 render(renderOwl,target=null){
  const r=this.renderer;r.setRenderTarget(target);r.setClearColor(0xffffff,1);r.clear();
  this.displayMaterial.uniforms.u_dye.value=this.dye[0].texture;this.displayMaterial.uniforms.u_velocity.value=this.velocity[0].texture;this.pass(this.displayMaterial,target);
  renderOwl();
 }
 createLayerMaterial(){
  const layer=this.displayMaterial.clone();layer.transparent=true;
  layer.uniforms.u_transparent.value=1;return layer;
 }
 drawLayer(layer,opacity=1){
  const u=layer.uniforms,source=this.displayMaterial.uniforms;
  u.u_dye.value=this.dye[0].texture;u.u_velocity.value=this.velocity[0].texture;
  u.u_time.value=source.u_time.value;u.u_aspect.value=this.aspect;
  u.u_owlFrame.value.copy(source.u_owlFrame.value);u.u_opacity.value=opacity;
  this.quad.material=layer;this.renderer.render(this.scene,this.camera);
 }
 releaseFrom(cloud,renderSource){
  const r=this.renderer,previous=r.getRenderTarget();
  const color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
  r.setRenderTarget(this.source);r.setClearColor(0xffffff,1);r.clear();renderSource();
  const source=cloud.displayMaterial.uniforms;
  this.setOwlFrame(...source.u_owlFrame.value.toArray());
  this.displayMaterial.uniforms.u_time.value=source.u_time.value;
  for(const material of [this.releaseVelocityMaterial,this.releaseDyeMaterial]){
   const u=material.uniforms;
   u.u_aspect.value=this.aspect;u.u_texel.value.set(1/this.width,1/this.height);
   u.u_velocity.value=cloud.velocity[0].texture;u.u_dye.value=cloud.dye[0].texture;u.u_source.value=this.source.texture;
  }
  this.releaseVelocityMaterial.uniforms.u_owlFrame.value.copy(source.u_owlFrame.value);
  this.pass(this.releaseVelocityMaterial,this.velocity[0]);this.pass(this.releaseDyeMaterial,this.dye[0]);
  r.setRenderTarget(previous);r.setClearColor(color,alpha);
 }
 dispose(){
  for(const target of [...this.velocity,...this.dye,this.source])target.dispose();
  for(const material of [this.resetMaterial,this.velocityMaterial,this.dyeMaterial,this.displayMaterial,this.releaseVelocityMaterial,this.releaseDyeMaterial])material.dispose();
  this.quad.geometry.dispose();
 }
}

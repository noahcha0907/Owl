precision highp float;
uniform float u_time;
uniform sampler2D u_owl;
uniform sampler2D u_normal;
uniform sampler2D u_relief;
uniform float u_flap;
uniform vec2 u_resolution;
varying vec2 vUv;

// Original shader noise and RGB calculations. shaderRef.glsl stays untouched.
float random(vec2 st) { return fract(sin(dot(st,st))*43758.5453123); }
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+3.1)*.28+noise(p*4.01+7.7)*.15;}
vec3 originalColor(vec2 point,float time){
 vec2 st=point;float rnd=random(st);vec3 c=vec3(0);float l=0.0;float z=time;
 for(int i=0;i<3;i++){
   // Keep the original ACCUMULATING coordinates. Resetting here caused
   // the unwanted saturated rainbow in the previous version.
   st-=vec2(.5);
   st.x*=.3*(u_resolution.x/u_resolution.y)/(16.0/9.0);
   z-=1.0;l=length(st);
   float radialWave=sin(l*50.0-2.0*z);
   float scale=rnd/2.2;
   float denom=scale*radialWave;
   // Mathematically the original inverse, defined for negative inputs too.
   st*= (denom<0.0?-1.0:1.0)/max(abs(denom),.00001);
   float band=fract(.01/max(length(st-.5),.00001));
   float fade=5.0/(1.0+l*3.0);
   c[i]=band*fade;
 }
 return clamp(c*9.0+l,0.0,1.0);
}
void main(){
 vec2 uv=vUv;
 float wing=smoothstep(.10,.38,abs(uv.x-.5));
 uv.y=.52+(uv.y-.52)/(1.0-u_flap*wing*.12);
 if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))discard;
 vec4 owl=texture2D(u_owl,uv);
 float coverage=smoothstep(.55,.96,owl.a);
 if(coverage<.005)discard;
 vec3 normal=normalize(texture2D(u_normal,uv).xyz*2.0-1.0);
 vec2 surface=texture2D(u_relief,uv).rg;
 float clock=u_time*.075;
 // Smooth moving domains produce billowing regions instead of expanding rings.
 vec2 p=uv*vec2(3.3,2.1);
 vec2 flow=vec2(fbm(p+vec2(clock,-clock*.33)),fbm(p+vec2(-clock*.4,clock*.6)+9.2));
 float liquid=fbm(p*1.4+flow*2.3+vec2(-clock*.65,clock*.2));
 vec2 curved=uv+(flow-.5)*.34+normal.xy*.028+vec2(0.0,surface.x*.09);
 // Contours follow a liquid density field, making closed flowing pools
 // rather than simply sweeping horizontal ripple bands across the bird.
 curved.y=mix(curved.y,.5+(liquid-.5)*1.8+normal.y*.03,.78);
 curved.y+=sin(clock*.7)*.05;
 vec3 pigment=originalColor(curved,clock);
 // Broad pools are translucent; features appear only as the pools pass them.
 float pool=smoothstep(.30,.67,liquid);
 float feather=1.0-surface.y;
 float reliefEdge=length(normal.xy);
 float reveal=pool*(.28+.58*feather+.24*reliefEdge);
 // A second advected sample catches fine face/feather detail in the same
 // original spectrum, without adding a new palette or painting on a photograph.
 vec3 detailPigment=originalColor(vec2(curved.x, .50+(flow.y-.5)*.17),clock);
 vec3 absorption=(1.0-pigment)*(.65+.35*reveal);
 absorption+=(1.0-detailPigment)*feather*pool*.22;
 // Neutral optical density reveals eye sockets and feather separations.
 // It does not recolor the spectrum or display the photo as an opaque skin.
 absorption+=vec3(feather*pool*.15);
 // White-dominant transmission matches the screenshots. No HSV boosts,
 // artificial lighting, replacement rainbow, or photographic RGB overlay.
 vec3 color=1.0-clamp(absorption,0.0,.7);
 float alpha=coverage*smoothstep(.23,.54,liquid);
 gl_FragColor=vec4(color,alpha);
}

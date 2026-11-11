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
// Keep a complete RGB sample when strand fields overlap.
vec3 strandColor(vec2 curved,float clock){
 vec3 pigment=originalColor(curved,clock);
 vec3 strandA=originalColor(curved+vec2(.08,.13+sin(clock*.43)*.025),clock+.65);
 vec3 strandB=originalColor(curved+vec2(-.07,-.13+cos(clock*.37)*.025),clock+1.3);
 vec3 densityWeights=vec3(.2126,.7152,.0722);
 if(dot(1.0-strandA,densityWeights)>dot(1.0-pigment,densityWeights))pigment=strandA;
 if(dot(1.0-strandB,densityWeights)>dot(1.0-pigment,densityWeights))pigment=strandB;
 return pigment;
}

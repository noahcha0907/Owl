precision highp float;
uniform float u_time;
uniform float u_visibility;
uniform vec2 u_wake;
uniform sampler2D u_owl;
uniform sampler2D u_normal;
uniform sampler2D u_relief;
uniform vec2 u_resolution;
varying vec2 vUv;
varying float v_edge;

#include <phantom_color>
void main(){
 vec2 uv=vUv;
 if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))discard;
 vec4 owl=texture2D(u_owl,uv);
 float coverage=smoothstep(.55,.96,owl.a);
 if(coverage<.005)discard;
 vec3 normal=normalize(texture2D(u_normal,uv).xyz*2.0-1.0);
 vec2 surface=texture2D(u_relief,uv).rg;
 float clock=u_time*.075;
 // Smooth moving domains produce billowing regions instead of expanding rings.
 // Wake follows the shoulder-to-tip stroke path, not the face or body.
 float wingWeight=smoothstep(.075,.32,abs(uv.x-.5));
 float side=uv.x<.5?-1.0:1.0;
 vec2 shoulder=vec2(.5+side*.09,.60);
 vec2 radial=uv-shoulder;
 vec2 wakeShift=vec2(side*u_wake.y*.32,u_wake.x*.65)*wingWeight;
 wakeShift+=vec2(-radial.y,radial.x)*u_wake.y*wingWeight*.65;
 vec2 fieldUv=uv+wakeShift;
 vec2 p=fieldUv*vec2(2.0,1.3);
 vec2 flow=vec2(fbm(p+vec2(clock,-clock*.33)),fbm(p+vec2(-clock*.4,clock*.6)+9.2));
 float liquid=fbm(p*1.4+flow*2.3+vec2(-clock*.65,clock*.2));
 vec2 curved=fieldUv+(flow-.5)*.34+normal.xy*.028+vec2(0.0,surface.x*.09);
 // Contours follow a liquid density field, making closed flowing pools
 // rather than simply sweeping horizontal ripple bands across the bird.
 // Gather the original strands into broader pools across more of the surface.
 curved.y=mix(curved.y,.5+(liquid-.5)*.34+normal.y*.03,.84);
 curved.y+=sin(clock*.7)*.05;
 // Three offset strand fields increase coverage without narrowing the strands.
 vec3 pigment=strandColor(curved,clock);
 // Broad pools are translucent; features appear only as the pools pass them.
 float pool=smoothstep(.24,.61,liquid);
 float feather=1.0-surface.y;
 float reliefEdge=length(normal.xy);
 float reveal=pool*(.28+.58*feather+.24*reliefEdge);
 // A second advected sample catches fine face/feather detail in the same
 // original spectrum, without adding a new palette or painting on a photograph.
 vec3 detailPigment=originalColor(vec2(curved.x, .50+(flow.y-.5)*.17),clock);
 // Stronger chromatic density; keep neutral feather detail unchanged.
 vec3 absorption=(1.0-pigment)*(.65+.35*reveal)*4.455;
 absorption+=(1.0-detailPigment)*feather*pool*.9801;
 // Neutral optical density reveals eye sockets and feather separations.
 // It does not recolor the spectrum or display the photo as an opaque skin.
 absorption+=vec3(feather*pool*.15);
 // White-dominant transmission matches the screenshots. No HSV boosts,
 // artificial lighting, replacement rainbow, or photographic RGB overlay.
 // Keep the same palette across the feather rim, with a subtle volume cue.
 vec3 color=1.0-clamp(absorption*(1.0+v_edge*.12),0.0,.7);
 // Let quieter parts of the field remain visible instead of fading to white.
 float alpha=coverage*smoothstep(.12,.44,liquid);
 // Soft, image-registered anchors keep the face and tail legible even when
 // the larger liquid pools leave them. These coordinates follow the owl UVs.
 vec2 face=(uv-vec2(.500,.705))/vec2(.077,.235);
 vec2 tail=(uv-vec2(.500,.190))/vec2(.112,.170);
 float faceField=1.0-smoothstep(.70,1.12,length(face));
 float tailField=1.0-smoothstep(.65,1.12,length(tail));
 float featureField=max(faceField,tailField);
 if(featureField>.001){
  // A broad moving band with a nonzero floor, in the original spectrum.
  float band=.72+.28*sin(uv.y*19.0+flow.x*3.0-clock*.8);
  vec2 featureUv=vec2(curved.x,.50+(flow.y-.5)*.10+normal.y*.018);
  vec3 featurePigment=strandColor(featureUv,clock);
  vec3 featureInk=clamp((1.0-featurePigment)*.38,0.0,.12);
  // A little map-derived contrast keeps eyes and feather divisions readable.
  featureInk+=vec3(feather*.04+reliefEdge*.012);
  featureInk*=featureField*band*coverage;
  vec3 liveInk=(1.0-color)*alpha;
  // Only fill quiet patches; retain the complete RGB sample of stronger bands.
  if(dot(featureInk,vec3(.2126,.7152,.0722))>dot(liveInk,vec3(.2126,.7152,.0722))){
   alpha=max(alpha,coverage*featureField*.30);
   color=1.0-featureInk/max(alpha,.00001);
  }
 }
 if(alpha<.005)discard;
 gl_FragColor=vec4(color,alpha*u_visibility);
}

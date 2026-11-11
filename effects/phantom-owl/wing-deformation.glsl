
uniform float u_flap;
uniform float u_wrist;
uniform float u_depth;
uniform float u_depthTip;
uniform vec4 u_leftWing;
uniform vec4 u_rightWing;
uniform vec2 u_fold;
uniform float u_imageAspect;
uniform sampler2D u_relief;
attribute float a_shell;
attribute float a_edge;
attribute float a_roundness;
varying float v_edge;
varying vec2 vUv;
void main(){
 v_edge=a_edge;
 vUv=uv;
 vec3 p=position;
 float span=abs(position.x);
 float wing=smoothstep(.065,.17,span);
 float reach=max(span-.085,0.0);
 float outer=smoothstep(.20,.48,span);
 vec4 stroke=position.x<0.0?u_leftWing:u_rightWing;
 float fold=position.x<0.0?u_fold.x:u_fold.y;
 float angle=mix(stroke.x,stroke.y,outer*.55);
 float depthAngle=mix(stroke.z,stroke.w,outer*.65);
 // Bend the image-derived wing shell at its shoulders. UV-attached colors and
 // surface maps travel with the feathers; the body/face remain anchored.
 p.x=mix(position.x,sign(position.x)*(.085+reach*cos(angle*.60)*cos(depthAngle)),wing);
 p.y+=reach*sin(angle)*u_imageAspect*wing*.68;
 p.z+=reach*sin(depthAngle)*wing;
 // A cambered, cupped surface: the wing has a rounded chord and flexible
 // trailing edge, rather than rotating as a rigid paper card.
 float chord=(uv.y-.56)/.39;
 float cup=max(0.0,1.0-chord*chord);
 float power=max(-stroke.x,0.0);
 float camber=cup*(.045+.075*power)*wing;
 float twist=(uv.y-.56)*outer*sin(angle)*.19*wing;
 float featherRelief=texture2D(u_relief,uv).r*.045*wing;
 p.z+=camber+twist+featherRelief;
 p.y+=cup*sin(angle)*outer*.075*u_imageAspect*wing;
 p.x-=sign(position.x)*cup*outer*power*.018*wing;
 p.x-=sign(position.x)*reach*fold*outer*.13*wing;
 p.z+=cup*fold*outer*.03*wing;
 // Finite depth between upper/lower skins, tapered toward outer feathers.
 // Offset follows the folded wing's normal so thickness reads edge-on too.
 float thickness=(.025+.055*(1.0-outer)+.018*power)*wing;
 float profile=(.35+.65*sqrt(max(0.0,cup)))*sqrt(a_roundness);
 vec3 shellNormal=normalize(vec3(-sign(position.x)*sin(depthAngle),-sin(angle)*.35,cos(depthAngle)));
 vec3 shellOffset=shellNormal*a_shell*thickness*profile;
 p+=vec3(shellOffset.x,shellOffset.y*u_imageAspect,shellOffset.z);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
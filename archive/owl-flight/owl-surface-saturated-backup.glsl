#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
// Independent working copy. Original shaderRef.glsl is preserved byte-for-byte.
uniform sampler2D u_owl;
uniform float u_flap;
varying vec2 vUv;
uniform float u_time;

uniform vec2 u_click;
uniform float u_clickTime;

#define t (u_time * 0.12)
#define r u_resolution

float random(vec2 st) {
    return fract(sin(dot(st, st))* 43758.5453123);
}


//Goals: Raindrop effect from mouse click, 
//mesh noise add back in, 
//figure out what this pulse is
//aspect ratio of 
void main() {
    // Image UVs delimit the owl; no geometric owl mesh is rendered.
    vec2 uv = vUv;
    float wing = smoothstep(0.10, 0.44, abs(uv.x - 0.5));
    uv.y = 0.50 + (uv.y - 0.50) / (1.0 - u_flap * wing * 0.32);
    // First front-facing glide pose, bounds in the unmodified generated sheet.
    vec2 atlasUV = vec2(uv.x * 0.267, 1.0 - (0.09 + (1.0 - uv.y) * 0.19));
    float alpha = texture2D(u_owl, atlasUV).a;
    alpha = smoothstep(0.65, 0.95, alpha);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || alpha < 0.01) discard;
    vec2 st = uv;
    // Generate one constant pseudo-random value.
    // Because the seed is always 10.1, rnd is the same for every pixel.
    float rnd = random(st);
    // Stores the final red, green, and blue channel values.
    vec3 c;
    // Will store the pixel's distance from the current origin.
    float l;
    // Start z at the current elapsed time.
    float z = t;
    // Run once for each RGB channel: i=0 red, i=1 green, i=2 blue.
    for(int i = 0; i < 3; i++) {
        // Each channel starts on the same owl UV surface. Repeated inverse
        // distortion otherwise sends l to infinity and washes the owl white.
        st = uv;
        // Shift coordinates so the mouse becomes the new origin.
    	// NOTE: because st is changed each loop, this shift accumulates.
    	st -= vec2(0.5); // Fixed owl-local origin; never mouse driven.

float targetAspect = 16.0 / 9.0;
float currentAspect = r.x / r.y;
float aspectCorrection = currentAspect / targetAspect;

st.x *= 0.3 * aspectCorrection;
        // Shift the phase differently for each RGB channel.
        // First loop: t-1, second: t-2, third: t-3.
        z -= 1.0;
        // Measure this pixel's distance from the current origin.
        // This radial distance is what allows circular/ring patterns.
        l = length(st);
        // Controls how tightly packed the radial rings are.
        float ringFrequency = 50.0;
        // Global oscillation over time: ranges approximately from -1 to 1.
    //float pulse = sin(t);

        // Create an oscillating wave based on both radial distance and time.
        // l controls WHERE the rings are; z makes them move over time.
        float radialWave = sin(l * ringFrequency - 2.0 * z);
        // Make the distortion stronger near the center and weaker farther away.
        float scale = rnd / 2.2;

        // Multiply the coordinates by the inverse of the combined distortion.
        // This warps st using distance, pulse, and the moving radial wave.
        // Signed reciprocal preserves the intended inverse, avoiding undefined
        // GLSL pow behavior for negative bases and singularities at zero.
        float denom = scale * radialWave;
        st *= (denom < 0.0 ? -1.0 : 1.0) / max(abs(denom), 0.00001);
        
        float band = fract(0.01 / length(st - 0.5));
        // Measure distance from (.5,.5), invert it to create a bright center,
        // then fract() wraps large values into repeating 0–1 bands.
        // Store the result in the current RGB channel.
        float fade = 5.0 / (1.0 + l * 3.0);

		c[i] = band * fade;
    }
    // Add radial distance l to every RGB channel, increasing brightness,
    // and output the final color with full opacity.
    gl_FragColor = vec4(c*9.0 + l, alpha);
}
# Owl reference to web-game asset workflow

> This is the historical asset-generation and planning log. Code paths are relative to the project root; `generated/`, `maps/`, and reference-sheet metadata refer to `assets/owls/barn-owl/`. The current animated phantom effect, exact numbers, runnable source, and standalone reconstruction package are documented in [PHANTOM_OWL_RECREATION.md](PHANTOM_OWL_RECREATION.md). Its current implementation supersedes the early primitive/proxy recommendations below.

## Purpose and current status

Current game scope: this barn owl is the only owl. Keep the technique documented for reuse, but do not generate other species.

Build repeatable assets for a WebGL game: recognizable owl silhouettes, coherent animation, and a stylized procedural shader. Approximate geometry and texture are sufficient; photorealistic feather materials and accurate reconstruction are not requirements. UV, normal, and depth maps are optional features, not blockers for the first playable version. Keep source photographs unchanged. `references/shaders/shaderRef.glsl` is reserved for later effects integration.

Barn owl pilot, 2026-11-11: inspected `BarnOwlReference.jpg`; requested a generated 12-view turnaround through the built-in image generation tool. The photograph shows the face, breast, and part of the folded wing. Feet, tail, underside, and full back are missing. Generated unseen surfaces are artistic hypotheses, not recovered measurements. A single photograph cannot establish an anatomically accurate 3D reconstruction. No measured scale, calibrated cameras, mesh, or baked surface maps are present at this stage.

## Folder contract

Repeat this structure inside each species folder:

- Original reference photos, preserved unchanged.
- `generated/`: generated visual references and exact generation prompts.
- `views.json`: view order, camera conventions, review status, and source provenance.
- `model/`: approved common mesh, UVs, materials, and bake scene, when available.
- `baked/`: per-view color, alpha, depth, and normals rendered from that common mesh.
- This workflow and a species-specific execution/review log.

Do not put speculative generated imagery in the original-reference set.

## 1. Inspect and describe the references

Record visible features, missing surfaces, pose, lighting, and image provenance. Use multiple real photographs when available; do not mix individuals' markings without recording that decision. Do not infer sex, age, subspecies, or physical dimensions from an ambiguous photo.

Barn owl appearance anchors: white heart-shaped facial disk; dark eyes; pale pointed beak; golden buff and silver-gray upper plumage with fine dark/white markings; pale breast. The source is cropped and is not a full-body measurement reference.

## 2. Choose the representation and pose

Preferred implementation after the animation requirements: a simple articulated owl proxy with procedural shading. Use ellipsoid-like body/head shapes, a recognizable facial disk, tapered wing sections, a tail fan, and simple feet. Animate a hierarchy of parts initially; use a skinned mesh only if joint deformation needs it. Reuse this structure across species and vary proportions, face shape, ear tufts where appropriate, wing/tail silhouettes, and shader parameters.

For a sprite-based alternative viewed around the horizon, start with eight directional sprites at 45-degree azimuth intervals. These can give a 3D impression with little runtime geometry. More directions reduce view switching; they do not repair inconsistent anatomy. Use additional elevation rings only where gameplay needs them. Arbitrary close camera orbits and articulated flight favor a real mesh.

Pilot pose: standing, wings folded, head aligned with torso, no perch. This existing sheet covers the resting reference pose only. The full asset scope includes the animation states below; a folded-wing turnaround does not describe spread-wing anatomy. Approximate flight shapes are acceptable.

Use a single canonical subject and pose across every view. A camera orbit must not become an owl turning its head to look at the camera.

### Required animation states

These are the required animation states for the barn owl. Pose-reference sheets have now been generated as listed in the execution log below; timed runtime animations have not been created. Durations below are initial artistic tuning values, not biological measurements.

| Clip/state | Playback | Required movement | Initial duration |
|---|---|---|---|
| `rest` — at rest | Hold or subtle loop | Stable grounded pose, wings folded, relaxed body | 2–4 s |
| `idle` | Loop with occasional variations | Alert breathing, blinks, small head turns and weight shifts | 3–6 s |
| `walk` | Loop | Alternating foot contacts, modest body bob, folded wings | 0.8–1.2 s |
| `takeoff` | Once | Crouch, unfold wings, push off, first downstroke, tuck feet | 0.6–1.0 s |
| `fly_flap` | Loop | Upstroke/downstroke with wing folding and body response | 0.6–1.0 s |
| `fly_glide` | Loop/hold | Extended wings, subtle corrections, stable body | 1–2 s |
| `fly_bank_left`, `fly_bank_right` | Blend/loop | Banking body and wing/tail adjustment during flight | 0.6–1.2 s |
| `touchdown` | Once | Flare, extend feet, make contact, absorb impact, fold wings | 0.8–1.3 s |

Distinguish relaxed `rest` from alert `idle`. Basic transitions: `rest ↔ idle ↔ walk`; grounded states → `takeoff` → `fly_flap`; `fly_flap ↔ fly_glide`, with banking blended into flight; flight → `touchdown` → `idle` or `rest`. Touchdown must be its own action rather than a reversed takeoff. Trigger contact using the actual ground/landing target, not only elapsed animation time.

Keep one root/pivot and body scale across all clips. The game controller owns world movement; clips animate in place, with documented foot-contact and liftoff events. Synchronize walk playback with travel speed to reduce sliding. Keep flight phase consistent when changing direction; avoid resetting the wingbeat on each turn. Blend transitions initially over about 0.1–0.25 s and tune visually. Wings must remain inside animation bounds at full extension.

For references, request the key poses (folded, crouch, push-off, wings up, wings down, glide, bank, landing flare, contact, left/right walk contact). Generate or review front, side, rear, and three-quarter views of those poses as needed. For sprites, render every sampled animation frame from the same directional camera set using the common animated proxy; independently generated frames are prone to flicker. Start with 8–12 samples per cycle and increase only if playback needs it. Runtime mesh animation interpolates keyframes and does not require a sprite atlas.

Record clip name, loop mode, duration, sample rate if baked, root-motion policy, contact events, camera/view index, frame rectangles, and bounds in an `animations.json` manifest when assets are produced. All optional map passes must match the same pose, frame, and camera.

## 3. Generate and review the turnaround

Use original photos as appearance references. Request orthographic-style framing, fixed scale, complete silhouette, a common body pivot, soft neutral light, transparent background, no props, and no text. Save exact prompts and tool mode. Generated projections are approximate even when the prompt says orthographic.

Pilot sheet: four columns, three rows, row-major order:

| Index | Requested view | Azimuth | Elevation |
|---|---|---:|---:|
| 0 | Front | 0 | 0 |
| 1 | Front three-quarter | 45 | 0 |
| 2 | Side | 90 | 0 |
| 3 | Rear three-quarter | 135 | 0 |
| 4 | Back | 180 | 0 |
| 5 | Rear three-quarter | 225 | 0 |
| 6 | Opposite side | 270 | 0 |
| 7 | Front three-quarter | 315 | 0 |
| 8 | Elevated front | 0 | 45 |
| 9 | Elevated back | 180 | 45 |
| 10 | Overhead | 0 | 90 |
| 11 | Underneath | 0 | -90 |

These are requested views, not calibrated camera measurements. At the poles, define image roll explicitly during baking. The contact sheet is a review artifact, not automatically a production atlas. If pose, framing, cell layout, or camera direction drift, regenerate the affected view separately using the reference and approved canonical view. Do not silently mirror markings.

Review face shape, body proportions, wing folds, tail length, feet, feather pattern continuity, framing, and actual alpha. Reject head tracking, duplicate angles, clipped extremities, baked cast shadows, and checkerboard pixels pretending to be transparency. Record shortcomings before using the images downstream.

## 4. Make maps share a surface

A UV map is a relationship between vertices and texture coordinates. A visually convincing drawing of a UV layout does not create that relationship. Normal maps must represent the same surface as their color/depth images. Do not generate unrelated purple normal maps or infer depth directly from feather brightness.

Two valid implementations:

1. **Directional impostor:** use a camera-facing quad with UV corners (0,0), (1,0), (1,1), (0,1). Bake each direction from an approved common owl mesh or a deliberately approximate proxy. Store per-view color/alpha, linear depth, and view-space normals. This is an optional sprite path; the articulated proxy is now the preferred first implementation.
2. **Mesh character:** fit/model a simple common mesh using the references. Start with procedural color and ordinary geometry normals; add UVs, projected color, or baked tangent-space normals only if the visual effect benefits from them. This supports larger camera changes and animation.

A proxy can be sufficient for a distant character, but label its depth and normals approximate. A silhouette-based inflated surface cannot recover hidden anatomy. Mesh fitting, UV unwrapping, and baking remain a separate production stage; the generated sheet alone does not supply them.

### Minimal stylized material contract

The first playable owl needs geometry, animation controls, and shader coordinates. It does **not** need realistic albedo, a UV unwrap, a normal-map image, depth textures, roughness maps, or ambient occlusion. Geometry normals can provide broad volume lighting if desired; an unlit emissive effect may not need them either. Use procedural bands/noise and simple face/eye/wing masks to suggest owl structure. Preserve the silhouette and facial disk so the effect still reads as an owl.

Use primitive UVs, local/rest-position coordinates, or simple planar/triplanar projection if texture coordinates become necessary. Triplanar projection is a possible implementation technique, not a required library feature. For moving wings, use rest-position coordinates or per-part local coordinates to keep procedural patterns attached. Screen-space `gl_FragCoord` is also valid when an intentionally screen-anchored effect is desired. `references/shaders/shaderRef.glsl` needs adaptation rather than being assumed to work unchanged on an animated mesh. A custom vertex shader must retain the relevant transforms and, for skinned geometry, implement the skinning path.

### Public tools to reuse

Checked against official documentation on 2026-11-11. These are proposed components; nothing has been installed or implemented in this documentation update.

| Tool | Role in this pipeline | Boundary |
|---|---|---|
| [Three.js ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html) | Run custom GLSL with WebGLRenderer for the procedural owl appearance | Supplies rendering infrastructure, not an owl reconstruction or finished shader adaptation |
| [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) and [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html) | Play clips, loop actions, and crossfade transitions | Owl poses/keyframes still need authoring or procedural generation |
| [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | Load an optional authored glTF/GLB owl asset | A loader, not a generator; unnecessary for a code-built part hierarchy |
| [Blender animation and rigging](https://docs.blender.org/manual/en/dev/animation/) | Optional offline authoring for a reusable owl rig and animations | Can be skipped for a simple procedural hierarchy |
| [Blender render baking](https://docs.blender.org/manual/en/latest/render/cycles/baking.html) | Optional normal/AO/material baking if later needed | Not required for the stylized first version |

Recommended starting stack: Three.js + a reusable articulated owl proxy + procedural GLSL + an explicit animation state machine. This avoids making image reconstruction a prerequisite. Use Blender only if hand-authored deformation or offline sprite renders improve the result. These tools cover much of rendering/animation/baking, but the checked documentation does not establish a one-click library that converts an arbitrary owl photo into every required animation.

## 5. Optional bake contract and calculations

Coordinate convention: right-handed object space, +Y up, +Z toward the owl's front. Azimuth increases from +Z toward +X. For radius R, azimuth a, elevation e, camera position relative to pivot is:

`R * (sin(a)*cos(e), sin(e), cos(a)*cos(e))`

Keep orthographic scale, pivot, pose, near/far planes, dimensions, and camera roll identical across associated passes. Store those values in metadata.

For the optional depth-reprojected, relit impostor path (omit these passes for the minimal procedural mesh):

- Color + alpha: ideally base color without directional lighting; generated photographs still contain illumination and are not automatically albedo.
- Depth: positive linear camera distance with explicit near/far. Encode `d=(distance-near)/(far-near)`; decode `distance=near+d*(far-near)`. Prefer sufficient precision such as 16-bit or floating point for depth; do not treat hardware nonlinear depth as this value.
- View-space normals: +X image right, +Y image up, +Z toward viewer. Encode `rgb=0.5*N+0.5`; decode `N=normalize(2*rgb-1)`. Store as linear data, not sRGB.
- Alpha: identical silhouette coverage in every pass. Exclude transparent pixels from derivative and lighting calculations.

Optional: roughness and ambient occlusion if the lighting model uses them. Start with a documented material roughness constant rather than pretending it was measured. Metallic can be zero for feathers. These are material choices, not recovered photo data.

For an orthographic depth field, reconstruct positions with x increasing right and y increasing up: `P=(x,y,-distance)`. Estimate normals with `normalize(cross(dP/dx,dP/dy))`, orient them toward the viewer, and avoid finite differences across silhouette gaps. Scale derivatives in world units, not raw pixel units. This produces normals of the supplied depth, not additional geometric truth.

For tangent-space mesh normals, export a tangent basis matching the bake, record the green-channel convention (+Y), and transform the decoded normal through the tangent/bitangent/normal basis. Do not use an impostor view-space normal as a mesh tangent-space normal.

## 6. UV packing and directional selection

For a production C-column, R-row atlas with top-to-bottom row index r, column c, and local UV (u,v) where v points upward:

`atlasUV = ((c+u)/C, (R-1-r+v)/R)`

This assumes the upload orientation has been configured consistently. Apply an inset and extrude edge colors into gutters to prevent filtering bleed; preserve alpha. Use the same rectangles for all map types. Record actual pixel rectangles rather than relying on a generated sheet's requested grid.

For eight horizon views, calculate relative camera azimuth after removing character yaw:

`a = wrapTo2Pi(atan2(cameraLocal.x, cameraLocal.z))`

`view = floor(a/(2*pi/8)+0.5) % 8`

Snap first. Simple color blending of adjacent silhouettes can make double images; depth-aware reprojection or additional views is needed for better transitions. Elevation views need their own selection logic; the four supplementary pilot views are not a complete spherical capture.

Apply light in the same coordinate frame as the normal, for example `max(dot(N,L),0)`. Parallax is limited by the stored depth and cannot expose correct hidden surfaces. Clamp displacement and provide a fallback at grazing angles.

## 7. Validate before integrating effects

Inspect a complete orbit at intended game size. Check silhouette continuity, head orientation, foot pivot, directional transitions, transparency halos, color consistency, normal orientation with a moving light, depth precision, and atlas bleed. Check memory budget: an uncompressed 2048-square RGBA8 texture is 16 MiB before mipmaps; multiple passes add up.

For WebGL1 non-power-of-two textures, use clamp-to-edge and non-mipmap filtering. Test upload orientation explicitly. See [MDN: Using textures in WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL).

Only after the base owl renders correctly should the radial-wave logic in `references/shaders/shaderRef.glsl` be adapted as a deliberate material or screen-space effect. That file currently outputs procedural color; it does not reconstruct geometry, sample owl textures, or calculate UVs/normals. Its inverse-wave expression also needs numerical review before reuse.

## Completion gates

- Reference stage: generated views saved, inspected, provenance and limitations recorded.
- Stylized asset stage: recognizable approximate proxy and all required animation states, stable shader coordinates, and documented transitions. UV/normal/depth maps are not a completion gate for this path.
- Optional mapping stage: if chosen, save actual UVs and/or aligned image passes with camera metadata and bake settings.
- Runtime stage: orbit, full wing extension, walk contact, liftoff, touchdown contact, loop seams, transitions, shader stability, transparency, performance, and target-browser checks pass. Test moving lights only if lighting is used.

Do not describe the reference stage as a finished 3D model or a production-ready material set.

## Pilot execution result

Saved `generated/turnaround-v1.png` using built-in image generation, with the exact prompt in `generated/turnaround-prompt.txt`. Inspected the result visually and verified a 1448 × 1086 RGBA file with alpha values spanning 0–255. Twelve apparent views are present. Scale/pivot vary, some head alignment and feather patterns drift, and lower views approach cell boundaries. Accepted as initial visual reference only; not approved as a calibrated sprite atlas. See `views.json` for machine-readable provenance, requested view ordering, and review status.

UV mesh, depth, and normal-map deliverables are not yet generated. Their prerequisite is an approved common surface; producing unrelated painted maps would not meet the alignment requirement. Following the clarified stylized scope, the next production operation is to build a simple articulated proxy, implement the required animation states, review silhouette/motion, and adapt the procedural shader. Bake aligned maps only if subsequently useful. The original photograph and shader remain unchanged.


## Animation reference generation result — 2026-11-11

Generated seven new PNG reference sheets using built-in `image_gen`, with the original photograph and approved initial turnaround supplied as appearance/proportion references. Each sheet requests four poses across columns and three camera angles down rows (front, left profile, rear three-quarter), giving 12 pose views per sheet, 84 new pose views total. Actual camera angles and spacing are approximate; these are not calibrated atlas cells.

| Saved image | Pose coverage |
|---|---|
| [Flight](../assets/owls/barn-owl/generated/flight-v1.png) | Upstroke, mid-downstroke, downstroke bottom, recovery |
| [Takeoff](../assets/owls/barn-owl/generated/takeoff-v1.png) | Crouch, push-off, airborne stroke, climb |
| [Touchdown](../assets/owls/barn-owl/generated/touchdown-v1.png) | Approach, flare, foot contact, settled |
| [Walking](../assets/owls/barn-owl/generated/walking-v1.png) | Alternating foot contacts and passing poses |
| [Rest](../assets/owls/barn-owl/generated/rest-v1.png) | Relaxed neutral, half-closed eyes, closed eyes, return |
| [Idle](../assets/owls/barn-owl/generated/idle-v1.png) | Alert neutral, head turns, blink |
| [Glide and bank](../assets/owls/barn-owl/generated/glide-bank-v1.png) | Level glide, left/right bank, shallow descent |

Exact prompts are in `generated/animation-prompts.json`, `generated/glide-bank-prompt.txt`, and `generated/glide-bank-correction-prompt.txt`. The glide/bank first attempt contained a cloudy background; a second built-in image edit removed it, and only the selected corrected output was copied into the project. Originals and the shader were preserved.

Validation: visually reviewed all selected sheets and opened every saved PNG to verify dimensions, RGBA mode, and both transparent and opaque pixels. Machine-readable dimensions, hashes, requested pose/view order, and per-sheet review notes are in `animation-references.json`.

Accepted for approximate modeling and animation pose reference. Remaining issues: changing body scale/pivot and feather details, approximate camera angles, tight/cropped wingtip margins in some flight/landing views, weak takeoff leg extension, and inconsistent foot identity across walking views. Glide/bank body roll is only approximate. Do not crop the requested grid blindly or play these as seamless animation. These limitations are compatible with using the images to guide a simplified procedural owl, but would require cleanup for direct sprite use.

No UV/normal/depth maps, rig, timed clips, or playable animation were generated in this operation. Next stage: construct the approximate articulated owl from these silhouettes, implement the state transitions described above, and apply the procedural shader. Realistic plumage reconstruction remains outside the required scope.


## Superseded local WebGL prototype

`app/index.html` now renders an approximate articulated barn owl using locally vendored Three.js. Body/head volumes, a heart-shaped facial disk, dark eyes, layered wing feathers, and a tail fan are guided by the photograph and pose sheets. All nine reference images are available in the scene's reference library. This is a procedural approximation, not a reconstructed photographic mesh.

The live material loads `references/shaders/shaderRef.glsl`. It retains RGB channel-offset radial patterns and surface noise, removes mouse/click uniforms, uses mesh-local coordinates, reduces radial frequency from 50 to 9, and defaults time speed to 0.12 rather than the original wave coefficient 2. Singular inverse powers were replaced by bounded arithmetic. The original shader is preserved in `archive/owl-flight/shader-original.glsl`. The revised shader requires the vertex varyings supplied by `main.js`; it is no longer a standalone screen-space shader.

Implemented animation: procedural wingbeat, automatic screen traversal and banking, and hover study. Other state references remain available but walking/takeoff/touchdown are not runtime clips yet. Controls provide pause, mode, ripple speed, and shader mix. Reduced-motion preferences start paused.

Run from the project root: `python3 -m http.server 8000 --bind 127.0.0.1`, then open http://localhost:8000/app/. No online dependencies are required at runtime.


## Previous silhouette-only implementation (superseded below)

The user rejected the assembled 3D owl. The active localhost scene now renders a generated owl silhouette on a single image plane, with procedural shader color inside its alpha boundary. The screen is white, with no visible text, controls, scenery, or 3D owl parts. The selected front glide pose comes from `generated/glide-bank-v1.png`. Gentle image-space wing deformation and screen translation approximate flight; this is not a complete multi-angle animation or a reconstructed surface.

`references/shaders/shaderRef.glsl` has been restored byte-for-byte from `archive/owl-flight/shader-original.glsl`. Only `effects/phantom-owl/owl-surface.glsl` is adapted. It preserves the original RGB band/fade equations, ring frequency, and noise function. Changes: image UV input and alpha mask; fixed center replacing mouse; time multiplied by 0.12; signed bounded reciprocal instead of undefined negative-base pow; reset the UV per RGB channel to prevent runaway accumulated distortion from washing everything white. No replacement palette, lighting model, or photographic color overlay is applied.

Image UV coordinates are currently used. True UV unwrapping, normal maps, and calibrated directional surface maps have NOT been generated or used. Do not describe the image mask as a normal map. The immediate preview establishes the corrected visual direction before further surface reconstruction. Verified the original file matches its backup, JavaScript parses, and the updated page renders in Chrome.


## Current implementation: phantom light with registered surface detail

The user's shader screenshots establish a white-dominant, faint yellow/green/rose light effect. The saturated silhouette was caused by resetting UVs inside each RGB iteration, which changed the original accumulating distortion and final distance term. The current working shader restores that accumulation and preserves `random`, frequency 50, RGB phase offsets, band/fade expressions, and `c*9+l`. `references/shaders/shaderRef.glsl` remains byte-identical to its original backup. A bounded signed reciprocal replaces undefined negative-base `pow`; intermediate precision is highp to avoid overflow. Those numeric differences mean this is an adaptation, not a promise of pixel-identical output across GPUs.

`effects/phantom-owl/owl-surface.glsl` adds slow smooth domain distortion, a liquid-density contour field, and patchy transparency. The original color output supplies the color spectrum; no replacement rainbow palette or saturation boost is used. Subtle neutral optical density from image luminance reveals eye sockets, face and feathers under passing pools. The image's photographic RGB is not painted as a solid skin. White background and absence of visible UI are preserved. The current motion is a gliding image with subtle wing deformation, not a complete articulated flight cycle.

### Source and map artifacts

- `generated/phantom-front-v1.png`: 2172 × 724 single frontal gliding owl generated with built-in image_gen using the original photograph and glide sheet as references. Its exact prompt is in `generated/phantom-front-prompt.txt`.
- `maps/phantom-front-uv.json`: exact planar image-coordinate convention and UV corners.
- `maps/phantom-front-normal.png`: image-registered view-space normal estimate, +Y up.
- `maps/phantom-front-relief.png`: R estimated relief, G source luminance, A coverage; linear data, not a display-color texture.
- `maps/manifest.json`: provenance, encoding, and limitations.
- `effects/phantom-owl/surface-maps.js`: reproducible derivation; broad head/breast/wing relief is hand-tuned, fine detail comes from image luminance. Runtime regenerates the same arrays and uses them directly as data textures; exported PNGs are inspection/reuse artifacts. Fully transparent PNG pixels have no meaningful normal; use alpha to exclude them.

These maps have exact pixel registration to the selected image, but their surface geometry is approximate. Pigment/shadows can be mistaken for height; there is no accurate anatomical reconstruction, multi-angle UV unwrap, or cross-view consistency. Do not label these maps anatomically accurate. True measured or modeled surface normals would require a calibrated reconstruction or a consistent authored surface even if that surface were only used offline for baking.

### Validation

Verified original shader matches backup; source, normal and relief have identical dimensions and alpha; sampled opaque normals have unit length within byte-encoding tolerance. Local Chrome reported a runnable shader and no console/resource errors. Reviewed deterministic frames at 0, 12, and 30 seconds plus a 390 × 844 viewport: pale color contours and partial face/feather visibility shift over time. The map export/browser check is `tools/verify-phantom.mjs` (requires a local Chrome debugging session on port 9223). No assertion of pixel-perfect screenshot matching or anatomical accuracy is made.

## Standalone recreation handoff

See [PHANTOM_OWL_RECREATION.md](PHANTOM_OWL_RECREATION.md) for the complete accepted-version handoff. It includes the exact source code, original shader, pinned dependency hashes, embedded final owl image and rendered reference frames, a reconstruction script, the map derivation math, color-preservation rationale, tuning examples, other-object adaptation examples, and browser QA/export instructions. The embedded binary appendix should be decoded programmatically rather than read into an agent's context. No runtime implementation changes were made while writing this guide.

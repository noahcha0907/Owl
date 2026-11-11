# Phantom owl game

Run `python3 -m http.server 8000 --bind 127.0.0.1` from this project root, then open [localhost:8000](http://localhost:8000/). The game lives at `/app/game/`; the root and previous `/owl-flight/` URL redirect there. The original single-owl effect preview remains at [/app/](http://localhost:8000/app/).

The opening menu shows the live floating owl and a **Start** button. Press Start, then click or tap each approaching owl. Each hit earns 10 points and disperses its color into a fading cloud. Owls begin at a larger, readable size (150 px viewport width on desktop, 80 px on a narrow phone). Spawns become more frequent as the round continues.

You start with **4 lives**, shown beside the score. Each owl has its own perspective flight line across the screen. Off-center owls grow and continue outward along that line; centered owls pass through the camera. They share no central destination or sudden exit turn. There are 1.15 seconds of close approach and a brief near-camera fade; each completed passage costs exactly one life. They remain hittable until nearly invisible. The fourth miss ends the round. **Try again** resets the score and restores all four lives. The menu does not advance the game clock or spawn targets, and background tabs pause play.

The menu uses the same full-canvas camera framing, surface scale, pixel density, and per-frame animation updates as `/app/`. During play, three independent motion/air simulations provide different wing timing. Each approaching owl's surface and cloud shaders render directly into its screen viewport at the canvas pixel density (up to 2×), so growing owls retain procedural detail without enlarging a fixed-resolution picture. Colors, wing geometry, animation rules, and air simulation come from the existing effect. Shooting uses the deformed owl silhouette with a small pointer allowance; detached cloud and empty viewport corners do not count as targets.

A hit transfers the whole owl's color density and existing wake velocity into its own `CloudField`, the same simulation and color shader used for wing disturbances. A gentle outward impulse releases the shape; advection, swirl, diffusion, and lift move the cloud. Its final fade starts after 0.5 seconds and finishes at 2.2 seconds. Density is simulated on a 512×320 grid, while the visible strand shader runs at screen resolution. There are no hit particles or retained owl image frames. Finished fields release their GPU buffers and materials.

Released clouds react to every nearby live owl. Six moving wing points and one body point are transformed from screen coordinates into each cloud's UV coordinates. Translation, wingbeats, and growth impart velocity, expansion, and tip swirl with a smooth distance falloff and a stronger response at similar depths. Interactions run in batches of eight sources, so additional nearby owls still contribute. Only velocity changes: the existing color is transported, without stamping another owl image into the cloud. See [cloud-interaction.mjs](effects/cloud-burst/cloud-interaction.mjs) for the coordinate conversion and [cloud-field.mjs](effects/cloud-wake/cloud-field.mjs) for the force pass.

## Project map

    app/                         Original single-owl effect preview
      game/                     Playable game entry, UI, input, and rendering
    game/                       Spawn, approach, scoring, and round rules
    effects/
      phantom-owl/               Wing motion, geometry, feature maps, owl shaders
      phantom-color/             Shared procedural color and strand functions
      cloud-wake/                Airy velocity/density transport and rendering
      cloud-burst/               Hit pigment dispersal and fade
    assets/owls/barn-owl/
      references/               Original owl photograph
      generated/                Runtime owl image, pose sheets, generation prompts
      maps/                     Exported surface maps and provenance
      views.json                Turnaround metadata
      animation-references.json Pose-sheet metadata
    docs/
      PHANTOM_OWL_RECREATION.md  Complete standalone recreation package
      OWL_ASSET_WORKFLOW.md      Historical asset-generation log
      previews/barn-owl/         Approved visual references and capture metadata
    references/shaders/          Preserved original shader source
    archive/owl-flight/          Earlier experiments and preserved backup
    tools/                      Verification, map export, and guide refresh
    vendor/three/               Pinned Three.js 0.180.0 modules and license
    owl-flight/index.html       Compatibility redirect for the original URL

## Where to edit

| Change | File |
|---|---|
| Flap count, timing, and pauses | [flight-motion.mjs](effects/phantom-owl/flight-motion.mjs) |
| Wing bending and thickness | [wing-deformation.glsl](effects/phantom-owl/wing-deformation.glsl) |
| Alpha-derived shell | [wing-volume.mjs](effects/phantom-owl/wing-volume.mjs) |
| Face/feather map estimates | [surface-maps.js](effects/phantom-owl/surface-maps.js) |
| Owl visibility and feature reveal | [owl-surface.glsl](effects/phantom-owl/owl-surface.glsl) |
| Shared colors and strands | [phantom-color.glsl](effects/phantom-color/phantom-color.glsl) |
| Cloud drift, breakup, and density | [cloud-field.mjs](effects/cloud-wake/cloud-field.mjs) |
| Camera, loading, emitters, and render loop | [main.js](app/main.js) |
| Game spawn rate, approach, and scoring | [game-state.mjs](game/game-state.mjs) |
| Game input, UI, and rendering | [game/main.js](app/game/main.js) |
| Reusable complete owl rendering and hit mask | [owl-effect.js](effects/phantom-owl/owl-effect.js) |
| Whole-owl cloud release | [cloud-burst.js](effects/cloud-burst/cloud-burst.js) |

Keep [shaderRef.glsl](references/shaders/shaderRef.glsl) unchanged. Earlier code in `archive/` is preserved as historical source and is not imported by the app.

## Reproduction and checks

[PHANTOM_OWL_RECREATION.md](docs/PHANTOM_OWL_RECREATION.md) preserves the approved effect snapshot: exact settings, embedded source/image/reference captures, extraction instructions, and limitations of the surface approximation. That snapshot predates the game; the new game modules are documented above and do not change its shader or animation numbers.

Run `node tools/verify-snapshot.mjs --motion-only` for the motion checks. For browser verification, start a dedicated Chrome debugging session on port 9223 as described in the guide, then run `node tools/verify-snapshot.mjs`.

Run `node tools/verify-game.mjs` for game rule checks. The game accepts `?seed=12345&test=1` for deterministic browser QA: animation is manually advanced with `window.__game.step(seconds)`. Omit `test=1` for normal play.

With the server and dedicated Chrome debug session running, `node tools/verify-game-browser.mjs` verifies actual mouse/touch hits, transparent-area misses, overlapping targets, bursts, scoring, game over, restart, portrait layout, and the live animation loop. Captures and its report are written to `/tmp/owl-game-qa-captures` by default.

When an approved change needs to be recorded, update the guide's prose and reference captures, then run `python3 tools/rebuild-guide.py`. This refreshes its embedded source, assets, and checksums without changing the live effect. Run it only when you intend to update the documented snapshot.

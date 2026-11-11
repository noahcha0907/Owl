# Barn owl assets

- `references/`: the unchanged original photograph.
- `generated/`: the active `phantom-front-v1.png`, earlier pose/turnaround sheets, and exact generation prompts.
- `maps/`: registered approximate normal/relief exports and their UV/provenance metadata. The app regenerates its data textures from the runtime PNG on load.
- `views.json` and `animation-references.json`: reference-sheet descriptions, review notes, and hashes. Their asset paths are relative to this species folder, except the explicit relative source path inside the UV JSON.

The runtime currently uses only `generated/phantom-front-v1.png`. Other sheets guide future work; they are not a reconstructed multiview mesh or finished animation atlas.

Rendered effect previews are in [docs/previews/barn-owl](../../../docs/previews/barn-owl/). The complete guide is [PHANTOM_OWL_RECREATION.md](../../../docs/PHANTOM_OWL_RECREATION.md).

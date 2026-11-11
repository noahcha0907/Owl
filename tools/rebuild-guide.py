"""Refresh the standalone guide from approved source/assets; retain its prose.

Run from any directory: python3 /path/to/project/tools/rebuild-guide.py
Review prose and captures before recording changed effects or parameter values.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import textwrap

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "docs/PHANTOM_OWL_RECREATION.md"
SOURCE_SECTION = "## 11. Complete exact source snapshot"
TEXT_FILES = [
    ("README.md", "markdown"),
    ("index.html", "html"),
    ("owl-flight/index.html", "html"),
    ("references/shaders/shaderRef.glsl", "glsl"),
    ("archive/README.md", "markdown"),
    ("archive/owl-flight/shader-original.glsl", "glsl"),
    ("app/index.html", "html"),
    ("app/main.js", "javascript"),
    ("app/game/index.html", "html"),
    ("app/game/main.js", "javascript"),
    ("app/game/game.css", "css"),
    ("game/game-state.mjs", "javascript"),
    ("effects/phantom-owl/owl-effect.js", "javascript"),
    ("effects/cloud-burst/cloud-burst.js", "javascript"),
    ("effects/cloud-burst/cloud-interaction.mjs", "javascript"),
    ("effects/phantom-owl/flight-motion.mjs", "javascript"),
    ("effects/phantom-owl/wing-volume.mjs", "javascript"),
    ("effects/phantom-owl/wing-deformation.glsl", "glsl"),
    ("effects/phantom-owl/surface-maps.js", "javascript"),
    ("effects/phantom-owl/owl-surface.glsl", "glsl"),
    ("effects/phantom-color/phantom-color.glsl", "glsl"),
    ("effects/cloud-wake/cloud-field.mjs", "javascript"),
    ("tools/verify-snapshot.mjs", "javascript"),
    ("tools/verify-phantom.mjs", "javascript"),
    ("tools/verify-game.mjs", "javascript"),
    ("tools/verify-game-browser.mjs", "javascript"),
    ("tools/rebuild-guide.py", "python"),
    ("assets/owls/barn-owl/README.md", "markdown"),
    ("assets/owls/barn-owl/generated/phantom-front-prompt.txt", "text"),
    ("assets/owls/barn-owl/maps/phantom-front-uv.json", "json"),
    ("assets/owls/barn-owl/maps/manifest.json", "json"),
    ("docs/previews/barn-owl/animation-v12/capture-manifest.json", "json"),
    ("vendor/three/THREE-LICENSE.txt", "text"),
]
BINARY_FILES = ["assets/owls/barn-owl/generated/phantom-front-v1.png"] + [
    "docs/previews/barn-owl/animation-v12/phantom-" + name + ".png"
    for name in ["full-depth", "recovery", "pause", "resume", "mobile"]
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_block(path, language, content):
    longest = max((len(s) for s in re.findall(r"`+", content)), default=0)
    fence = chr(96) * max(3, longest + 1)
    return f"### `{path}`\n\n<!-- FILE: {path} -->\n{fence}{language}\n{content}\n{fence}\n"


def main():
    prose, separator, _ = GUIDE.read_text(encoding="utf-8").partition(SOURCE_SECTION)
    if not separator:
        raise ValueError("Guide is missing its complete-source section marker.")
    dependencies = [
        {"path": "vendor/three/" + name,
         "url": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/" + name,
         "sha256": sha((ROOT / "vendor/three" / name).read_bytes())}
        for name in ["three.module.js", "three.core.js"]
    ]
    manifest = {
        "format_version": 3,
        "snapshot_date": "2026-11-11",
        "snapshot": "pause-after-5-to-7-12",
        "project_layout": "organized-project-13",
        "description": "Same approved phantom owl effect in the organized project layout.",
        "files": {path: sha((ROOT / path).read_bytes())
                  for path in [p for p, _ in TEXT_FILES] + BINARY_FILES},
        "dependencies": dependencies,
        "source_image_dimensions": [2172, 724],
        "reference_seed": 12345,
        "reference_capture": "docs/previews/barn-owl/animation-v12/capture-manifest.json",
        "server_root": ".",
        "entry": "app/index.html",
        "compatibility_entry": "owl-flight/index.html",
        "runtime_external_network_required": False,
    }
    originals = [ROOT / "references/shaders/shaderRef.glsl",
                 ROOT / "archive/owl-flight/shader-original.glsl"]
    assert originals[0].read_bytes() == originals[1].read_bytes()
    blocks = [source_block(path, language, (ROOT / path).read_bytes().decode("utf-8"))
              for path, language in TEXT_FILES]
    blocks.append(source_block("recreation-manifest.json", "json",
                               json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"))
    assets = []
    fence = chr(96) * 3
    for path in BINARY_FILES:
        encoded = "\n".join(textwrap.wrap(base64.b64encode((ROOT / path).read_bytes()).decode(), 100))
        assets.append(f"<!-- BASE64_FILE: {path} -->\n{fence}base64\n{encoded}\n{fence}\n")
    intro = (
        SOURCE_SECTION + "\n\n"
        "The file-marked blocks contain exact current source bytes. The extractor preserves "
        "final newlines and verifies the manifest. Explanatory snippets above are not extracted. "
        "Longer fences protect source files that contain their own Markdown fences.\n\n"
        "The app loads the surface, shared-color, and wing-deformation GLSL files from `effects/`. "
        "The original shader under `references/` and its identical backup under `archive/` "
        "are preserved for comparison. `tools/rebuild-guide.py` can refresh this snapshot after "
        "an approved change, using the prose and reference assets in the restored project.\n\n"
    )
    asset_intro = (
        "## 12. Embedded assets — decode programmatically\n\n"
        "The exact owl PNG and five current reference renders follow. Decode this data with "
        "the extractor rather than loading it into model context. Only the owl PNG is a runtime "
        "texture; screenshots are visual references.\n\n"
    )
    GUIDE.write_text(prose + intro + "\n".join(blocks) + "\n" + asset_intro + "\n".join(assets), encoding="utf-8")
    print(json.dumps({"guide": str(GUIDE.relative_to(ROOT)), "artifacts": len(manifest["files"]),
                      "dependencies": len(dependencies), "bytes": GUIDE.stat().st_size}))


if __name__ == "__main__":
    main()

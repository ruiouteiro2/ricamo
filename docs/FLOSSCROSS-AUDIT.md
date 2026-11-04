# Local chart workspace: FlossCross source audit

Inspected 2026-11-03: https://flosscross.com, its `/designer/` application and `/canvas` renderer. The user explicitly reported contractual permission from the author to copy the functionality. This integration preserves upstream notices and does not apply Ricamo's MIT licence to FlossCross's own code, photography or fonts.

## Source inventory

The public application identifies itself as version **133**. `vendor/flosscross/runtime.json.gz` contains 4,520 downloaded application assets plus the official Pixi 6.5.9 CSP adapter, its licence, Image-Q notices and font licences (4,525 entries). Each entry records its original path, original bytes and SHA-256. The archive is a pinned source input; builds never contact the site. It includes the Vue 2 application, Vuex stores, precompiled components, locales, image quantization, cropper, PDF engine, Pixi renderer, fonts, masks, canvas textures, 555 symbol SVGs and four thread texture variants for 499 DMC / 444 Anchor catalogue identities. Exploratory 404s were icon names actually supplied by the Material Icons font or by the other icon directory, not omitted assets requested by the tested application.

Browser automation could not inspect the live remote UI because its host was unavailable and the native browser URL could not be verified. Analysis therefore used the downloaded HTML and JavaScript; interactive checks run against the resulting local Windows application. No claim of exhaustive remote-browser exploration is made.

## Functionality and mechanisms

| Workflow | Source mechanism | Local treatment |
| --- | --- | --- |
| Three chart slots, names, descriptions, previews, automatic recovery copies | `slots` store, `slotsSv`, `reserver`, dashboard | Retained; all chart, history, render, clipboard, navigation and recovery records are stored in Ricamo's SQLite state |
| Blank chart creation | `s-new-pattern`, indexed cell grid | Retained; upstream 300 × 300 maximum; existing Ricamo generator still supports 500 × 500 |
| Image import | Source → crop/pixel art → size → palette → colour reduction | Retained; bounded file input and image metadata validation added |
| Quantization and dithering | Image-Q; NeuQuant / RGBQuant / WuQuant; selectable colour distances and nine diffusion kernels | Retained, with illumination, transparent/locked palette entries and nearest-colour reduction |
| Paint / erase / eyedropper / line / shapes / fill / isolate repair | `tools`, `st.paints.pps`, immutable action processors | Retained, including brush sizes 1/2/3/5/9, diagonal fill, shape variants and isolate distance/replacement choices |
| Full / half / petite / three-quarter / mixed stitches | `crossIndexes` descriptors `cr`, `hc1/2`, `pt`, `qt`, `qo`, `qf`, `bi` | Preserved losslessly; not flattened into Ricamo's older whole-cross revision format |
| Backstitch | Line / pen / dot; whole, half and quarter grid steps; segment/line and colour-filtered erasure | Retained |
| Selection | Target all/cross/backstitch; clipboard; erase, flip, rotate, deselect | Retained with undo/redo history |
| Thread palette | DMC / Anchor; colour grouping, sorting, usage, unused-colour removal, symbols, per-kind strand counts, blends and comments | Retained |
| Canvas | Pixi WebGL, photographed cross/pad textures, flat/symbol styles, Aida/evenweave, custom fabric colour, grid/rulers/centre, zoom/pan | Retained; official Pixi CSP adapter avoids relaxing script policy |
| Source overlay | Source visibility, opacity, under/over stitches | Retained |
| Interchange | FCJSON and OXS, including mixed/fractional stitch mappings | Retained, with model validation before import |
| Documents | SVG and PDF: page/header/footer, margins, title/description, pattern/symbol size, colour/monochrome, floss lists/sorting, Pattern Keeper option | Retained; file output uses Ricamo's native save dialog |
| Layout and language | Desktop/compact/mobile layouts, resize store, help | Ricamo shell, local Nunito/Quicksand fonts and rose/paper theme; Italian and English follow the host selector. Upstream help and some specialist diagnostic text retain English fallback |

## Integration and safety

`build/schema-studio.mjs` verifies each archived digest and emits local assets under `/studio/`. Changes to the copied runtime are explicit build transforms: local asset paths, hash routing, replacement of browser database startup, and ignoring stale palette-count callbacks after a chart has been cleared. `bridge.js` replaces storage with an acknowledged, batched message adapter. It flushes the current model before leaving, bridges exports and validates imported models/images. Database failures retain pending values and keep close/navigation guarded for retry.

`core/schema-studio.mjs` validates allowed storage keys, safe JSON, palette identities, supported stitch descriptors, cell indices and quarter-step backstitch geometry. Storage is bounded to 48 MiB across the three slots; individual files are limited to 25 MiB. The optional `schemaStudio` state field is included by the existing normal backup/restore path. Existing patterns, stock, reservations and the Stitch Studio generator are not converted or replaced. This workspace's charts remain separate from the older pattern/project revision model, so fractional charts are not incorrectly counted as ordinary full-cross projects.

No analytics script, remote page, webview, network permission or remote runtime dependency is added. The renderer's sandbox, context isolation, navigation denial and CSP remain enabled. The HTML is local, nested canvas URLs are local, and the product does not open FlossCross automatically. The downloaded Pixi CSP adapter is from the official npm `@pixi/unsafe-eval` 6.5.9 package; its name describes the API it replaces, not a permission granted to the renderer.

## Verification

`tests/schema-studio.test.mjs` covers immutable/idempotent commands, mixed/fractional/quarter-step geometry, invalid payload rejection, repository readback, backup restoration and slot isolation. `tests/desktop-schema-studio.mjs` exercises the actual sandboxed Windows app: blank creation; full/half/petite/three-quarter paint; backstitch; immediate navigation after painting; SQLite readback; FCJSON/OXS round trips; SVG/PDF generation; native file output for all four formats; image conversion; resizing; full backup inclusion; restart; Italian switching; and zero page errors, missing requested resources or HTTP requests. These representative journeys do not establish that every possible option or third-party file has been tested.

Source profiles and generated evidence are kept in `.runtime/schema-studio-*`, outside Git and the distribution. Packaged/installed validation is recorded separately in `docs/STATUS.md`.

## Responsiveness and photographic workflow — 0.7.1

Image-Q palette quantization, nearest-colour mapping/dithering and the isolated palette-pair reduction loop now execute in dedicated cancellable workers. The exact Image-Q module is isolated from the pinned source with the declared Babel parser dependency; it is not replaced by a different quantizer. Workers are terminated on a superseding request or component teardown and have bounded deadlines. Nearest-colour byte parity, palette locking and UI heartbeat/cancellation have Windows journey coverage. Four photographic presets are exposed inside the advanced converter.

The host also provides **Photo realism and beads**, opening Ricamo's native image workflow. It offers maximum realism (500 colours/no small-region cleanup), photographic (120), balanced (40) and simplified (16) levels. Increasing the grid up to 500 stitches per side is explicit and updates the displayed physical size. Bead review can analyse the source image before quantization for sparse highlights or saturated colour accents. These are colour heuristics, not object/jewellery recognition. Actual bead diameter and fabric pitch govern non-overlap; the user chooses a bead, confirms its size and fastening thread, reviews positions and applies them to a normal typed Ricamo revision. Broad uniform areas and transparent pixels do not produce highlight candidates.

Studio storage requests now time out instead of holding the interface pending indefinitely. Failed writes retain the latest valid received snapshot; **Save recovery and leave** exports it locally. **Import recovery** validates the snapshot and asks before replacing the three studio slots. Native failure/recovery/export/restore is tested with an injected storage error. These controls do not claim that an unresponsive operating system or every possible failure can be recovered without intervention.

Outside the chart workspace, Shopping now uses variable-height windowing while totals and exports still use the complete filtered order set. Catalogue photos are emitted as local image files, retaining their original bytes, rather than parsed as large inline JavaScript strings. Source catalogues and attribution remain unchanged. See `docs/STATUS.md` for copied-data navigation measurements and packaged evidence.

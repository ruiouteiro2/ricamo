# Stitch Studio engine audit and integration

Reviewed against the supplied source and Ricamo adapter on 2026-10-27. This records ENG-01 discovery, reuse and limits; it does not claim that image quantization reproduces hand-designed embroidery without review.

## Source identity and separation

The supplied application is Stitch Studio 0.1.0: a Vue/TypeScript browser application built with Vite, with jsPDF/JSZip exports, Vitest engine tests and Playwright flows. Its package declares Vue ^3.5.0, Vite ^7.0.0 and Node >=22.12.0; these are the original package ranges, not Ricamo's installed versions. The supplied lockfile resolves Vue 3.5.43, Vite 7.3.7, TypeScript 5.9.3, jsPDF 4.2.1, JSZip 3.10.2, Vitest 4.1.11, Playwright 1.63.0, vue-tsc 3.3.12 and the Vue Vite plugin 6.0.9. No Python runtime, model weights, GPU or remote generation API is required by its core.

The actual computation entrypoint is `src/engine.ts`, not a CLI or service. Original file SHA-256:

`7eb63a9d4c5915249b638fa6bd1ee35cff1e6f2e3982d8a6ca60b78279fe6052`

This hash was recomputed from the user-supplied snapshot during the audit. Ricamo's copied/adapted implementation is [src/engine/stitch-engine.ts](../src/engine/stitch-engine.ts); its independent validation/integration boundary is [adapter.mjs](../src/engine/adapter.mjs). The original directory is not changed or needed at runtime. There was no need to preserve its UI: image preparation, persistence, project management and export are separate from the quantizer.

The source exposes `lab`, `deltaE`, `simplify`, `convert`, validation helpers and a legacy thread-consumption helper. `convert` consumes already-sized RGBA bytes, settings and a palette; it does not read arbitrary files, crop images, save projects, manage stock or print.

## Actual conversion pipeline

1. The renderer checks the source container/dimensions, decodes it locally, applies the requested crop/rotation/reflection and brightness/contrast, and resizes it to the output grid using canvas. Source adjustments and digest are recorded separately from the resulting cells.
2. The adapter validates exact pixel-buffer length, finite settings and a nonempty bounded palette. It copies mutable inputs before invoking the original computation.
3. On the unchanged default path, pixels below alpha 128 become empty cells (`-1`) and other partial-alpha pixels are composited against white. Optional white/colour composition or border-background removal runs on a copied grid buffer before this quantizer rule. RGB values are quantized to approximately eight-level channel steps before the histogram and CIELAB conversion.
4. The algorithm uses Euclidean CIELAB distance (CIE76). The most frequent colour initializes the first centre. Additional centres maximize squared distance weighted by the square root of histogram frequency. Eight weighted k-means refinement iterations follow; no random seed or stochastic sampler is used.
5. Cluster centres are mapped to the permitted palette, duplicate chosen colours are removed, and visible pixels are assigned to the chosen colours. Final unused colours are compacted with cell indices remapped.
6. Optional cleanup traverses four-connected same-colour regions. Regions at or below the chosen threshold adopt a neighbouring colour with the strongest boundary vote, with deterministic tie-breaking. Empty fabric is retained. A region touching a protected output-grid rectangle is kept whole.

The result is full-cross geometry. The editor separately supports half stitches and backstitch segments; generation does not infer these from image strokes. There is no dithering, vector tracing, arbitrary-font recognition, PDF-to-grid extraction, colour-card calibration or neural reconstruction in this pipeline.

For identical validated RGBA/settings/palette inputs, the current core has no random choice. File-to-RGBA preparation still depends on browser decoding/resampling and colour handling, so this is not a promise of byte-identical regenerated output across every runtime. The stored revision is the authoritative saved result.

## Deliberate changes from the source

The original source allowed 400 × 400 and 72 output colours. Ricamo raises both dimensions to 500 and the overall/detail-mode colour limit to 80, extends the symbol set and adjusts the JSON import for the Node 24 test path. Balanced and simple modes retain caps of 40 and 16 respectively. The core algorithm remains inherited.

Two bounded additions change optional conversion behavior:

- **Inventory preference:** matching may choose the nearest owned palette colour if its distance is no worse than the best alternative plus the selected tolerance (0–15 CIE76), and its absolute distance is at most 20. This happens at cluster-to-palette selection. It is a preference, not a guarantee that every output colour is owned. Empty eligible inventory falls back to the catalogue in preferred mode; inventory-only mode instead rejects an empty palette.
- **Protected cleanup:** up to 20 integer rectangles refer to output-grid coordinates. Cleanup preserves an entire connected region that touches one of them. Changing crop/orientation/output geometry resets those protection rectangles in the UI to avoid applying old coordinates to a different preparation.

The adapter accepts up to 6000 candidate colours, covering the representative 5000-material inventory plus the bundled DMC palette. Its lot eligibility pass uses a set of held material IDs before visiting materials, avoiding a full lot scan per material. Thread-category, nonarchived materials with a display RGB and positive or unknown usable holdings are eligible. Blocked/damaged lots are excluded. Reservations do not remove a colour from matching; colour choice is not stock sufficiency.

The source's internal legacy palette validator still has its own 2000-entry assumptions. Production generation enters through the adapter's validator and `convert`; it must not bypass that boundary by substituting the source's legacy validation helper.

Explicit generation options additionally allow transparency-as-empty or alpha composition over white/a chosen colour, and fixed/excluded palette indices. Composition turns formerly transparent areas into stitched cells. The separate `remove` mode accepts a target `#rrggbb` and tolerance 0–80 CIE76. It seeds matching pixels on all four image edges, then follows four-neighbour matching/fully transparent pixels. Partial-alpha samples are composited against white for comparison. Matched pixels have only their copied alpha set to zero; an enclosed matching region remains when retained pixels disconnect it from every edge. This is an approximate colour-distance mask, not semantic cutout or recognition of the subject. It operates after crop/resizing on the requested output grid; preview dimensions and the worker must therefore agree. An all-removed result is rejected as `engine.emptyImage`, and original file bytes remain untouched. Fixed colours consume palette capacity even with zero assigned stitches; those unused entries estimate zero thread. If the ordered palette identities/RGB values change, the UI clears fixed/excluded indices and displays a notice so indices cannot silently refer to another thread. Amount/name changes that retain the same eligible palette do not reset them. The previous successful preview is a comparison only; only the current result can be saved. Physical dimensions are derived from the output grid and density, with no requested-centimetre input.

Imported local catalogues can supply an explicitly selected immutable candidate palette, with name, version, source, declared licence and canonical SHA-256. The application stores at most 20 imported versions / 20000 colours total, with 6000 colours per version and a 5 MiB JSON boundary. Importing a new version leaves saved revisions unchanged. Colour substitutions compare approximate CIE76 distance and actual inventory/unit data; they require a separate draft edit and publication. No manufacturer equivalence is inferred. Inventory-preferred mode retains the established DMC fallback.

Local saved provenance retains the full ordered candidate palette. A project package whose provenance contains `palette.catalogue` instead retains only candidate references present in its exported revision palette/recipes, preserves attribution/digest, omits fixed/excluded/preference indices and records that exact regeneration needs the original catalogue and settings. It never exports the catalogue collection/local catalogue IDs. This applies to all versioned catalogues, including the bundled DMC version selected in the UI. Legacy provenance without `catalogue` and the existing DMC/inventory fallback keep their previous projection. Saved stitch geometry remains authoritative after import.

## Input/output limits and contracts

| Surface | Implemented boundary |
| --- | --- |
| Source image | PNG/JPEG/WebP/GIF; managed file up to 25 MiB; decoded area at most 40 million pixels and side at most 20,000. Animated containers have additional frame/work limits. |
| Output grid | Integer width/height 1–500; byte buffer exactly width × height × 4. |
| Palette | 1–6000 input candidates; duplicate compound identities rejected; up to 80 revision colours. |
| Modes | Detail up to 80, balanced up to 40, simple up to 16; fewer colours can result. |
| Generation settings | Count 6–40; whole strands 1–6; cleanup threshold 0–30; waste 0–100%. |
| Geometry | Empty cell -1; palette-index full cells; separate half-stitch/backstitch collections. Editor validates their coordinates and identities. |
| Job lifecycle | Worker message carries a job ID; only the active response is accepted. Cancellation terminates the worker; UI timeout is 120 seconds. No fabricated percentage progress is emitted. |
| Persistence | The source image and initial pattern save atomically only when Save is confirmed. Cancelled generation/preview does not leave a saved pattern or new orphan source. |

The 500 × 500 maximum is an accepted input bound, not a claim that every maximum-size image/6000-colour combination meets an interactive latency target. Core CIELAB clustering remains CPU work. Large or difficult cases may require a smaller grid/palette and a new preview.

Generation returns a validated revision with colours, symbols, strand settings, cells and provenance. Provenance records engine name/version (`0.1.0+ricamo.2`), adapter version 2 for the unchanged default path (version `0.1.0+ricamo.3`, adapter 3 when advanced composition/colour restrictions apply; `0.1.0+ricamo.4`, adapter 4 for border-background removal), original hash, algorithm and iteration count, normalized settings, effective colour cap, palette RGB/code/brand snapshots, preference rule, cleanup count/protection policy, source metadata and alpha policy. Retaining this receipt makes later comparison possible; it does not itself prove a colourimetric match to real thread.

The legacy Stitch Studio v1 importer accepts supported full-cross JSON only and rejects unsupported primitive collections instead of flattening them. Native Ricamo patterns preserve the supported editable revision. PDFs/images imported as references stay documents. See [DATA-FORMATS.md](DATA-FORMATS.md) rather than treating generation output as a complete project backup.

## Colours, consumption and licences

The bundled 489-entry DMC RGB snapshot is an independent approximate compilation from MakeBead, under CC BY 4.0. The initial integration hash recorded in THIRD-PARTY-NOTICES is `945ea492f930959edac79cf81b7b4363930a7cf9cfa1c43705f328edbc466aed`. It is not an official exhaustive DMC catalogue. The original source also exposes an approximate Anchor subset derived from DMC pairings; that is not a manufacturer-certified interchange table or a promise that the main UI offers it as a catalogue.

The engine is MIT licensed. The copied code, colour attribution and packaged dependencies retain their notices. Importing artwork does not obtain rights to redistribute it. See [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

The original `consumption` helper estimates length using stitch pitch, a geometric factor, waste and start/end allowance, then assumes a package/strand structure when returning skeins. Ricamo does not use this as an authority to debit stock or impose an eight-metre/six-strand conversion. Project estimates use explicit fabric density, primitive type, real component strands, editable assumptions and known package/unit conversions. Unsupported conversions remain unknown. Confirmed consumption is a separate user action; measured calibration has its own eligibility checks and history.

## Verification and future changes

The source snapshot includes CIELAB reference checks, transparency/empty-image cases, cleanup, consumption scaling and malformed-grid tests. Their presence was inspected; this document does not claim the original Vitest suite was rerun under its original lockfile.

Ricamo adds executable regressions in `tests/engine.test.mjs`, `tests/generator-tools.test.mjs`, `tests/generator-scale.test.mjs`, `tests/generator-options.test.mjs`, `tests/generator-palette.test.mjs`, `tests/background-removal.test.mjs`, `tests/thread-catalogues.test.mjs`, `tests/pattern-import.test.mjs` and `tests/atomic-pattern.test.mjs`. They cover actual adapter/worker behavior, limits, transparency, inventory mapping, protected cleanup, 5000 held colours, native identities and atomic source persistence. Browser/native journeys additionally exercise canvas preparation, real worker generation, save/reopen and PDF outputs. The `desktop-background-center.mjs` journey additionally checks enclosed white retention, original bytes, SQLite reopen and 40→1→40 removal-preview refresh. Catalogue journeys separately exercise import confirmation, immutable versions, selection and substitution. Current pass counts and exact build identities belong in STATUS, not a timeless claim here.

Selected Windows packaged generation and PDF journeys were observed on the development Windows 10 host. They do not certify a clean Windows 11 installation or later untested packages. No blanket image-quality guarantee, all-printer guarantee or universal maximum-workload timing is supported.

For any algorithm, alpha, palette preference or preprocessing change: preserve the original snapshot identity; increment the relevant engine/adapter provenance version; add a fixture that distinguishes old/new behavior; inspect a real rendered result; validate cancellation and persistence; and retain old saved revisions. Roll back code through a known source/build revision and restore only compatible backups when required. Never regenerate existing revisions silently as a migration or rollback.

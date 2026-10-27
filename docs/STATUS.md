# Ricamo delivery evidence

## Commercial references, fabric and printing 0.5.0 — 2026-10-27

Rui selected importing the owned original PDF/image, managing materials and printing, rather than adding quarter-stitch/bead drawing primitives. The original reference remains byte-for-byte preserved. No Nightingale chart was downloaded or reconstructed from the shop cover; its material/specification preset contains public product facts only.

The generator now starts in detailed mode, with cleanup off, a 500-colour limit and the 488-colour DMC Mouliné subset whose purchase targets were verified. The earlier bundled catalogue remains available. Missing DMC776 is not silently replaced by 3326. Existing licensed RGB values remain digital approximations, separate from retail identities. The original external Stitch Studio source is unchanged; the integrated copy has documented nearest-colour/detail and bounded initialization adaptations. A 300 × 300 synthetic full-palette benchmark took approximately 1.5–1.8 seconds and used 487 colours, not a universal timing guarantee.

Fabric type, brand/range/code, colour, weave count and over-one/over-two geometry are available in generation and saved scheme details. Centimetres are primary; integer grid rounding is shown. New projects inherit an explicit saved scheme fabric before the original generation fabric, without replacing explicit project choices. Required material lists preserve codes, units and unknown quantities; adding them to a project does not create stock or movements and retains existing manual needs. The Nightingale preset records 230 × 190, 32 ct linen over 2, 36.5125 × 30.1625 cm and 35 material requirements, including the official 10101 one-pack correction.

The offline catalogue contains 448 fabric/support records, 911 material references and 58 category links. Patchwork, feltro and Grigoletto are excluded. The material snapshot covers 506 DMC Mouliné, 226 Caron Waterlilies, 173 Kreinik #4 and 6 Mill Hill references. 36 fabric category bodies were unavailable: the local product list is explicitly partial, with verified category links for browsing the current site. No price, stock, measured RGB or universal purchase availability is claimed. Direct purchase links are explicit clicks through an HTTPS Casa Cenina host allowlist; no automatic shop requests or purchases occur. See [source inventory](CASA-CENINA-SOURCES.md).

Custom sliders preserve keyboard input, while protected areas can be drawn over image details. The generator and export dialog offer colour-with-symbols and white-with-black-symbols previews. The full reading PDF includes page maps, overlapping grid tiles, legends, fabric/cm metadata and verified purchase links, including threads used only by a blend's backstitch recipe. Direct printing uses the complete PDF, independently of the visible viewport. Imported references offer all/current pages, original/A4/Letter dimensions, colour/grayscale, rotation and optional annotations/notes. Printing is bounded at 200 pages, 64 MB and 128 million retained pixels, adaptively 96–144 dpi; oversized documents retain PDF export. Cancellation/failure removes the temporary print surface.

Verification before packaging: 460/460 tests passed. Eight catalogue tests additionally passed after reserving the new built-in catalogue ID. Independent integration review reproduced and resolved fabric-inheritance and backstitch-only purchase-link defects; seven targeted regressions passed, including actual PDF annotation readback. Native Windows development-runtime evidence: generator fidelity `.runtime/generator-fidelity-WumJsN/result.json` (437 persisted colours, every product linked, 32 ct over 2 / cm, slider keyboard, drag protection, nonblank white overview, original bytes and SQLite reload), options `.runtime/generator-options-qPlvD4/result.json`, material/purchase/chart journey `.runtime/retailer-supplies-CANvzG/result.json`, and printing `.runtime/print-document-ih0IHI/result.json`. Printing evidence includes real 75-page Chromium print-to-PDF output, mixed Letter/A3 sizes, grayscale pixels, rotated dimensions/notes, cancellation and failure cleanup. Native renderer sandbox checks passed; tested journeys recorded no page errors or HTTP requests. The final two-column export preview was visually inspected.

Release packaging and exact packaged-runtime checks are recorded below when complete. Physical printer output, interaction with a real printer selection dialog, a clean second PC and this version's installer lifecycle have not been tested. Native tests intercept the printer submission callback and verify actual Chromium print-to-PDF output; they do not send physical print jobs.

## Interface patch 0.4.1 — 2026-10-27

Rui requested corrected content padding, customised dropdown menus, chevrons and consistent motion. Locations and Shopping now use the existing responsive page container. Shared picker panels use the app palette, rounded surfaces and selected/hover states, with preserved native keyboard/validation semantics. Navigation, pagination, transfers and disclosures use Lucide chevrons; drawing tools and keyboard direction keys retain their meaning. Routes, menus, search, dialog entrance/backdrops, disclosures, notifications and interactive states have bounded transitions. Reduced motion covers pseudo-elements too; forced colours preserve option focus/selection outlines.

Installer: `release/0.4.1/Ricamo-0.4.1-Windows-x64-Setup.exe` (148,008,829 bytes), SHA-256 `d595d09c3db41aa166d11dfdf9e2233944f5c4bf99d7676f1d60446e4f6c1a6e`. It is built separately from the earlier 0.4.0 distribution so an open user window is not replaced. The exact content audit passed; manifest and checksums are in `release/Ricamo-0.4.1-release-manifest.json` and `release/Ricamo-0.4.1-SHA256SUMS.txt`.

Verification: production build and **438/438 existing tests passed**. Five native Windows journeys passed on this exact 0.4.1 executable: UI polish, desktop persistence smoke/reopen, draft recovery/navigation, material descriptors and planning. The suite record is `.runtime/ui-041-suite.json`; detailed UI screenshots/results are `.runtime/ui-polish-qQYJ0P`. It covers pointer selection, keyboard Home/End/Enter, Escape cancellation, a picker above a modal, saved parent/child locations, four widths (1440/1024/800/560 CSS pixels), disclosure controls and reduced motion. The test caught an initially missed picker-icon reduced-motion override; the correction passed. Development runs also corrected test-launch path quoting and two test locator names. Current native evidence records an enabled OS renderer sandbox, no page errors and no HTTP requests.

The 0.4.1 installer lifecycle, broad 28-journey suite, performance benchmark, clean-machine and physical-printer checks were not repeated for this UI patch. Their 0.4.0 results below remain historical, not a claim of repeat verification. No data migration or dependency upgrade is included. The application remains unsigned. Design and source review were performed by the implementing agent for this patch; there was no independent patch review.

The updated preview is opened separately with `.runtime/user-ui-preview-data`; prior preview profiles are preserved and are not silently merged or replaced. Its launch record is `.runtime/user-ui-preview-launch.json`.

See ARCHITECTURE for shared control/motion ownership and README for installation. Personal data and generated test/build files remain excluded from Git. The requested one-file-per-commit, immediate-push policy continues.

## Previous 0.4.0 baseline

## Scope and identity

The six-hour mission began on 2026-10-27 at 08:53 UTC, with a requested window through approximately 14:53 UTC. Rui subsequently asked to finish the five advanced functions and to open a test window. The five functions are implemented and verified on the exact Windows candidate described here. This is not certification of every environment or every acceptance scenario.

Repository: `main`, https://github.com/ruiouteiro2/ricamo.git. Local author: RuiOuteiro2. Each changed repository file is committed alone and immediately pushed. Product integration reached `da7b634`; later test/document commits do not change the packaged core/desktop/dist. The generated release manifest records the final Git identity and dirty state.

Host actually used: Windows 10 Home x64 build 19045, AMD Ryzen 5 5600H, 16 GB RAM; WSL for source/build/domain work. Development Node is 24.22.1. The packaged Electron 45 runtime reports embedded Node 24.22.0 and Chromium 156.0.8078.48. A user does not need a separate Node/Python/WebView2 installation.

## Installer and transfer

- Installer: `release/Ricamo-0.4.0-Windows-x64-Setup.exe`, 148,006,773 bytes.
- Installer SHA-256: `a73afa857fde4d03bf28bfc9aaef50d4b15d2d7f49ec82f63bb89f9ad7529c34`.
- Packaged ASAR SHA-256: `fcd8ea523086b8d78dd34c395d8b8c26b9b27b6fe241e1dcdc2ce7a4266a1479`.
- Executable SHA-256: `fc327964fdd72921383e43fa40435c8b2d34696e7499ca22bbe3433d6c2702ff`.
- Machine-readable inventory: `release/Ricamo-0.4.0-release-manifest.json`; companion `Ricamo-0.4.0-SHA256SUMS.txt`.

Copy the single setup EXE to the other Windows x64 PC, run it, choose the installation folder and open Ricamo from the Start menu. The installer is unsigned. Actual clean Windows 11 installation, a second PC and an OS-blocked-network installation remain untested.

To transfer a complete library, use **Settings → Create a backup**, copy the `.ricamobackup` file, then use **Restore a backup** on the destination and review before replacing data. Originals are included in the full backup. A project package deliberately excludes physical stock and is not a full-library transfer. Keep a compatible backup and previous installer for rollback; never overwrite a running SQLite database or delete its WAL as a recovery shortcut.

The earlier 0.3 installer passed 24 functional Windows journeys but failed the content audit because a negative-only platform file matcher admitted extra cache/test files. It was isolated under `.runtime/rejected-distribution-030` and is not a delivery artifact. The common explicit allowlist was repaired. The 0.4 audit passed: only intended application roots, exact core/desktop/dist identities, 51 runtime packages, 74 notices and the Windows native Canvas dependency. `npm run package:win` now includes this audit after building.

## Completed functionality

Ricamo provides inventory identities/lots/movements, reservations and explicit consumption, partial stocktakes, location hierarchy, purchases/partial receipts, tools/loans/maintenance, kits, project planning/costs/checklists/sessions/progress, immutable revisions/drafts, full/half/backstitch editing, references and annotations, Unicode PDF/labels, CSV/TSV/JSON exports, local backups and IT/EN help.

The five advanced additions are:

1. Immutable local thread-catalogue versions, reviewed import/export, attributed version selection and approximate stock-aware substitution with explicit draft confirmation.
2. Border-connected colour removal with tolerance and preview, preserving enclosed white stitches and original image bytes.
3. Drawing-mode coordinate navigation and an optional geometric centre guide, without adding stitches or export marks.
4. Revision-impact review for thread/material needs, commitments, dimensions/printing and progress; optional migration requires unique matching coordinates, recipes, identities and strands. Stale reviews reject and old execution history remains.
5. Measured fabric outlines/defects, overlap-safe useful area, reservation/collision checks, actual placement suggestions, PDF reports and geometry-preserving remnants/cost receipts.

These additions do not turn progress into consumption or catalogues into owned stock. Unknown values remain different from zero. Background removal is a deterministic colour mask, not semantic subject extraction. Automatic physical cutting of irregular outlines remains manual; placement search is bounded and an unsuccessful search does not prove impossibility. Catalogue colour matching is approximate.

Project packages with `provenance.palette.catalogue` carry only used palette/recipe references and explicit regeneration limitations, including the bundled DMC version selected in the UI. Complete catalogues/settings remain in local state and full backups. Legacy unversioned provenance and the DMC/inventory fallback keep their previous contract.

The actual supplied Stitch Studio engine is reused inside a worker, with documented adapters and bounded 500×500/80-colour operation. The original directory was not modified. Its `src/engine.ts` SHA-256 was reconfirmed as `7eb63a9d4c5915249b638fa6bd1ee35cff1e6f2e3982d8a6ca60b78279fe6052`. See ENGINE-AUDIT for algorithm, attribution and provenance versions.

## Verification of this candidate

- **438/438 integrated Node tests**, normal production build and diff checks passed. Final domain log: `/tmp/ricamo-mission/root-040-unit.log`.
- **28 distinct Windows native journeys passed**, recorded in `.runtime/windows-040-final-results.json`. The initial run passed 27; the work-companion test still looked for the replaced confirmation checkbox. It was updated to exercise the new impact review and passed separately. Original failure and retry logs are retained; the product artifact was unchanged.
- Advanced Windows runs: `background-center-0ClMQK`, `fabric-geometry-CTfV4P`, `thread-catalogues-deOOAo`, `revision-impact-DIjAQt`, each under `.runtime` with result evidence. They exercise real controls, worker output, saved originals, process restart and authoritative SQLite readback.
- Actual installed **0.2→0.4 update**, UI edit/reopen, **same-version 0.4 reinstall**, and **uninstall** passed in `.runtime/installed-upgrade-proof-040`. All state/original bytes remained correct. Reinstall retained shortcuts; uninstall removed the tested app, registry entry and shortcuts while preserving its synthetic profile. The installed ASAR matched the release hash. Historical 0.1→0.2 and 0.2→0.3 evidence is retained separately.
- Actual same-profile **second instance** exited successfully, restored the existing window and left SQLite unchanged: `.runtime/instance-lock-RRKr3q`.
- Actual Windows display smoke at system 125% and forced **150%** passed, including restart and initial-window bounds: `.runtime/desktop-smoke-F3wMIX` and `desktop-smoke-JfVb9p`. At 150%, bounds 1216×626 fit work area 1280×687.
- Current runners explicitly request `chromiumSandbox:true`; Windows metrics observed the renderer OS sandbox enabled, with context isolation and no Node integration. The root Linux removal/centre run additionally checked Seccomp 2/NoNewPrivs 1. Older Linux journeys before this harness correction are functional evidence only: Playwright's default had disabled the OS sandbox. Historical wording must not be read as OS-sandbox proof.
- Tested renderer journeys and benchmark observed no external HTTP requests or page errors. This is narrower than physically disabling OS networking for every scenario.

Independent reviews found and verified fixes for anonymous progress identities, catalogue restore canonicality/reserved IDs, the image-preview dimension watcher, concave empty fabric regions, legacy-cut bypass and numeric margin types. Fabric review independently checked 3,200 placements and 40 area-conservation cases. An integration-only legacy-import error was caught by the existing engine test and corrected. No findings remained open in those bounded reviews; this is not a universal bug-free/security claim.

## Measured performance

Exact Windows candidate: `.runtime/performance-1Cyds6/result.json`. Fixture: 5,000 materials and lots, 20,000 movements, 50 projects, 51 attachments, 500×500 grid. All eight scenario groups passed, with persisted readback, no recorded errors/HTTP and measured OS sandbox enabled.

| Operation | Observed time |
| --- | --- |
| First process / two subsequent starts | 2.116 / 1.845 / 1.810 s |
| Inventory search / filter p95, 20 measured samples each | 32.1 / 66.1 ms |
| Progress with persistence | 1.905 s |
| Large editor / PDF export | 0.852 / 0.484 s |
| Real 500×500 worker to preview / save | 0.925 / 2.214 s |
| Full backup snapshot / validation | 2.289 / 0.488 s |

The maximum sampled sum of process working sets was 1,731 MiB across 94 samples, not a true peak. These are development-host observations, not cold-machine or minimum-hardware guarantees. Rui's separate preview could remain open; no build, publisher or other benchmark was run concurrently. Earlier 0.2 timings are retained but are not used to claim an improvement percentage.

A separate Node/Linux limit test combined the representative fixture with 20,000 catalogue colours in four versions. Three paired samples preserved SQLite/backup integrity: median full validation 409 ms, command+commit 762 ms and backup 834 ms. Whole-harness high-water RSS 640 MiB includes multiple fixtures/states, not desktop-app peak memory. Evidence: `/tmp/ricamo-mission/catalogue-limit-performance/REPORT.md`.

## Remaining limits and the interactive preview

Unavailable checks include clean Windows 11/offline installation, a separate accented Windows user account, second PC/USB transfer, an actual 8 GB machine, physical printers, complete assistive-technology/linguistic review and all possible files or failure combinations. No signing certificate is configured. The 111 functional requirements and 67 acceptance cases remain individually qualified in REQUIREMENTS; passing counts do not turn every IV/B row into approval.

At Rui's request, a stable Windows preview was opened at 14:08 UTC with separate data under `.runtime/user-preview-data`; its source snapshot is `.runtime/user-preview-source`. Automatic tests never use that profile. That early preview does not silently receive later catalogue/revision changes and review fixes. Its data is preserved; use its backup control if any experimental records should be moved to the final application.

The final audited 0.4 application was also opened at 14:45 UTC from `release/win-unpacked/Ricamo.exe`, PID 4152 at launch, using a fresh separate `.runtime/user-final-preview-data` profile. The earlier window was not closed or overwritten. The native launch record is `.runtime/user-final-preview-launch.json`. Close this final preview normally before rebuilding the same release directory.

Code and build instructions are in README; user guides are USER-GUIDE-IT and USER-GUIDE-EN. Build from the lockfile on Windows with Node 24: `npm ci`, `npm test`, `npm run package:win`. Generated installers, runtime profiles and test artifacts stay out of Git.

Available vt-deliver/design/verify guidance was used. The installed vt-app-test and engineering-loop entrypoints lacked required support references, so this work does not claim full unavailable-library protocol conformance. Authorized independent agents worked in scratch copies; root integrated and published one file at a time.

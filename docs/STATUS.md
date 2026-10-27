# Ricamo implementation record

## Mission and authority

The requested six-hour work window is 2026-10-27 08:53–14:53 UTC. Build an offline Windows embroidery application from Rui's master prompt, reuse the actual Stitch Studio engine, and verify inventory, planning, execution, recovery and distribution. Rui authorizes implementation and GitHub pushes, with exactly one changed file per commit and an immediate push. Root serializes repository writes and Git; authorized agents prepare isolated drafts only.

Repository: main at https://github.com/ruiouteiro2/ricamo.git; author RuiOuteiro2. Host: Windows 10 Home x64 build 19045 with WSL; Node 24.22.1 on both systems. Windows Sandbox is unavailable. Tests in a clean Windows 11 environment remain unavailable and are not replaced by local-host evidence.

## Current evidence — approximately 10:40 UTC

The mission is ongoing. Source integration is ahead of the last packaged Windows artifact; later features require package revalidation.

- Actual Windows x64 offline NSIS installer built and installed into a test path containing spaces and an accent. Installed and unpacked executables created material code 001 with quantity 1.5, closed and reopened the SQLite data correctly. Renderer HTTP requests: zero in those journeys. This does not prove a clean PC, a separate accented Windows profile or blocked operating-system networking.
- Actual Windows packaged runtime imported/rendered a two-page PDF, retained page 2 annotations/view, exported a PDF, generated 7,500 cells with 622 transparent empty cells, wrote local/external backups, and retained the local backup with an actionable failure when the external directory was unavailable. Native destination selection was automated; storage, renderer, worker and file writes were real.
- Actual Electron Linux window-close test requested closure 29 ms after a note edit. The pending draft was flushed; reopening recovered it while the published revision remained unchanged. An acknowledged draft also survived immediate process exit. Windows draft-close verification is still pending on a newer package.
- Browser inventory journeys passed custom categories/fields, locale switching without losing user text, atomic batch editing, rapid entry with explicit duplicates/unknowns, saved filters, and real PDF labels. Ten integrated tool journeys passed loans, returns, loss reconciliation and the home reminder; nine fabric journeys passed region reservations, overlap rejection, physical cuts, waste/cost conservation, guarded reversal and persisted readback.
- 157 Node tests passed after the project-package integration, covering domain invariants, real engine/worker, SQLite, backups, PDF references, image preflight, drafts, tools and date/unknown-quantity cases. The full count is expected to change as new slices are integrated; inspect current test output for the latest run.
- A reproduced image-import bug retained an orphan attachment after cancellation. The new regression failed before the fix and passed after original-image persistence was deferred until Save. PNG/JPEG/GIF/WebP containers and dimensions are bounded before browser decoding; this is preflight, not a claim that every malformed compressed payload is detected.
- Independent security review reproduced seven issues: arbitrary local-file renderer access, restore-preview race, future-schema writes, malformed restored shapes, dangling attachments, scalar buffer allocation and inherited command dispatch. Repairs have maintained regressions. Actual Electron file sentinels and wrong-frame IPC tests passed; no blanket security claim.
- First representative production Electron Linux performance baseline: 5,000 materials/lots, 20,000 movements, 50 projects, 51 managed assets and small/500×500 patterns. Startup 3.33 s; inventory first navigation 248 ms and warm navigation 116–133 ms. Project list 2.0–2.5 s is being profiled and repaired. These are preliminary observations on this host, not final Windows performance certification.

## Implemented areas

Catalogue/physical-lot separation; explicit stock movements, transfers, reservations and reversals; custom categories; batch/rapid entry; named filters; location hierarchy; suppliers/partial purchases; fabric measurements, regions, cutting and remnants; kit decomposition; project status/checklists/sessions/progress; immutable revisions and durable drafts; full/half/backstitch editing; real worker generation; PDF/PNG/native pattern export; PDF/image references with annotations; local help/search; CSV preview/round-trip; complete backup/restore and configurable local/second-folder retention.

Tool loans/maintenance, conservative unknown-stock purchasing, local calendar-date handling and project packages are being integrated into the main source. Recipe-based thread mixtures/calibration, project finishing/forecasts/reports, generator preferences/motifs and final requirement traceability have isolated specialist drafts or active work. They are not all verified in the final installed package yet.

## Architecture and boundaries

Electron 45 bundles Chromium/Node; Vue 3 provides a new interface; SQLite WAL transactions store domain state and managed attachment BLOBs. The renderer has no Node access, uses a narrow preload API and restricted ricamo://app assets, and cannot navigate externally. CPU generation reuses the supplied TypeScript engine in a worker; the old interface was not copied. MakeBead's DMC RGB data is approximate and attributed.

Data starts empty. Synthetic test data stays in ignored runtime/scratch directories. No production data, external messaging or cloud deployment is involved. Full backups include working drafts; single-pattern exports use a saved revision. Project transfers exclude physical stock and require explicit catalogue decisions. Unknown measurements remain distinct from zero.

## Verification plan and remaining limits

Continue whole-product repair/convergence with a reconciled requirements ledger, real UI journeys, authoritative persistence readback, Windows package rebuild/update/uninstall tests, offline boundaries, keyboard/scale checks and measured representative workloads. The clean Windows 11/other-PC/runtime-absence scenarios require an environment that is not currently available. No code-signing certificate is configured.

The installed vt-app-test entrypoint was read in full, but its required support references (including safe-browser-and-mutation, coverage-and-execution, test-state-integrity, performance-and-efficiency and defect-convergence) are absent. Work uses the available guidance and the user's authorization; it does not claim full library protocol conformance. The engineering-loop entrypoint has the same missing-support limitation. Scoped vt-deliver/design/verify guidance and actual evidence remain applicable.

## Resume

Recheck current Git status, source changes, publication sessions and the goal clock before consequential work. Master prompt: C:\Users\Rui\Downloads\RICAMO_CODEX_MASTER_PROMPT.md. Original engine remains untouched in the supplied Documents/Stitch Studio folder. Scratch briefs and evidence live under /tmp/ricamo-mission; installed/native test records are under ignored .runtime. Each source/config/document change must still be committed alone and pushed before the next commit.

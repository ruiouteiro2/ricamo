# Ricamo implementation record

## Mission and authority

2026-10-27, 08:53–14:53 UTC: build and verify an offline Windows embroidery application from the supplied master prompt. Italian and English, integrated Stitch Studio engine, inventory, project planning and execution, backups, PDF, Windows installer. User authorizes implementation and GitHub pushes, one changed file per commit and immediate push. No unrelated project changes, cloud service deployment or production data access.

Initial revision: a6daa26, main, clean. Runtime: WSL Linux with Node 24.22.1 and Windows Node 24.22.1. Windows x64 is the distribution target. Windows clean VM availability remains unverified.

## Decisions

- Electron 45 (bundled Chromium/Node) avoids an external WebView runtime download. Vue 3 for a new interface. SQLite via bundled Node for transactional local persistence. CPU-only generation in a worker from the original TypeScript engine.
- Original engine: MIT, Rui 2026; DMC RGB compilation: MakeBead CC BY 4.0, approximate colours. Existing consumption assumptions are not inventory conversions. Original limit is 400×400 / 72 colours; any extension must have its own tests.
- New task-oriented visual system: warm paper surfaces, deep ink text, restrained aubergine actions, readable tables, progressive forms. No old CSS or interface components copied.
- Use vt-deliver and vt-design, followed by vt-verify/app testing. The installed engineering-loop entrypoint lacks its required reference resources; no claim of its full orchestration protocol. Independent bounded planning/review may use agents, authorized by the master prompt. Root serializes repository writes and all commits/pushes.
- Data starts empty. Example content, if provided, stays explicitly separate.

## Ordered work and evidence

1. Discovery: master prompt read; engine and licence inspected. Domain planning underway.
2. First vertical slice: desktop packaging, SQLite persistence and actual image generation. Pending.
3. Inventory: catalogue, lots, stock movements, reservations, locations, tools, fabrics, kits, purchases. Pending.
4. Projects, revision-aware pattern editor, progress, sessions, print/export. Pending.
5. IT/EN, local help, import/export, backup/restore, security and accessibility. Pending.
6. Real runtime journeys, performance data, Windows artifacts, traceability and handoff. Pending.

## Evidence limits

No product behaviour or installed Windows package has yet been verified. No claim of a complete application, clean-PC compatibility, digital signature or universal absence of bugs.

## Continuation

Inspect current Git state and this record. Read the user's full master prompt at its supplied Downloads path and source at its supplied Stitch Studio path when needed. Scratch execution briefs are in /tmp/ricamo-mission. Publish each source change through an individually reviewed one-file commit, followed immediately by push.

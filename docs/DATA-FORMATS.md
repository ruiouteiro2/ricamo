# Local data and export formats

Ricamo 0.2.0. These formats are local and versioned. CSV/TSV exports are tables for inspection and analysis; only the inventory table has an import workflow. JSON summaries are not substitutes for a complete backup.

## Storage and transactions

The installed application uses `ricamo.sqlite` in its Electron user-data directory. `application_state` holds one validated JSON snapshot and its optimistic revision; `assets` holds immutable managed file bytes by attachment ID. SQLite uses WAL, full synchronous durability, foreign-key enforcement and a busy timeout. A mutation is checked against the current revision and published in a transaction. An operation ID plus canonical command signature prevents a repeated request from silently duplicating stock; reusing an ID with different contents is rejected.

Material/project/session saves can stage up to 20 originals (100 MiB total, with existing per-file limits). Owner fields, an optional initial lot, file metadata and new BLOBs commit together. Cancel does not import staged files; failure rolls back the entire save. Shared originals are deduplicated by digest and retained.

The database schema is version 1. A database with a newer schema version is opened only for version inspection and refused for writes. Optional feature blocks have their own validation/version rules. Application version and database schema version are different concepts. Before attempting a downgrade, retain a full backup produced by the version that can read the current data.

The normal renderer is sandboxed and accesses a narrow preload API. The browser preview uses IndexedDB and is not the installed SQLite product. The optional native example has a separate persistent Chromium session and its own IndexedDB database, with no access to the normal Repository. Its data is excluded from normal-library backups.

Quantities use at most six decimal places. Codes, ISBNs and other references are strings. Unknown quantities and unknown costs are `null`, while zero is a known zero. Dates without times are local calendar dates. Monetary integers represent hundredths of the declared currency; currencies are never combined through an assumed exchange rate.

## Complete backup: `.ricamobackup`

The outer UTF-8 JSON object has:

```
format: "ricamo-backup"
version: 1
appVersion: producing application version
createdAt: ISO timestamp
sha256: SHA-256 of UTF-8 bytes of payload
payload: JSON encoded as a string
```

Parsing `payload` produces `{state, assets}`. Each asset has its ID and base64 bytes; its metadata, MIME type, byte length and digest are in `state.attachments`. Inspection validates the domain snapshot, all references, asset count, content digests and supported file types before restore. The outer file and payload are each bounded to 256 MiB. Base64 and JSON overhead count toward this limit.

SHA-256 detects a mismatch between a payload and its stored digest. It is not encryption or a digital signature. A normal JSON/base64 reader can recover the data without running Ricamo: parse the outer object, verify the payload digest, parse the payload, then decode each asset. Keep IDs when relating metadata and files.

Restore replaces the normal library after review and preserves a backup of the previous state first. It does not merge two physical inventories. Full backup contains drafts and imported file bytes; copied original external files are not required after a successful managed import.

## Project package: `.ricamoproject`

The versioned package contains a manifest, integrity digest and a bounded project snapshot with selected assets. It includes required pattern revisions, palette references/whole-filament recipes, selected sessions and progress history, explicit mechanical planning settings and selected personal notes. Generation provenance is whitelisted; unrelated catalogue IDs, file paths and hidden arbitrary source properties are not copied into mechanical blocks.

Import reviews catalogue matches and remaps project, material, pattern, revision and attachment IDs. It creates catalogue references without creating physical stock, reservations, purchases or stock movements. A transferred fabric description must be reconciled with a locally owned piece. Re-export retains that reference even when no local fabric lot has been selected.

Bookmarks and parked threads are optional package content. Selecting them includes their immutable historical pattern revisions, independently of general progress history. Notes still require private-note consent. Legacy markers without an assigned revision are reported as local omissions and excluded. Import remaps pattern/revision references and preserves palette index zero; viewport position is never transferred.

Starting a new-work copy clears prior progress, markers, finishing/delivery state and manual remaining counts. Manual rates and weekly availability remain assumptions to review. A measured session retains its original revision association; it does not become evidence for work on a different revision. Referenced historical revisions can therefore be included even when general progress history is omitted.

Project metadata is bounded to 8 MiB of UTF-8, with separately bounded managed assets. Selected original PDFs/images retain their original file contents, including any metadata already present in those files.

## Standalone pattern: `.ricamopattern`

UTF-8 JSON with `format: "ricamo-pattern"`, `version: 1`, pattern name and a saved structured revision. It preserves grid geometry, palette and supported stitch types. Export uses the published revision, not an unpublished working draft. It does not carry the complete inventory or managed original image/PDF bytes.

Standalone imports detach foreign inventory IDs, including IDs in blend components. Material identity can be reviewed locally; matching a brand/range/code never creates physical stock. Use a project package when transferring selected original files, measured project history or project-specific data.

## Open data: CSV, TSV and JSON

Settings offers inventory, movement history, purchases and project summaries. Exports are read-only snapshots, include recorded names/notes, and do not include attachment bytes. Use a full backup for restoration.

CSV uses semicolon in Italian and comma in English. TSV uses tab. Text is UTF-8 with BOM and CRLF rows; fields are quoted, with doubled embedded quotes. Decimal quantities follow the selected language. References such as `001` stay text in the file; when opening in a spreadsheet, import reference columns as text to retain their formatting.

Potential spreadsheet formulas and leading apostrophes receive one protective apostrophe. The `__ricamo_escape=apostrophe-v1` column declares this transformation. The inventory importer reverses exactly that declared prefix. JSON keeps the canonical string unchanged.

- Inventory CSV/TSV uses the inventory-import contract. A row is a material/lot pair; `__has_stock` distinguishes a catalogue-only row from an unknown-quantity physical lot. Inventory `cost` is expressed in ordinary units of `currency`. Versioned native descriptors and custom properties round-trip through bounded material/lot properties JSON; mapped descriptive columns take precedence as shown in the preview. Rows with conflicting metadata for one new catalogue reference must be corrected before import.
- Movement tables retain IDs, dates, kinds, before/after quantities, units, project links, correction/transfer/purchase/kit references and recorded confidence. `not_recorded` means the historical movement did not contain a confidence value; today's lot label is not substituted. `costHundredths=125` means 1.25 units of the accompanying currency.
- Purchase tables retain ordered and received quantities, status, project/supplier references, `unitPriceHundredths` and receipt details. Pending orders do not become physical stock in an export.
- Project tables distinguish manual progress from counted structured work and expose the counted denominator and each supported stitch type. They include recorded sessions/minutes, budget, known consumed costs by currency and the count of consumed movements whose costs remain unknown. Reservations retain their units. Associated unallocated kit costs remain separate from consumed costs.

Arrays and objects are JSON text inside delimited cells. Empty nullable numeric fields mean unknown, not zero. A project without a structured pattern has `null` counted totals; its manual percentage is not an inferred number of stitches.

JSON uses this envelope:

```
format: "ricamo-open-data"
version: 1
dataset: "inventory" | "movements" | "purchases" | "projects"
createdAt: ISO timestamp
language: "it" | "en"
moneyScale: 100
notesIncluded: true
attachmentsIncluded: false
data: dataset contents
```

Inventory JSON contains the canonical `materials`, `lots`, `locations` and `suppliers` arrays, including technical/custom properties and string identifiers. Other datasets contain their documented summary rows. JSON retains numeric types, booleans, arrays and explicit nulls. A row's currency applies only to the corresponding monetary values; per-currency maps preserve separate totals.

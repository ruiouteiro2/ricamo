# Local data and export formats

Ricamo 0.4.0. These formats are local and versioned. CSV/TSV exports are tables for inspection and analysis; only the inventory table has an import workflow. JSON summaries are not substitutes for a complete backup.

## Storage and transactions

The installed application uses `ricamo.sqlite` in its Electron user-data directory. `application_state` holds one validated JSON snapshot and its optimistic revision; `assets` holds immutable managed file bytes by attachment ID. SQLite uses WAL, full synchronous durability, foreign-key enforcement and a busy timeout. A mutation is checked against the current revision and published in a transaction. An operation ID plus canonical command signature prevents a repeated request from silently duplicating stock; reusing an ID with different contents is rejected.

Material/project/session saves can stage up to 20 originals (100 MiB total, with existing per-file limits). Owner fields, an optional initial lot, file metadata and new BLOBs commit together. Cancel does not import staged files; failure rolls back the entire save. Shared originals are deduplicated by digest and retained.

Purchases, receipt records and locations can also reference managed originals through optional `attachments` arrays. `purchase.attach`, `receipt.attach` and `location.attach` accept only the owner ID and attachment IDs, append unique references and retain at most 100 per owner. Staged originals use the same atomic owner/metadata/BLOB boundary. Adding documents does not change received quantities, recorded costs, stock movements or historical event contents. Old records without attachment arrays remain valid. A file may be shared by several owners; its digest identifies the original bytes, not a document category.

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

## Measured fabric geometry and revision-change review

A fabric lot may contain `properties.geometry` version 1 with `frameWidthCm`, `frameHeightCm`, `offsetXCm`, `offsetYCm`, `complete`, `outline` and `defects`. The outline is null or a shape; defects contain at most 16 shapes. Rectangles are `{type:"rect", xCm, yCm, widthCm, heightCm}`; polygons are `{type:"polygon", points:[{xCm,yCm}]}` with 3–24 ordered vertices. Coordinates are centimetres, finite/nonnegative, at most 30000 and six fractional decimals. Degenerate/self-intersecting shapes, extra hidden fields and coordinates beyond the measured frame reject. The piece window must stay inside that frame.

Rectangular cut descendants retain the original shapes and frame, changing only the bounded offset/window. Full backups and transfers preserve this geometry, including cut receipts needed for guarded reversal. Mechanical project-package fabric descriptions preserve the block without private descriptive notes. Legacy defect notes are represented as incomplete mapping where dimensions are known, so omitting private text does not turn uncertainty into a fully usable piece. A known fully unusable-border flag remains explicit. Area/available-area values are derived, not physical stock debits. Old lots without geometry remain valid.

A reviewed project revision change may include `revisionReview:{stateRevision,patternId,revisionId,carryProgress}`. These identities refer to the state and old pin being reviewed. The authoritative command rejects stale reviews and recomputes any requested unique correspondence. It archives prior completed keys and uses the existing versioned work-marker/estimate history rules; it does not transfer viewport state or infer manual progress. Recipe checks require a nonblank reference or an existing thread-material binding, primitive geometry/type/direction and whole-filament agreement. Replay uses the normal operation signature. No new database schema version is implied.

## Imported thread catalogues

Local JSON uses `{format:"ricamo-thread-catalogue", schemaVersion:1, catalogue:{name,version,source,license,colors}}`. Each colour has string `brand`, `range`, `code`, `name` and six-digit `hex`; range may be empty. Brand/range/code tuples must be unique in a version. The source and licence/conditions are user declarations, not a verification that redistribution is permitted. Import requires explicit confirmation and never creates materials/lots or physical stock.

Limits are 5 MiB per file, 6000 colours per version, 20 local imported versions and 20000 imported colours total. Optional `state.threadCatalogues` records immutable versions with local ID, creation time and SHA-256 of canonical normalized data. A repeated identical name/version/digest is harmless; different contents under that name/version are refused. Full backup retains this collection; old state with no collection remains valid. Export/template use the local JSON envelope, without inventory quantities.

Saved palette entries can hold `catalogueRef:{name,version,source,license,digest}`; generation provenance may hold the same attribution as `palette.catalogue`. Those are immutable attribution records, not a foreign-key dependency on a live catalogue ID. Importing a replacement version does not alter saved patterns. The package projection below distinguishes keeping these references from transferring the catalogue collection.

## Local bibliographic links and import reports

Patterns and projects may contain `catalogueReferences: [{materialId, pages}]`. Each owner allows up to 50 unique titles; `pages` is a string up to 500 characters, with an empty string meaning unspecified pages. The material must exist in category `reference`, but no owned lot is required. Archived titles remain readable. Full backups preserve these links and their catalogue targets; older state without the optional field remains valid.

The PDF/image batch importer records a separate version-1 recovery report in renderer localStorage under a studio-specific `ricamo:reference-import-report` key. This report is **outside the database backup and project package**. It contains up to 20 rows: stable pattern/operation IDs, display filename/title, size, digest, status/error, duplicate decision and attempted flag. It does not contain original file bytes or source paths. On reopen, stored status is reconciled against current pattern/attachment IDs and digests; unconfirmed results are not declared successful. Pending files must be reselected by matching name, size and digest. Clearing the report does not delete imported references.

Batch limits are 20 originals, 100 MiB total and 25 MiB per file. Each original plus its reference commits atomically, while the whole batch can finish partially. Stop waits for an in-flight transaction, retains completed items and leaves the remaining result explicit. The recovery report is operational UI state, not a portable import queue.

## Project package: `.ricamoproject`

The versioned package contains a manifest, integrity digest and a bounded project snapshot with selected assets. It includes required pattern revisions, palette references/whole-filament recipes, selected sessions and progress history, explicit mechanical planning settings and selected personal notes. Generation provenance is whitelisted; unrelated catalogue IDs and hidden arbitrary source properties are not copied into mechanical blocks. Original local filesystem paths are not added automatically. Explicit catalogue source/licence text remains attribution and is not redacted.

Imported thread-catalogue collections and local catalogue IDs are never included. For provenance containing `palette.catalogue`, the candidate list is filtered to references present in the exported palette/recipes. The retained catalogue attribution/digest still identifies the original version; it is not a digest of the reduced list. `fixedColors`, `excludedColors` and preference indices are omitted because their original ordering/context is no longer transferred. An explicit `catalogueProjection` records `{version:1, scope:"used-palette-colours", constraintsOmitted:true, requiresOriginalCatalogue:true, requiresOriginalGenerationSettings:true}`. Import does not pretend that this subset can reproduce the original quantization. This policy applies whenever provenance contains `palette.catalogue`: both imported versions and the bundled DMC version selected in the UI. Legacy provenance without this field and the existing DMC/inventory fallback retain their previous contract.

Local `catalogueReferences` links are always omitted from project packages, including when private notes are included. Import rejects injected link fields, even empty arrays, instead of binding foreign local IDs. Purchases, receipts, locations and their operational document-owner links are not transferred. Files attached only to those owners are not offered as project attachments; a shared original independently linked to an allowed project/material/session/pattern can still be selected explicitly. No document redaction is performed.

Import reviews catalogue matches and remaps project, material, pattern, revision and attachment IDs. It creates catalogue references without creating physical stock, reservations, purchases or stock movements. A transferred fabric description must be reconciled with a locally owned piece. Re-export retains that reference even when no local fabric lot has been selected.

Bookmarks and parked threads are optional package content. Selecting them includes their immutable historical pattern revisions, independently of general progress history. Notes still require private-note consent. Legacy markers without an assigned revision are reported as local omissions and excluded. Import remaps pattern/revision references and preserves palette index zero; viewport position is never transferred.

Starting a new-work copy clears prior progress, markers, finishing/delivery state and manual remaining counts. Manual rates and weekly availability remain assumptions to review. A measured session retains its original revision association; it does not become evidence for work on a different revision. Referenced historical revisions can therefore be included even when general progress history is omitted.

Project metadata is bounded to 8 MiB of UTF-8, with separately bounded managed assets. Selected original PDFs/images retain their original file contents, including any metadata already present in those files.

## Standalone pattern: `.ricamopattern`

UTF-8 JSON with `format: "ricamo-pattern"`, `version: 1`, pattern name and a saved structured revision. It preserves grid geometry, palette and supported stitch types. Export uses the published revision, not an unpublished working draft. It does not carry the complete inventory or managed original image/PDF bytes.

Standalone imports detach foreign inventory IDs, including IDs in blend components. Material identity can be reviewed locally; matching a brand/range/code never creates physical stock. Use a project package when transferring selected original files, measured project history or project-specific data.

## Generation settings and palette receipts

A structured revision keeps its output palette (at most 80 colours) separately from the ordered generation-candidate palette in `provenance.palette.colors` (at most 6000). `settings` and provenance parameters can record:

| Field | Meaning and boundary |
| --- | --- |
| `background` | Optional `{mode:"transparent"}`, `{mode:"white"}`, `{mode:"color",color:"#rrggbb"}` or `{mode:"remove",color:"#rrggbb",tolerance:0..80}`. Target colour is allowed only for colour/remove; tolerance only for remove. Absent/transparent keeps the alpha-below-128 rule; composition creates stitches in transparent areas. Remove masks matching four-connected edge regions on the resized grid, preserving enclosed regions and original bytes; it is not semantic segmentation. |
| `fixedColors` | Unique zero-based candidate-palette indices, at most 80, within the effective mode/colour/remaining-palette cap. Fixed unused entries remain in the output palette with zero stitches and zero estimated thread. |
| `excludedColors` | Unique candidate-palette indices, at most 6000, disjoint from fixed indices. Exclusions cannot remove the entire candidate palette. |

The indices refer to the full ordered candidate palette, not the resulting revision colours. Local saved revisions preserve that full list and validate index bounds, disjointness and the effective cap. Packages with `provenance.palette.catalogue` use the explicitly reduced projection described above, without those indices; this includes the bundled DMC version selected in the UI. Legacy provenance without `catalogue` and the existing DMC/inventory fallback keep the full-list package contract. Candidate brand/range/code/hex/RGB identities survive without unrelated local inventory IDs. The unchanged default generation path retains engine `0.1.0+ricamo.2`/adapter 2 provenance; composition/restriction settings use `0.1.0+ricamo.3`/adapter 3; border-background removal uses `0.1.0+ricamo.4`/adapter 4. Saved revisions are not regenerated on import. See [ENGINE-AUDIT](ENGINE-AUDIT.md) for the algorithm boundary.

## Open data: CSV, TSV and JSON

Settings offers inventory, movement history, purchases and project summaries. Exports are read-only snapshots, include recorded names/notes, and do not include attachment bytes. Use a full backup for restoration.

CSV uses semicolon in Italian and comma in English. TSV uses tab. Text is UTF-8 with BOM and CRLF rows; fields are quoted, with doubled embedded quotes. Decimal quantities follow the selected language. References such as `001` stay text in the file; when opening in a spreadsheet, import reference columns as text to retain their formatting.

Potential spreadsheet formulas and leading apostrophes receive one protective apostrophe. The `__ricamo_escape=apostrophe-v1` column declares this transformation. The inventory importer reverses exactly that declared prefix. JSON keeps the canonical string unchanged.

- Inventory CSV/TSV uses the inventory-import contract. A row is a material/lot pair; `__has_stock` distinguishes a catalogue-only row from an unknown-quantity physical lot. Inventory `cost` is expressed in ordinary units of `currency`. Versioned native descriptors and custom properties round-trip through bounded material/lot properties JSON; mapped descriptive columns take precedence as shown in the preview. Rows with conflicting metadata for one new catalogue reference must be corrected before import.
- Movement tables retain IDs, dates, kinds, before/after quantities, units, project links, correction/transfer/purchase/kit references and recorded confidence. `not_recorded` means the historical movement did not contain a confidence value; today's lot label is not substituted. `costHundredths=125` means 1.25 units of the accompanying currency.
- Purchase tables retain ordered and received quantities, status, project/supplier references, `unitPriceHundredths` and receipt details. Pending orders do not become physical stock in an export. Purchase and receipt rows carry their attachment IDs plus scoped metadata (`id`, `name`, `mime`, `size`, `digest`) for those references only. Inventory JSON projects metadata for attachments referenced by its materials and locations in a top-level metadata index; neither table export contains the bytes or an unrelated global attachment listing.
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
attachmentBytesIncluded: false
attachmentMetadata: scoped metadata index (inventory only)
data: dataset contents
```

Inventory JSON contains the canonical `materials`, `lots`, `locations` and `suppliers` arrays, including technical/custom properties and string identifiers. Other datasets contain their documented summary rows. JSON retains numeric types, booleans, arrays and explicit nulls. A row's currency applies only to the corresponding monetary values; per-currency maps preserve separate totals.

## Empty inventory templates

Settings can export header-only IT/EN CSV templates using the same locale delimiters and UTF-8/BOM convention. There are no sample records to accidentally import. The columns cover name/category/brand/range/code/unit/quantity/confidence/status/location/lot code/package size/strands/cost/currency/notes and `__has_stock`; Italian labels are localized. Values are still reviewed and mapped by the inventory importer. A blank quantity is not a known zero, and references should be treated as text in spreadsheet software.

## Diagnostic JSON

The previewable support export uses `format: "ricamo-diagnostics"`, `version: 1`. Its whitelist contains application version, generation time, schema version, state revision, storage kind (`sqlite` or `indexeddb`), domain-validation outcome (`passed` or `failed`) and collection counts. It explicitly records `containsRecords: false`, `containsFiles: false`, `containsPaths: false`. Counts cover materials, lots, movements, reservations, patterns, projects, needs, tasks, sessions, purchases, receipts, locations, suppliers and attachments.

It does not copy names, codes, notes, file contents, paths, bibliographic links or import-report rows, and is never sent automatically. Counts and version information are still information the user chooses to share. The validation result concerns the domain snapshot; it is not a backup, a database-repair operation, a digital signature or a complete security assessment.

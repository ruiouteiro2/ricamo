# Ricamo — practical guide

For Ricamo 0.4.0. Interface names below use English; select **English** in the language control or in **Settings → Language**. Native Windows file and printer dialogs may use the operating system's language. For Italian, see [Guida pratica](USER-GUIDE-IT.md).

## Start with a small, real task

Your personal studio starts empty. No account or internet connection is needed for normal use. Choose your currency and A4/Letter paper in **Settings**; these can be changed later.

To practise without mixing examples into your materials, open **Help → Try the example studio**. Its separate window is labelled **Example studio**. Follow **Try these steps**: compare measured red cotton with its reservation, inspect unknown gold cotton, mark the practice project, then edit the little flower. **Return to my studio** closes that window. Example changes do not alter your personal library and are excluded from its backups.

For your own first record:

1. Open **Storage → New location** and create a box or drawer.
2. Open **Materials → Add material**. Enter a name, category and the unit you actually count. Enter the brand/range/code when known; `001` is a code, not the number `1`.
3. In **What you have**, enter the quantity and its location. Leave quantity blank if you cannot measure it yet.
4. Open **Projects → New project**, name a small piece, then use its **Materials** tab to add a requirement.
5. Make a backup after entering useful information: **Settings → Backup → Create a backup**.

A successful save is acknowledged by the application. If an editor shows pending changes or a write error, keep it open and use **Try again**. A saved draft and a published pattern revision are different things.

## Materials and physical lots

A catalogue material describes a reference. Its lots describe what you own: quantity, dye lot, condition and location. Use **Add a lot** for another skein, package or piece of the same reference with a different location or dye lot. Use a separate material when the identity or counting unit is different.

| Display | Meaning |
| --- | --- |
| Physical stock | Material physically recorded as owned. |
| Eligible stock | Stock in a usable condition. |
| Reserved | Set aside for a project, still physically present. |
| Available | Usable stock left after reservations. |
| Unknown | A quantity or conversion has not been established. |
| Estimated | A numeric measurement is approximate. |
| 0 | A known zero, not an unmeasured amount. |

Unknown usable lots can make a shortage uncertain. Measure them before treating a suggested gap as a definite purchase quantity. A red swatch on screen does not establish a manufacturer's exact colour match.

Open a material and use **Record a movement** for a receipt, confirmed consumption, loss, discard, return, physical count or transfer. A **Physical count** is the new amount actually counted, not the amount to add. If it conflicts with existing reservations, review those reservations. Use a transfer to relocate stock; do not create a second receipt for the same material.

**Rapid entry**, **Edit selected materials**, categories and saved inventory views help with larger collections. Read their previews before applying multiple changes. Exported labels help identify materials and storage locations. **Settings** offers inventory CSV import with a preview; see [Data formats](DATA-FORMATS.md) for supported columns and exports.

A metre of whole thread and a metre of one separated strand are different units. Package length and strand count must describe the actual product. Ricamo does not assume every skein is 8 m or every thread has six separable strands. See [Materials and units](MATERIALS.md).

For a partial count, open **Materials → Physical inventory** and filter the materials, category or location. Enter only the lots you counted: a blank **Observed quantity** leaves that lot unchanged; `0` records a real zero. Review the differences and each project's reservations. Choose whether to retain the visible shortage or redistribute reservations, then use **Confirm count and decisions**. The preview also shows any minimum requirements that confirmation will create; existing planned requirements are retained.

During CSV import, **Empty CSV templates** downloads headers for Italian or English spreadsheets. Fill in your own records and keep reference/code columns as text. The Italian template uses semicolons and comma decimals; the English template uses commas and decimal points.

Use **Location photos and documents** to retain a picture or document with a storage location. Selected files are staged until Save; cancelling the form leaves them unlinked.

## Local thread catalogues and substitutions

In **Settings → Local thread catalogues → Manage catalogues**, use **Personal JSON template** to see the format, then **Import catalogue JSON**. Review the declared source, licence/conditions, version and colours. Confirm your right to use the data locally before **Store this version**. Import creates neither inventory materials nor owned lots. Versions are immutable: corrected data need a new version. Limits are 5 MiB per JSON file, 6000 colours per version, 20 imported versions and 20000 imported colours in total. Keep codes as strings.

Choose **Catalogue version** during catalogue-based image generation or **Add colour**. Saved revisions retain the selected version and attribution; importing an update does not recolour them. **Prefer my inventory colours** retains its existing DMC fallback. The supplied RGB compilation and imported swatches are approximate, not an official equivalence guarantee.

In the drawing editor, select a single-thread colour and open **Compare substitutions**. Review commercial identity, approximate ΔE76 distance, physical/available stock, reservations, units and conversion uncertainty. A close RGB match does not prove interchangeable fibres, finish or colour. Confirmation changes only the draft palette entry. Publish a new revision, review the project’s revision change and recalculate requirements separately. Existing blends use the recipe editor.

## Reserve, stitch, then record real consumption

In a project's **Materials** tab, **Add material requirement** records the planned amount. **Reserve** selects a real lot and the total quantity to hold for that project. Entering zero releases that reservation.

For example, with 24 m physical and reservations of 10 m and 8 m, 6 m is free. Consuming 4 m for the first project leaves 20 m physical and 6 m still reserved for it: free stock remains 6 m. The consumed amount must not be subtracted a second time as a reservation.

Use **Confirmed consumption** only for material actually used. Marking points complete, recording time or finishing the project does not invent consumption. Unknown quantities need a physical count before a quantified stock action. Reusable hoops and tools are assigned or reserved, then returned; they are not thread consumption. Their **Loans and maintenance** section records lending and maintenance separately.

## Fabric and kits

For fabric, record the real piece dimensions and whether count means stitches/inch or fabric threads/inch. Working over two fabric threads changes effective stitch density. In **Fabric piece, reservations and cuts**, use **Plan and reserve** to check dimensions, orientation, margins and occupied regions. Area alone cannot prove a piece fits: a required 31.4 × 31.4 cm square does not fit a 30 × 40 cm piece.

The calculator and project report show **Full grid** and **Stitched extent** separately. The latter follows the actual full/half stitches and backstitch endpoints; empty cells do not enlarge it. Continue to plan the cut from the full grid and your four margins. Unknown fabric count leaves centimetres unknown. An empty pattern has no stitched extent; a vertical backstitch can have a genuine zero geometric width because thread thickness is excluded.

In **Measurements and condition → Measured geometry**, enter unavailable rectangles or simple polygons in centimetres; for an irregular piece, record its outline too. Vertices are ordered around the boundary, one X Y pair per line. Up to 16 defect areas and 24 vertices per polygon are supported, with six decimal places. Crossing edges and new shapes outside the piece are rejected. Confirm the mapping is complete only after measuring all limitations; photographs are not measured automatically.

The calculated usable area excludes margins and the union of defects once, even when they overlap. Unreserved area also excludes held regions or a whole-piece reservation. Legacy notes or an incomplete outline keep the area unknown; a wholly unusable piece can have known zero. **Measured geometry PDF** exports the measurements and local identity without private descriptive notes. The diagram is not a physical-scale cutting template.

A cut or reserved cut region cannot cross a recorded defect, outline or unusable margin, even with manual confirmation. The limited position search can suggest a verified fit; no suggestion means manual placement still needs checking, not proof that every placement is impossible. Original measured shapes remain attached to rectangular remnants through their source frame. Physical cutting of arbitrary irregular outlines remains a manual workflow.

Choose **Confirm physical cut** only after cutting. Ricamo records the resulting piece and remnants with their origin; a reservation itself does not cut cloth. A reversal can be refused when later operations depend on the resulting pieces.

**Virtual collections** are reusable lists for **Plan project materials**. They do not create physical stock. Review whether to keep existing requirements or replace quantities before applying the list.

A physical kit is different. Save its **Declared kit contents**, then use **Open and verify kit** on a kit lot. Identify the components actually found, their quantities and any replacements. A found but unmeasured component can remain unknown. Missing or unverified entries are not usable stock. **Verify pending components** records later checks without opening another kit. Opening removes an intact kit unit and records verified components; do not consume that kit unit a second time. Its **Unallocated shared cost** is kept separately and is not automatically counted again as consumed component cost.

## Purchases

**Shopping → Project requirements** combines shared demand without counting the same stock for every project. **Update list from shortages** creates or updates quantified gaps; uncertain quantities need review rather than an invented order amount.

Use **Add purchase** for a manual list entry or order. An ordered item is still not stock. When it arrives, use **Receive delivery**, enter only that delivery's amount, and select its destination. Several partial deliveries can satisfy one order. Review remaining outstanding quantities before recording another arrival. Costs in different currencies remain separate; there is no automatic exchange-rate conversion.

Use **Invoices and receipts** for purchase documents and **Receipt documents** for a particular delivery. Save the selected files to attach their managed copies. Attaching an invoice records a document; record delivered quantities separately with **Receive delivery**.

## Projects, time and finishing

A project may use a saved pattern revision, a PDF/image reference, or no structured pattern. Its saved revision remains pinned when the library gains a newer revision. Use **Edit → Use the latest pattern revision** only when you intend to change it. **Review revision change** compares grid/stitched dimensions, materials, estimates, saved requirements, reservations, consumption and progress before confirmation. Existing exported PDFs do not change; regenerate them with the intended print options. The review does not invent a future PDF page count.

Resetting new-revision progress is the default. **Carry only stitches with proven correspondence** is an explicit option for unique matches in the same pattern and fabric/planning frame: same coordinates, primitive/direction, identified thread recipe and strand count. It does not infer translations, carry ambiguous/anonymous references or turn manual percentages into stitches. Old progress and estimate history remain available; derived needs are invalidated, manual needs and physical reservations remain for review. If the library changes while the review is open, refresh it before confirming.

Use **Preparation and finishing** for steps. **Save as template**, **Apply template** and **Manage checklist templates** support reusable lists. Built-in templates can be copied and customised. Replacing unfinished steps requires a preview; completed steps are retained. Deleting a template does not delete tasks already applied to projects.

In **Stitch**, use **Start timer**, **Pause**, then **Save session**. Review the duration, especially after computer sleep. **Journal → Record a session** also accepts manual entries. Recording time alone does not mark stitches or consume material.

In **Time forecast → Forecast settings**, choose:

- **Forecast from measured sessions**: rates come from compatible sessions with duration and counted work on the pinned revision. Untyped sessions still remain in the journal.
- **Manual forecast: your assumptions**: enter time per full cross, half stitch, backstitch segment and bead. For a reference/no-grid project, also enter remaining counts. Use 0 for a type that is absent; leave genuinely unknown values blank.

Remaining grid work comes from actual progress. A percentage is not converted into a fictitious stitch count. Missing required rates/counts leave the total unknown. Weekly available hours and additional finishing minutes affect the forecast; a date is a planning estimate, not a commitment.

**Calculate thread requirements** lets you review assumptions and map palette references or blend components to real catalogue materials. Apply only after reviewing the quantities and unknown conversions. **Compare with confirmed consumption** can calibrate a completed material's estimate when the recorded consumption and revision make that comparison meaningful. A blend requires whole numbers of component strands; it does not create a new physical mixed-thread stock item.

Before **Finish project**, record actual consumption and review remaining needs, borrowed tools and finishing steps. Closing releases reservations and returns project tools. Reopening permits further work; it does not erase earlier history.

## Work on a structured pattern

In the project's **Stitch** tab, use the marking tools, colour highlight and **Stitch type to mark**. **Remaining work by colour** shows completed/total counts separately for full crosses, half stitches, backstitch segments and beads. Empty fabric is excluded. Filters change the targets you mark, never the global denominator. Review the preview before marking a multi-point selection.

Focus the canvas to use arrows and Space; **Undo** and **Redo** correct the current work session. Click a cell with the navigation tool, or press Enter on the canvas, to choose a thread or bead from the local catalogue or existing palette. Brand, thread type and colour code identify the product; known digital colour is filled automatically. Unknown swatches remain explicitly unknown. Beads use one item per cell and can retain a separate fastening-thread recipe. Their displayed footprint uses the recorded diameter and fabric density.

**Review material effects** proposes isolated highlights for beads/metallic thread or low-chroma regions for declared embroidery wool. These are local colour heuristics, not object recognition. Choose a verified product, review/toggle positions and explicitly apply. Bead proposals require known size, valid fabric spacing and a fastening thread. Generic yarn is not automatically treated as embroidery wool. Undo reverses an application in one step.

The ingredient panel compares required quantities with stock, your project's reservations and reservations elsewhere. It shows skeins/packages only when package contents and conversions are known. Unknown stock or bead pack counts remain unknown. Apply updates calculated project needs without consuming stock; manual needs remain for review. Fabric cut dimensions include the selected margins. Purchase links open only when clicked. Supplier updates are started or resumed explicitly in Settings; incomplete/blocked coverage remains visible and does not prevent offline work.

**Column**, **Row** and **Go to coordinates** move to a specific location. Search palette references by brand, code, name or symbol.

**Add continuation marker** records a place to resume; **Record parked thread** also identifies a thread colour. On the focused canvas, B and P open these forms. They are references, not completed stitches or stock movements. Their scope is the project and pattern revision. Older/unassigned references remain readable and removable; an old unassigned marker requires explicit association before it can navigate the current revision. Changing revision does not silently reuse old coordinates. Position and context are saved when changing tabs, navigating and closing; retry if saving fails.

For a project without a structured grid, use **Manual progress (%)**. PDF annotations are not an exact point counter.

## Generate, edit and retain references

Open a pattern's **Details → Edit pattern details** to record its author, technique, theme, source, personal difficulty and rights notes. **Collections** group patterns without copying files; favourites and filters help find them. **Use in projects** distinguishes current links from historical revisions. When sharing a project, author/technique/theme/rights accompany it; personal source, difficulty and collections require the private-notes choice. Recorded rights notes do not grant a licence.

In **Patterns**, choose **From an image**, **Blank grid**, **Import pattern** or **Import reference**. Image generation accepts PNG, JPEG, WebP and GIF, within the file/dimension limits; an animated image is not converted into an animated pattern.

For generation, crop, rotate/flip and adjust brightness/contrast before choosing the output size and colour limit. The grid supports up to 500 × 500 cells and 500 colours; simplified and balanced modes may use fewer. The source image remains separate from the editable result. Enter the embroidery width in centimetres; image proportions determine height, and fabric density determines the integer grid. The displayed actual size reflects rounding to whole stitches. Choose fabric type, density per centimetre and colour; a fabric with unknown density needs a measurement before generation. The separate cut allowance starts at 5 cm per side for new image patterns and is editable. It does not enlarge the embroidery. Preview updates automatically after settings change; Save is unavailable while the preview is stale or invalid.

**Transparency handling** chooses empty cells or composition over white/a chosen colour. Composition makes formerly transparent areas into stitches. **Remove border background** instead masks colours connected to an image edge through matching or transparent pixels, using four-neighbour connectivity. Choose **Background colour** and adjust **Background colour tolerance** (0–80 approximate ΔE76). Matching whites fully enclosed by retained pixels stay stitched. This is a measured colour-distance mask on the resized output grid, not semantic subject recognition. Review the updated preview after changing size; if everything is removed, generation reports an empty image and cannot save a new empty result. The original file remains unchanged. Under **Excluded colours**, search the selected palette and remove references you do not want to use. If the available palette changes, review the cleared restrictions and choose them again. Compare the previous and current previews; Save stores only the current result.

**Only my inventory colours** restricts matching to eligible held thread colours. **Prefer my inventory colours** allows a bounded colour-distance preference with catalogue fallback. Both can include reserved or unmeasured usable holdings: neither promises sufficient material. Use the project requirements to check quantities.

Review **Detail review**, isolated regions and protected regions before saving. Cleanup may remove meaningful small details; protected regions constrain that cleanup, not all image processing. Colour samples are approximate. Cancel generation if needed; an unsaved preview does not become a library pattern.

The editor supports full crosses, half stitches, backstitches, bead cells, selection/copy/paste, transformations and **Motifs and text**. Text uses the supported stitch alphabet; it is not arbitrary font conversion. Destructive cropping shows its impact. **Save new revision** publishes a new revision without changing projects already pinned to another one.

**Column**, **Row** and **Go to coordinates** also work in the drawing editor, using positions starting at 1. **Centre view** focuses the geometric centre and enables **Show centre guide**; an even grid’s centre lies between cells. Navigation and the guide do not edit stitches or consume stock.

When saving or editing a personal motif, **Motif category** is optional. Reuse a category name to group motifs, then filter with **Personal motif category**.

An autosaved draft can be recovered with **Resume draft** or discarded explicitly. Native pattern export uses the saved revision; publish the intended draft before sharing that editable file. PDF and PNG export use the current editor contents.

A PDF/image imported as a reference stays a document. Browse pages, use **Highlight region**, **Document note** and **Bookmark this page**, then **Export with annotations** if wanted. The original remains available through **Save a reference copy**. Password-protected PDF passwords are not stored. A drawn highlight does not infer editable stitches or consumption.

**Import reference** accepts a reviewed batch of up to 20 PDF/images, 100 MiB total and 25 MiB per file. Decide explicitly how to handle duplicates, then confirm the import. Each original/reference saves atomically; stopping preserves completed items. The report distinguishes stored, failed and pending items. After reopening, reselect the same missing originals to retry; the report does not retain their file bytes.

From a pattern’s details or a project overview, use **Linked books and magazines → Link reference** to choose a catalogue title and its **Relevant pages**. A title can be linked even when you do not own a physical copy. Its material card shows **Linked patterns and projects**. These are local bibliographic links: no scan, stock or need is created. Full backups retain them; project packages always exclude them, even with private notes selected.

## Export and print

Choose colour with symbols or white with black symbols. Reading-cell size is adjustable in centimetres (0.45 cm by default); chart pages repeat a marked overlap and include a page map, legend and ingredient list. Printing supports up to 500 document pages, split into jobs of at most 200 pages and 128 million retained pixels. After cancelling a later job, Resume uses the previous PDF and starts after the last confirmed batch, even if export settings change. It is available while that editor remains open. Confirmation records submission to Windows, not physical printer completion.

For project labels, open **Project label** in the project reports area; a pattern is not required. Material, lot, remnant and container labels share fixed width/height controls and an A4/Letter layout preview. Choose 30–180 mm width and 20–250 mm height. Full text and real IDs are retained; if they cannot fit legibly, enlarge the label before exporting. Save the PDF without needing a printer, then print at actual size when the geometry matters.

The editor's **Export** offers a reading-chart PDF, PNG and native pattern file. The reading chart has a legend, page map and overlap strips; repeated strips do not increase stitch quantities. It is enlarged for reading, not a physical-size transfer.

For the reading-chart PDF, choose **Orientation** and **Margins (mm)** as well as A4/Letter paper. Margins accept 5–40 mm. These controls belong to the reading chart; use **Actual-size PDF** for a physical transfer.

A project's **PDF report** has explicit recipient/private-note choices. **Actual-size PDF** requires the correct X/Y fabric counts and count meaning. Start with **Calibration PDF**: print at 100%/Actual size with Fit to page disabled, measure both axes, and use **Calculate print correction** if needed. The application cannot guarantee printer calibration. Save a PDF even when no printer is installed; open the saved file in your PDF viewer to print.

Cancelling the destination dialog cancels that export. It does not mean a file was saved; you can retry with the same choices.

## Back up, transfer and recover

Use **Create a backup** for the whole personal library, including managed originals and drafts. **Automatic backups** has an interval, retention count and optional **Choose second folder**. **Back up now** records the result of each destination. A failed second-folder copy does not invalidate a successful local copy. Copies on the same disk do not protect against losing that disk.

**Restore a backup** replaces the current library after a preview; it is not a merge. Ricamo preserves a copy of the previous state first. Keep a separate verified copy before changing computer or application version. Backups are not encrypted: store and share them accordingly.

Before large backup/restore writes, the desktop application checks available disk space. If the space check or write fails, read the error, free space and retry (for an exported copy, you can choose another destination); do not interpret a failed operation as a saved copy.

**Export project** and **Import project** move selected project information, supported revisions and chosen attachments. Review privacy and catalogue matches. Importing a project does not create its physical materials, reservations or purchasing receipts. Starting a fresh copy clears transferred progress and manual remaining counts. This is different from restoring the whole library.

A project package never contains your imported catalogue collection or its local catalogue IDs. For a revision generated from a versioned catalogue, including the bundled DMC version selected in the UI, it retains attribution and the commercial references present in the exported palette/recipes, but omits the original candidate restrictions and preference indices. The package explicitly records that exact regeneration requires the original catalogue and generation settings. Older revisions without catalogue-version provenance and the existing inventory/DMC fallback retain their previous export behaviour. Declared catalogue source/licence text travels as attribution and is not redacted; review it before sharing. Full backups retain the complete local catalogue collection.

CSV/TSV/JSON exports are useful for inspection and analysis. They are not complete backups and contain recorded names/notes. See [Data formats](DATA-FORMATS.md) for exact boundaries.

For a support report, open **Settings → Diagnostics without personal records**. Review **Diagnostic file preview** before exporting. It contains version, collection counts and an internal validation result, with no record names, notes, codes, paths or attachments. Nothing is sent automatically.

## Installation and current limits

The intended desktop target is Windows x64 with a local installer. Development packages are unsigned; the installer is not a verified-publisher signature. Do not disable Windows protections to install it. A local Windows 10 x64 build 19045 installation and selected native journeys were exercised during development. This does not prove the latest build on a clean Windows 11 PC, every printer or every imported file. Check [implementation status](STATUS.md) for the exact packaged build and remaining validation before relying on a release.

The 0.4.0 Windows installer passed the content audit, 28 native journeys, update/reinstall/uninstall and persistence checks on Windows 10 x64. The integrated domain suite passed 438 tests. See [STATUS](STATUS.md) for hashes, measured performance and remaining environment limitations. The earlier 0.3 installer remains isolated because its content audit found extra files/cache.

## Short Italian–English glossary

| Italiano | English | Meaning here |
| --- | --- | --- |
| Materiale / referenza | Material / reference | Product identity, separate from what is owned. |
| Lotto | Lot | A physical amount with condition, location and optional dye lot. |
| Riserva | Reservation | A project hold; it does not consume stock. |
| Consumo confermato | Confirmed consumption | Material actually used and explicitly recorded. |
| Pezza / ritaglio | Fabric piece / remnant | Original fabric or a remaining piece with its origin. |
| Filamento | Strand / filament | One separated thread component; not necessarily a whole thread. |
| Contatura | Fabric count | Stitches or fabric threads per inch, as recorded. |
| Bozza / revisione | Draft / revision | Recoverable work versus an immutable published pattern. |
| Punto scritto | Backstitch | Explicit line segments, counted separately from full crosses. |
| Da verificare | Unknown | No established value; distinct from numeric zero. |

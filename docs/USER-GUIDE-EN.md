# Ricamo — practical guide

For Ricamo 0.2.0. Interface names below use English; select **English** in the language control or in **Settings → Language**. Native Windows file and printer dialogs may use the operating system's language. For Italian, see [Guida pratica](USER-GUIDE-IT.md).

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

## Reserve, stitch, then record real consumption

In a project's **Materials** tab, **Add material requirement** records the planned amount. **Reserve** selects a real lot and the total quantity to hold for that project. Entering zero releases that reservation.

For example, with 24 m physical and reservations of 10 m and 8 m, 6 m is free. Consuming 4 m for the first project leaves 20 m physical and 6 m still reserved for it: free stock remains 6 m. The consumed amount must not be subtracted a second time as a reservation.

Use **Confirmed consumption** only for material actually used. Marking points complete, recording time or finishing the project does not invent consumption. Unknown quantities need a physical count before a quantified stock action. Reusable hoops and tools are assigned or reserved, then returned; they are not thread consumption. Their **Loans and maintenance** section records lending and maintenance separately.

## Fabric and kits

For fabric, record the real piece dimensions and whether count means stitches/inch or fabric threads/inch. Working over two fabric threads changes effective stitch density. In **Fabric piece, reservations and cuts**, use **Plan and reserve** to check dimensions, orientation, margins and occupied regions. Area alone cannot prove a piece fits: a required 31.4 × 31.4 cm square does not fit a 30 × 40 cm piece.

Choose **Confirm physical cut** only after cutting. Ricamo records the resulting piece and remnants with their origin; a reservation itself does not cut cloth. A reversal can be refused when later operations depend on the resulting pieces.

**Virtual collections** are reusable lists for **Plan project materials**. They do not create physical stock. Review whether to keep existing requirements or replace quantities before applying the list.

A physical kit is different. Save its **Declared kit contents**, then use **Open and verify kit** on a kit lot. Identify the components actually found, their quantities and any replacements. A found but unmeasured component can remain unknown. Missing or unverified entries are not usable stock. **Verify pending components** records later checks without opening another kit. Opening removes an intact kit unit and records verified components; do not consume that kit unit a second time. Its **Unallocated shared cost** is kept separately and is not automatically counted again as consumed component cost.

## Purchases

**Shopping → Project requirements** combines shared demand without counting the same stock for every project. **Update list from shortages** creates or updates quantified gaps; uncertain quantities need review rather than an invented order amount.

Use **Add purchase** for a manual list entry or order. An ordered item is still not stock. When it arrives, use **Receive delivery**, enter only that delivery's amount, and select its destination. Several partial deliveries can satisfy one order. Review remaining outstanding quantities before recording another arrival. Costs in different currencies remain separate; there is no automatic exchange-rate conversion.

## Projects, time and finishing

A project may use a saved pattern revision, a PDF/image reference, or no structured pattern. Its saved revision remains pinned when the library gains a newer revision. Use **Edit → Use the latest pattern revision** only when you intend to change it, and read the confirmation about the new progress starting at zero.

Use **Preparation and finishing** for steps. **Save as template**, **Apply template** and **Manage checklist templates** support reusable lists. Built-in templates can be copied and customised. Replacing unfinished steps requires a preview; completed steps are retained. Deleting a template does not delete tasks already applied to projects.

In **Stitch**, use **Start timer**, **Pause**, then **Save session**. Review the duration, especially after computer sleep. **Journal → Record a session** also accepts manual entries. Recording time alone does not mark stitches or consume material.

In **Time forecast → Forecast settings**, choose:

- **Forecast from measured sessions**: rates come from compatible sessions with duration and counted work on the pinned revision. Untyped sessions still remain in the journal.
- **Manual forecast: your assumptions**: enter time per full cross, half stitch and backstitch segment. For a reference/no-grid project, also enter remaining counts. Use 0 for a type that is absent; leave genuinely unknown values blank.

Remaining grid work comes from actual progress. A percentage is not converted into a fictitious stitch count. Missing required rates/counts leave the total unknown. Weekly available hours and additional finishing minutes affect the forecast; a date is a planning estimate, not a commitment.

**Calculate thread requirements** lets you review assumptions and map palette references or blend components to real catalogue materials. Apply only after reviewing the quantities and unknown conversions. **Compare with confirmed consumption** can calibrate a completed material's estimate when the recorded consumption and revision make that comparison meaningful. A blend requires whole numbers of component strands; it does not create a new physical mixed-thread stock item.

Before **Finish project**, record actual consumption and review remaining needs, borrowed tools and finishing steps. Closing releases reservations and returns project tools. Reopening permits further work; it does not erase earlier history.

## Work on a structured pattern

In the project's **Stitch** tab, use the marking tools, colour highlight and **Stitch type to mark**. **Remaining work by colour** shows completed/total counts separately for full crosses, half stitches and backstitch segments. Empty fabric is excluded. Filters change the targets you mark, never the global denominator. Review the preview before marking a multi-point selection.

Focus the canvas to use arrows and Space; **Undo** and **Redo** correct the current work session. **Column**, **Row** and **Go to coordinates** move to a specific location. Search palette references by brand, code, name or symbol.

**Add continuation marker** records a place to resume; **Record parked thread** also identifies a thread colour. On the focused canvas, B and P open these forms. They are references, not completed stitches or stock movements. Their scope is the project and pattern revision. Older/unassigned references remain readable and removable; an old unassigned marker requires explicit association before it can navigate the current revision. Changing revision does not silently reuse old coordinates. Position and context are saved when changing tabs, navigating and closing; retry if saving fails.

For a project without a structured grid, use **Manual progress (%)**. PDF annotations are not an exact point counter.

## Generate, edit and retain references

In **Patterns**, choose **From an image**, **Blank grid**, **Import pattern** or **Import reference**. Image generation accepts PNG, JPEG, WebP and GIF, within the file/dimension limits; an animated image is not converted into an animated pattern.

For generation, crop, rotate/flip and adjust brightness/contrast before choosing the output size and colour limit. The grid supports up to 500 × 500 cells and 80 colours; simplified and balanced modes may use fewer. The source image remains separate from the editable result.

**Only my inventory colours** restricts matching to eligible held thread colours. **Prefer my inventory colours** allows a bounded colour-distance preference with catalogue fallback. Both can include reserved or unmeasured usable holdings: neither promises sufficient material. Use the project requirements to check quantities.

Review **Detail review**, isolated regions and protected regions before saving. Cleanup may remove meaningful small details; protected regions constrain that cleanup, not all image processing. Colour samples are approximate. Cancel generation if needed; an unsaved preview does not become a library pattern.

The editor supports full crosses, half stitches, backstitches, selection/copy/paste, transformations and **Motifs and text**. Text uses the supported stitch alphabet; it is not arbitrary font conversion. Destructive cropping shows its impact. **Save new revision** publishes a new revision without changing projects already pinned to another one.

An autosaved draft can be recovered with **Resume draft** or discarded explicitly. Native pattern export uses the saved revision; publish the intended draft before sharing that editable file. PDF and PNG export use the current editor contents.

A PDF/image imported as a reference stays a document. Browse pages, use **Highlight region**, **Document note** and **Bookmark this page**, then **Export with annotations** if wanted. The original remains available through **Save a reference copy**. Password-protected PDF passwords are not stored. A drawn highlight does not infer editable stitches or consumption.

## Export and print

The editor's **Export** offers a reading-chart PDF, PNG and native pattern file. The reading chart has a legend, page map and overlap strips; repeated strips do not increase stitch quantities. It is enlarged for reading, not a physical-size transfer.

A project's **PDF report** has explicit recipient/private-note choices. **Actual-size PDF** requires the correct X/Y fabric counts and count meaning. Start with **Calibration PDF**: print at 100%/Actual size with Fit to page disabled, measure both axes, and use **Calculate print correction** if needed. The application cannot guarantee printer calibration. Save a PDF even when no printer is installed; open the saved file in your PDF viewer to print.

Cancelling the destination dialog cancels that export. It does not mean a file was saved; you can retry with the same choices.

## Back up, transfer and recover

Use **Create a backup** for the whole personal library, including managed originals and drafts. **Automatic backups** has an interval, retention count and optional **Choose second folder**. **Back up now** records the result of each destination. A failed second-folder copy does not invalidate a successful local copy. Copies on the same disk do not protect against losing that disk.

**Restore a backup** replaces the current library after a preview; it is not a merge. Ricamo preserves a copy of the previous state first. Keep a separate verified copy before changing computer or application version. Backups are not encrypted: store and share them accordingly.

**Export project** and **Import project** move selected project information, supported revisions and chosen attachments. Review privacy and catalogue matches. Importing a project does not create its physical materials, reservations or purchasing receipts. Starting a fresh copy clears transferred progress and manual remaining counts. This is different from restoring the whole library.

CSV/TSV/JSON exports are useful for inspection and analysis. They are not complete backups and contain recorded names/notes. See [Data formats](DATA-FORMATS.md) for exact boundaries.

## Installation and current limits

The intended desktop target is Windows x64 with a local installer. Development packages are unsigned; the installer is not a verified-publisher signature. Do not disable Windows protections to install it. A local Windows 10 x64 build 19045 installation and selected native journeys were exercised during development. This does not prove the latest build on a clean Windows 11 PC, every printer or every imported file. Check [implementation status](STATUS.md) for the exact packaged build and remaining validation before relying on a release.

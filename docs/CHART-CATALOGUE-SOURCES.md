# Commercial chart catalogue provenance

Checked 2026-11-01 against Casa Cenina public manufacturer listings in the Schemi filter (`filter_id=5`, alphabetical `sort=2a`). Mirabilia includes the Nora Corbett products grouped under that manufacturer by the retailer.

| Manufacturer | Listing pages | Distinct products | Local previews |
| --- | --- | --- | --- |
| [Mirabilia / Nora Corbett](https://www.casacenina.it/mirabilia-design-nora-corbett/?filter_id=5&sort=2a) | 7 | 398 | 398 |
| [Bella Filipina](https://www.casacenina.it/bella-filipina/?filter_id=5&sort=2a) | 2 | 84 | 84 |

All nine observed paginated listings and 482 product detail pages were fetched successfully. Mirabilia includes legacy `/mirabilia-design/` product links as well as `/mirabilia-design-nora-corbett/`. Coverage is a dated snapshot of observed retailer listings, including listed unavailable products; it does not assert completeness of the publishers' historical releases.

`data/pattern-catalogue.json` records stable retailer product IDs, names, product/source image URLs, dimensional evidence, and SHA-256 of every original thumbnail. `src/assets/chart-previews.json` embeds those exact small preview bytes for offline use. Preview images remain the property of the respective authors/publishers; neither the repository MIT license nor inclusion grants rights to reproduce their designs. No commercial chart grids, instructions or purchased PDFs are included. The application shows publisher attribution and an explicit source link; browsing the catalogue never requests remote assets.

There are 164 products with declared centimetre dimensions. Another 214 have stitch counts from which the application estimates centimetres using the selected stitch density, initially 16 stitches/inch (32-count linen over two threads). These estimates are labelled and change with density. The remaining 104 lack usable size information and show `Misura non indicata`. Declared dimensions retain Casa Cenina's stated size and are not recomputed. Fabric, borders and margins can change the final framed size.

The optional acquisition tool is `build/acquire-pattern-catalogue.py`, run from the repository root with Python and BeautifulSoup (`python -m pip install --target .runtime/research-libs beautifulsoup4`). It caches public responses under ignored `.runtime/chart-catalogue`, checks source hosts and response bounds, and emits both catalogue and preview bundle. It is a maintainer tool, not an application network service.

Personal ownership and new/in-progress/completed status are independent of the bundled catalogue and saved in application preferences, keyed by stable catalogue ID. They survive restart and full `.ricamobackup` export/restore. Finished cards display a green `Completato` badge. The existing editable chart library remains available separately; marking ownership does not import the purchased design file.

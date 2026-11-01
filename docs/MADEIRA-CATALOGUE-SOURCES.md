# Madeira metallic catalogue provenance

Checked 2026-11-01 using the [official Italian Madeira site](https://www.madeira.com/it-it/), its [metallic threads page](https://www.madeira.com/it-it/materiali-da-ricamo/filati-industriali/metallizzati) and [shade-card download page](https://www.madeira.com/it-it/assistenza-e-supporto/cartelle-colori).

The catalogue bundles 255 distinct manufacturer range/colour identities transcribed from the public official shade cards:

| Range | Colours | Official PDF pages |
| --- | ---: | --- |
| FS 40 | 21 | Metallics 3 |
| FS 50 | 8 | Metallics 3 |
| FS 30 | 21 | Metallics 4 |
| FS 20 | 26 | Metallics 5 |
| Supertwist 30 | 121 | Metallics 6-9 |
| CR Metallic 40 | 42 | CR 4-5 |
| CR Metallic 20 | 16 | CR 5 |

Sources: [MADEIRA_METALLICS.pdf](https://www.madeira.com/fileadmin/user_upload/Downloads/Shade_Cards/MADEIRA_METALLICS.pdf), 10 pages, and [MADEIRA_CR.pdf](https://www.madeira.com/fileadmin/user_upload/Downloads/Shade_Cards/MADEIRA_CR.pdf), 8 pages. The Metallics PDF includes 11 explicitly multicolour Supertwist references. Counts reflect these observed PDFs, which may differ from marketing-page totals; for example, the FS web page states 20 FS 30 shades while the downloaded card lists 21. This is a dated snapshot, not a claim of every historical/retail Madeira product or current availability.

`data/madeira-metallic-catalogue.json` stores source PDF hashes, exact code/name facts, range identities, per-row page/code coordinates and RGB sampling rectangles. `build/acquire-madeira-catalogue.py` recreates it with Python and optional PyMuPDF. Source PDFs are cached only under ignored `.runtime/madeira`; the application does not include PDF artwork or perform a website scan. The bundled facts remain searchable offline in browser and native catalogue caches. This manufacturer snapshot is updated with application releases; generic retailer crawling is disabled for it.

Colour previews are computed means of central thread-swatch patches rendered from the PDFs. They are labelled approximate, not measured manufacturer RGB values. A solid preview cannot reproduce metallic sheen, texture or multiple colours. Exact thread shades must be checked against a physical card. The PDF artwork and manufacturer names belong to their respective owners; source links remain available explicitly in the application.

Metallici Madeira retains canonical manufacturer `Madeira` and its existing inventory route. Its entry type remains Rocchetto; choosing a catalogue reference preserves the actual FS/Supertwist/CR range, fills thickness from that range and stores owned stock in spools. No package length, manufacturer SKU or physical strand count is guessed from a colour code. Pack facts remain unknown, avoiding unsupported conversions to metres. Industrial-machine suitability in the source is not presented as a verified cross-stitch recipe. Full backups include saved product snapshots, approximate swatch provenance and stock; the bundled catalogue is also present in the application distribution.

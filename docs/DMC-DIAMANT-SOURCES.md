# DMC Diamant source evidence

Checked 2026-11-01 against the exact user-provided [official Italian DMC Diamant page](https://www.dmc.com/IT/it/products/metallic-thread/diamant). The initial web-reader request timed out; a direct public HTTP request succeeded and returned the page HTML. No account or private API was used.

The observed page includes 14 distinct SKU-linked product photos: D140, D168, D225, D301, D310, D316, D317, D321, D3821, D3852, D415, D5200, D699 and D898. The HTML selector text says 11 options and the technical description says 13 colours, while the image/variant references include 14. The snapshot records those 14 observed references and does not claim current stock availability or complete historical coverage. Diamant Grande remains separate and is not treated as 35m Diamant.

DMC describes Diamant as single-strand, nondivisible metallic hand-embroidery thread in 35-metre reels. Saved pack facts therefore use unit spool, length 35m, one strand and divisible false. The comparison to two strands of Moulin? is not used to invent physical stock, strand count or thickness. No weight/diameter number is guessed. New Diamant entries count owned spools, retaining conversion to metres through the verified pack facts.

`data/dmc-diamant-catalogue.json` records the exact source URL, HTML hash, variant IDs, original CDN image URLs and image SHA-256 values. `src/assets/dmc-diamant-previews.json` embeds the original 512w image bytes for offline use. Photos are displayed as product references with approximate screen colour; no measured RGB swatch is fabricated. Images and marks remain owned by their respective owners and are not included under the repository MIT license.

`build/acquire-dmc-diamant.py` recreates these assets with Python and optional BeautifulSoup in `.runtime/research-libs`. Downloaded HTML and photos remain cached under ignored `.runtime/dmc-diamant`. Runtime catalogue searches never request the DMC site or image CDN; the official link opens only after an explicit click. DMC is a bundled-only source and generic retailer scanning is disabled for it.

The Diamant type is exclusive to DMC. Its selector uses the official snapshot rather than duplicate retailer offers; existing Tessiland product snapshots and Grande references are retained for compatibility. Manufacturer reference links appear on the DMC brand card and page, and in the new-material form when Diamant is selected. Stored product facts, identities and original-source metadata are included in complete backups; previews are bundled with the application.

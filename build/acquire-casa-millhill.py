"""Acquire the public Casa Cenina Mill Hill bead articles and photos for offline use.

Requests identify the importer, run one at a time and stop at the first refusal.
Responses are cached under ignored .runtime, so a run can resume. Each article and its
photo come from its own listing card; a sold-out card has no line, so that comes from
the article's own page. The sitemap then shows any coded article the listing omits.
Nothing is guessed or generated.
"""
from pathlib import Path
import base64
import collections
import datetime
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
HOST = "www.casacenina.it"
LISTING = f"https://{HOST}/mill-hill/?filter_id=8&sort=2a&page="
CACHE = ROOT / ".runtime" / "casa-millhill"
CACHE.mkdir(parents=True, exist_ok=True)
PAUSE_SECONDS = 0.4
CARD = re.compile(r'^ href="(https://www\.casacenina\.it/mill-hill/([^"/]+)\.html)"><div class="c-boxt"><img\b[^>]*data-src="([^"]+)"[^>]*alt="([^"]*)"')
CARD_LINE = re.compile(r'item_brand:"Mill Hill",item_category:"([^"]*)"')
ARTICLE = re.compile(r"/packshot/(\d+)/")
PAGE_IMAGE = re.compile(r'<img\b[^>]*data-src="(https://www\.casacenina\.it/catalog/images/[^"]+)"[^>]*alt="([^"]*)"[^>]*id="img-prodotto"')
CRUMBS = re.compile(r'<a href="https://www\.casacenina\.it/[^"]*" class="yspot">([^<]*)</a>')
BEADS_SECTION = "Charms, Perline, Bottoni"
# Out of production and absent from Casa Cenina: the photo, when one exists, comes from the page declaring it.
OUT_OF_PRODUCTION = json.loads((ROOT / "data" / "mill-hill-out-of-production.json").read_text(encoding="utf-8"))
ALLOWED_HOSTS = {HOST, *(urllib.parse.urlparse(row["image"]).hostname for row in OUT_OF_PRODUCTION if row["image"])}


def fetch(url, path, limit):
    if path.exists():
        return path.read_bytes()
    if urllib.parse.urlparse(url).hostname not in ALLOWED_HOSTS:
        raise ValueError(f"Unexpected host: {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "Ricamo offline catalogue preview reference"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if urllib.parse.urlparse(response.url).hostname not in ALLOWED_HOSTS:
                raise ValueError(f"Unexpected redirect: {response.url}")
            raw = response.read(limit + 1)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        print(json.dumps({"stoppedAt": url, "status": error.code}))
        sys.exit(2)
    if len(raw) > limit:
        raise ValueError(f"Response too large: {url}")
    path.write_bytes(raw)
    time.sleep(PAUSE_SECONDS)
    return raw


def clean(value):
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def page_facts(url, slug):
    page = fetch(url, CACHE / f"page-{slug}.html", 1_000_000)
    text = page.decode("utf-8", "replace") if page else ""
    return [clean(crumb) for crumb in CRUMBS.findall(text)], PAGE_IMAGE.search(text)


cards = {}
for number in range(1, 100):
    page = fetch(f"{LISTING}{number}", CACHE / f"list-{number}.html", 3_000_000)
    fresh = 0
    # Each card ends where the next begins, so a sold-out card cannot borrow its neighbour's data.
    for card in (page.decode("utf-8", "replace") if page else "").split('<a class="bspot"')[1:]:
        match = CARD.match(card)
        if not match:
            raise ValueError(f"Unreadable card on page {number}")
        url, slug, image, name = match.groups()
        if url in cards:
            continue
        line = CARD_LINE.search(card)
        cards[url] = {"url": url, "slug": slug, "image": image, "name": clean(name), "article": ARTICLE.search(image).group(1), "line": clean(line.group(1)) if line else ""}
        fresh += 1
    if not fresh:
        break
pages = number - 1
sold_out = [row for row in cards.values() if not row["line"]]
for row in sold_out:
    crumbs, _ = page_facts(row["url"], row["slug"])
    if not crumbs or crumbs[0] != BEADS_SECTION:
        raise ValueError(f"No line on the page of a listed article: {row['url']} {crumbs}")
    row["line"] = crumbs[-1]

site = set()
for number in (1, 2):
    sitemap = fetch(f"https://{HOST}/sitemap_ita{number}.xml", CACHE / f"sitemap-{number}.xml", 60_000_000)
    site |= set(re.findall(rf"<loc>(https://{re.escape(HOST)}/mill-hill/\d{{5}}[^<]*\.html)</loc>", sitemap.decode("utf-8", "replace")))
unlisted, rejected = 0, []
for url in sorted(site - set(cards)):
    slug = url.rsplit("/", 1)[1][:-5]
    crumbs, image = page_facts(url, slug)
    if not image or not crumbs or crumbs[0] != BEADS_SECTION:
        rejected.append({"url": url, "crumbs": crumbs})
        continue
    cards[url] = {"url": url, "slug": slug, "image": image.group(1), "name": clean(image.group(2)), "article": ARTICLE.search(image.group(1)).group(1), "line": crumbs[-1]}
    unlisted += 1
print(json.dumps({"pages": pages, "cards": len(cards), "soldOut": len(sold_out), "unlisted": unlisted, "rejected": rejected[:12], "rejectedCount": len(rejected), "lines": collections.Counter(row["line"] for row in cards.values()).most_common()}, ensure_ascii=False))
if not 800 <= len(cards) <= 1400:
    raise ValueError(f"Unexpected Mill Hill article count: {len(cards)}")

# Lines keep the names already used by the catalogue, so one article never gets two identities.
LINE_NAMES = {"Bugle Glass Beads": "Bugle Beads", "Mill Hill: Bottoni": "Bottoni", "La nostra selezione": "Bells"}
retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
images, by_code, by_url, products, evidence, missing = {}, {}, {}, [], [], []
for row in cards.values():
    match = re.match(r"(\d{5})\b\s*-?\s*(.*)$", row["name"])
    code, colour = (match.group(1), match.group(2).strip()) if match else ("", row["name"])
    if match and not row["slug"].startswith(code):
        raise ValueError(f"Code differs from its page: {row['url']}")
    line = LINE_NAMES.get(row["line"], row["line"])
    image = fetch(row["image"], CACHE / f"{row['article']}.image", 400_000)
    if not image:
        missing.append(row["url"])
        continue
    if image.startswith(b"\xff\xd8"):
        mime = "image/jpeg"
    elif image.startswith(b"\x89PNG"):
        mime = "image/png"
    elif image.startswith(b"GIF8"):
        mime = "image/gif"
    elif image.startswith(b"RIFF"):
        mime = "image/webp"
    else:
        raise ValueError(f"Unsupported image format: {row['url']}")
    digest = hashlib.sha256(image).hexdigest()
    images[digest] = "data:" + mime + ";base64," + base64.b64encode(image).decode("ascii")
    by_url[row["url"]] = digest
    if code:
        by_code[code] = digest
    products.append({
        "id": f"casa-mh-{row['article']}", "supplier": "casa-cenina", "category": "embellishment",
        "type": "button" if line == "Bottoni" else "charm" if line == "Bells" else "bead",
        "brand": "Mill Hill", "range": line, "code": code, "name": colour or row["name"], "colorName": colour,
        "url": row["url"], "sourceUrl": "https://www.casacenina.it/mill-hill/?filter_id=8", "retrievedAt": retrieved_at,
        "verification": "listing-card", "pack": {"unit": "pack"},
    })
    evidence.append({"code": code, "line": row["line"], "productUrl": row["url"], "imageUrl": row["image"], "previewSha256": digest})

# Articles Casa Cenina no longer lists keep the photo already bundled from its former page.
LISTED_LINES = collections.defaultdict(collections.Counter)
for product in products:
    LISTED_LINES[product["code"][:2]][product["range"]] += 1
DECLARED_LINES = {row["code"]: row["line"] for row in OUT_OF_PRODUCTION}
former = json.loads((ROOT / "data" / "casa-product-preview-sources.json").read_text(encoding="utf-8"))["evidence"]
former_codes = set()
for row in former:
    match = re.search(r"/mill-hill/(\d{5})", row["productUrl"])
    if not match or match.group(1) in by_code or match.group(1) in former_codes:
        continue
    code = match.group(1)
    # A former page no longer names its line, so it takes the line of the codes sharing its prefix.
    line = DECLARED_LINES.get(code) or LISTED_LINES[code[:2]].most_common(1)[0][0]
    colour = re.sub(r"\s+", " ", re.sub(rf"^{code}\s*-?\s*", "", row["name"])).strip()
    colour = re.sub(r"\s*\(sostituito da \d+\)", "", colour)
    former_codes.add(code)
    products.append({
        "id": f"casa-mh-former-{code}", "supplier": "casa-cenina", "category": "embellishment", "type": "bead",
        "brand": "Mill Hill", "range": line, "code": code, "name": colour, "colorName": colour,
        "url": row["productUrl"], "sourceUrl": row["sourcePageUrl"], "retrievedAt": retrieved_at,
        "verification": "former-casa-page", "pack": {"unit": "pack"},
    })
    evidence.append({"code": code, "line": line, "productUrl": row["productUrl"], "imageUrl": row["imageUrl"], "previewSha256": row["sha256"]})

for row in OUT_OF_PRODUCTION:
    if row["code"] in by_code or row["code"] in former_codes:
        continue
    if row["image"]:
        image = fetch(row["image"], CACHE / f"out-of-production-{row['code']}.image", 400_000)
        digest = hashlib.sha256(image).hexdigest()
        images[digest] = "data:image/jpeg;base64," + base64.b64encode(image).decode("ascii")
        by_code[row["code"]] = digest
        evidence.append({"code": row["code"], "line": row["line"], "productUrl": row["page"], "imageUrl": row["image"], "previewSha256": digest})
    products.append({
        "id": f"casa-mh-oop-{row['code']}", "supplier": "casa-cenina", "category": "embellishment", "type": "bead",
        "brand": "Mill Hill", "range": row["line"], "code": row["code"], "name": row["colour"], "colorName": row["colour"],
        "url": "https://www.casacenina.it/mill-hill/?filter_id=8", "sourceUrl": "https://www.casacenina.it/mill-hill/?filter_id=8", "retrievedAt": retrieved_at,
        "verification": "other-shop-page", "pack": {"unit": "pack"},
    })

if len(by_code) + len(former_codes) + sum(1 for row in OUT_OF_PRODUCTION if not row["image"] and row["code"] not in former_codes and row["code"] not in by_code) != sum(1 for product in products if product["code"]):
    raise ValueError("A Mill Hill code appears on two articles")
(ROOT / "data" / "mill-hill-catalogue.json").write_text(
    json.dumps({"format": "ricamo-mill-hill-catalogue", "version": 2, "retrievedAt": retrieved_at, "products": products}, ensure_ascii=False, indent=1) + "\n",
    encoding="utf-8",
)
(ROOT / "data" / "casa-millhill-preview-sources.json").write_text(
    json.dumps({"format": "ricamo-casa-millhill-previews", "version": 2, "retrievedAt": retrieved_at, "missing": missing, "rejected": rejected, "evidence": evidence}, ensure_ascii=False, indent=1) + "\n",
    encoding="utf-8",
)
(ROOT / "src" / "assets" / "mill-hill-previews.json").write_text(
    json.dumps({"images": images, "byCode": by_code, "byUrl": by_url}, separators=(",", ":")) + "\n", encoding="utf-8"
)
print(json.dumps({"products": len(products), "coded": len(by_code), "uniqueImages": len(images), "missing": missing, "bytes": sum(map(len, images.values()))}))

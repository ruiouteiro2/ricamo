"""Acquire the public Casa Cenina Mill Hill bead articles and photos for offline use.

Requests identify the importer, run one at a time and stop at the first refusal.
Responses are cached under ignored .runtime, so a run can resume. Each article, its
line and its photo come from the same listing card: nothing is guessed or generated.
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
CARD = re.compile(
    r'<a class="bspot" href="(https://www\.casacenina\.it/mill-hill/([^"/]+)\.html)">\s*<div class="c-boxt"><img\b[^>]*data-src="([^"]+)"[^>]*alt="([^"]*)"'
    r'.*?item_id:"(\d+)",item_name:"[^"]*",item_brand:"Mill Hill",item_category:"([^"]*)"',
    re.S,
)


def fetch(url, path, limit):
    if path.exists():
        return path.read_bytes()
    if urllib.parse.urlparse(url).hostname != HOST:
        raise ValueError(f"Unexpected host: {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "Ricamo offline catalogue preview reference"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if urllib.parse.urlparse(response.url).hostname != HOST:
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


cards = {}
for number in range(1, 100):
    page = fetch(f"{LISTING}{number}", CACHE / f"list-{number}.html", 3_000_000)
    found = CARD.findall(page.decode("utf-8", "replace")) if page else []
    fresh = [card for card in found if card[0] not in cards]
    if not fresh:
        break
    for url, slug, image, name, article, line in fresh:
        cards[url] = {"url": url, "slug": slug, "image": image, "name": re.sub(r"\s+", " ", html.unescape(name)).strip(), "article": article, "line": html.unescape(line).strip()}
pages = number - 1
print(json.dumps({"pages": pages, "cards": len(cards), "lines": collections.Counter(row["line"] for row in cards.values()).most_common()}, ensure_ascii=False))
if not 650 <= len(cards) <= 850:
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

if len(by_code) != sum(1 for product in products if product["code"]):
    raise ValueError("A Mill Hill code appears on two articles")
(ROOT / "data" / "mill-hill-catalogue.json").write_text(
    json.dumps({"format": "ricamo-mill-hill-catalogue", "version": 1, "retrievedAt": retrieved_at, "products": products}, ensure_ascii=False, indent=1) + "\n",
    encoding="utf-8",
)
(ROOT / "data" / "casa-millhill-preview-sources.json").write_text(
    json.dumps({"format": "ricamo-casa-millhill-previews", "version": 1, "retrievedAt": retrieved_at, "missing": missing, "evidence": evidence}, ensure_ascii=False, indent=1) + "\n",
    encoding="utf-8",
)
(ROOT / "src" / "assets" / "mill-hill-previews.json").write_text(
    json.dumps({"images": images, "byCode": by_code, "byUrl": by_url}, separators=(",", ":")) + "\n", encoding="utf-8"
)
print(json.dumps({"products": len(products), "coded": len(by_code), "uniqueImages": len(images), "missing": missing, "bytes": sum(map(len, images.values()))}))

"""Acquire the public Casa Cenina photos of Profilo 6 Mouliné articles for offline previews.

Requests identify the importer, run one at a time and stop at the first refusal.
Responses are cached under ignored .runtime, so a run can resume. Each photo must be
labelled with its own article code on its own page: no photo is guessed or generated.
"""
from pathlib import Path
import base64
import datetime
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
HOST = "www.casacenina.it"
IMAGE_PREFIX = f"https://{HOST}/catalog/images/"
CACHE = ROOT / ".runtime" / "casa-profilo"
CACHE.mkdir(parents=True, exist_ok=True)
PAUSE_SECONDS = 0.4


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


supplement = json.loads((ROOT / "data" / "casa-supplier-supplement.json").read_text(encoding="utf-8"))
products = [row for row in supplement["products"] if row["brand"] == "Profilo"]
if not 390 <= len(products) <= 410:
    raise ValueError(f"Unexpected Profilo article count: {len(products)}")

images, by_code, evidence, missing = {}, {}, [], []
for product in products:
    code = product["code"]
    page = fetch(product["url"].replace("casacenina.com", "casacenina.it"), CACHE / f"{code}.html", 1_000_000)
    text = page.decode("utf-8", "replace") if page else ""
    match = re.search(rf'<img\b[^>]*data-src="({re.escape(IMAGE_PREFIX)}[^"]+)"[^>]*alt="Mouliné Profilo {code}"[^>]*>', text)
    if not match:
        missing.append(code)
        continue
    image_url = match.group(1)
    image = fetch(image_url, CACHE / f"{code}.image", 400_000)
    if not image:
        missing.append(code)
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
        raise ValueError(f"Unsupported image format: {code}")
    digest = hashlib.sha256(image).hexdigest()
    images[digest] = "data:" + mime + ";base64," + base64.b64encode(image).decode("ascii")
    by_code[code] = digest
    equivalent = re.search(r"Equivalente DMC:\s*([0-9A-Za-z]+)", re.sub(r"<[^>]+>", " ", text))
    evidence.append({"code": code, "productUrl": product["url"], "imageUrl": image_url, "previewSha256": digest, "dmcEquivalent": equivalent.group(1) if equivalent else None})

retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
(ROOT / "data" / "casa-profilo-preview-sources.json").write_text(
    json.dumps({"format": "ricamo-casa-profilo-previews", "version": 1, "retrievedAt": retrieved_at, "missing": missing, "evidence": evidence}, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
(ROOT / "src" / "assets" / "profilo-previews.json").write_text(
    json.dumps({"images": images, "byCode": by_code}, separators=(",", ":")) + "\n", encoding="utf-8"
)
shared = {digest: [code for code, value in by_code.items() if value == digest] for digest in images}
print(json.dumps({"articles": len(products), "previewed": len(by_code), "uniqueImages": len(images), "missing": missing, "bytes": sum(map(len, images.values())), "shared": [codes for codes in shared.values() if len(codes) > 1][:8], "withEquivalent": sum(1 for row in evidence if row["dmcEquivalent"])}))

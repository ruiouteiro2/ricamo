"""Acquire the official DMC Laine Colbert variants and offline swatch previews.

Downloaded responses are cached under ignored .runtime. The committed output keeps
only bounded catalogue facts and small manufacturer swatch images.
"""
from pathlib import Path
import base64
import concurrent.futures
import datetime
import hashlib
import json
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PAGE_URL = "https://www.dmc.com/FR/fr/products/dmc-wool-tapestry/colbert-wool"
DATA_URL = "https://www.dmc.com/FR/fr/api/quilt/products/colbert-wool/product_data"
CACHE = ROOT / ".runtime" / "dmc-colbert"
CACHE.mkdir(parents=True, exist_ok=True)


def fetch(url, path, limit, hosts):
    if path.exists():
        return path.read_bytes()
    request = urllib.request.Request(
        url, headers={"User-Agent": "Ricamo catalogue reference research"}
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        host = urllib.parse.urlparse(response.url).hostname
        if host not in hosts:
            raise ValueError(f"Unexpected source host: {host}")
        raw = response.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("Source response too large")
    path.write_bytes(raw)
    return raw


raw = fetch(DATA_URL, CACHE / "product-data.json", 8_000_000, {"www.dmc.com"})
payload = json.loads(raw)
variants = payload.get("variants", [])
if not 390 <= len(variants) <= 500:
    raise ValueError(f"Unexpected Colbert variant count: {len(variants)}")

seen = set()
entries = []
for variant in variants:
    colour = variant.get("colour") or {}
    code = str(colour.get("code") or "").strip()
    name = str(
        colour.get("presentation")
        or (colour.get("colourGroup") or {}).get("presentation")
        or f"Colore {code}"
    ).strip()
    swatch = str(colour.get("swatch") or "").strip()
    if not code or len(code) > 30 or not name or len(name) > 200:
        raise ValueError("Invalid Colbert colour metadata")
    if code in seen:
        raise ValueError(f"Duplicate Colbert code: {code}")
    seen.add(code)
    if urllib.parse.urlparse(swatch).hostname != "quilt-public-production.s3.eu-west-1.amazonaws.com":
        raise ValueError("Unexpected Colbert swatch host")
    entries.append((code, name, swatch, variant))

retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()


def acquire(entry):
    code, colour_name, swatch_url, variant = entry
    image = fetch(
        swatch_url,
        CACHE / f"{code}.image",
        1_000_000,
        {"quilt-public-production.s3.eu-west-1.amazonaws.com"},
    )
    if image.startswith(b"\xff\xd8"):
        mime = "image/jpeg"
    elif image.startswith(b"\x89PNG"):
        mime = "image/png"
    elif image.startswith(b"RIFF"):
        mime = "image/webp"
    else:
        raise ValueError(f"Unsupported Colbert swatch format: {code}")
    identity = f"dmc:colbert:{code}"
    product = {
        "id": identity,
        "supplier": "dmc",
        "category": "thread",
        "type": "wool",
        "brand": "DMC",
        "range": "Laine Colbert",
        "code": code,
        "name": f"DMC Laine Colbert {code}",
        "colorName": colour_name,
        "hex": None,
        "rgbSource": None,
        "url": PAGE_URL,
        "sourceUrl": PAGE_URL,
        "retrievedAt": retrieved_at,
        "verification": "manufacturer-product-data",
        "pack": {"unit": "skein", "lengthM": 8},
        "suitability": "embroidery-declared",
    }
    evidence = {
        "id": identity,
        "variantId": variant.get("id"),
        "sku": variant.get("sku"),
        "sourceImageUrl": swatch_url,
        "previewSha256": hashlib.sha256(image).hexdigest(),
    }
    preview = "data:" + mime + ";base64," + base64.b64encode(image).decode("ascii")
    return product, evidence, preview


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    acquired = list(pool.map(acquire, entries))

report = {
    "format": "ricamo-official-dmc-colbert",
    "version": 1,
    "retrievedAt": retrieved_at,
    "sourceUrl": DATA_URL,
    "productUrl": PAGE_URL,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "coverage": f"{len(acquired)} official Colbert variants exposed by the manufacturer product-data endpoint.",
    "products": [row for row, _, _ in acquired],
    "evidence": [proof for _, proof, _ in acquired],
}
(ROOT / "data" / "dmc-colbert-catalogue.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
(ROOT / "src" / "assets" / "dmc-colbert-previews.json").write_text(
    json.dumps({row["id"]: preview for row, _, preview in acquired}, separators=(",", ":")) + "\n",
    encoding="utf-8",
)
print(
    json.dumps(
        {
            "variants": len(acquired),
            "previewBytes": sum((CACHE / f"{row['code']}.image").stat().st_size for row, _, _ in acquired),
        }
    )
)

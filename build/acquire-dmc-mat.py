"""Acquire the official DMC Coton Retors Mat variants and offline swatch previews.

Downloaded responses are cached under ignored .runtime. The committed output keeps
only bounded catalogue facts and small manufacturer swatch images.
"""
from pathlib import Path
import base64
import concurrent.futures
import datetime
import hashlib
import json
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PAGE_URL = "https://www.dmc.com/IT/it/products/dmc-wool-tapestry/retors-mat-cotton"
DATA_URL = "https://www.dmc.com/IT/it/api/quilt/products/retors-mat-cotton/product_data"
SWATCH_HOST = "quilt-public-production.s3.eu-west-1.amazonaws.com"
CACHE = ROOT / ".runtime" / "dmc-mat"
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
if not 250 <= len(variants) <= 400:
    raise ValueError(f"Unexpected Retors Mat variant count: {len(variants)}")
options = {row["id"]: row for row in payload.get("optionValues", [])}

seen = set()
entries = []
skipped = []
for variant in variants:
    match = re.fullmatch(r"89-E_(.+)", str(variant.get("sku") or ""))
    if not match:
        raise ValueError(f"Unexpected Retors Mat SKU: {variant.get('sku')}")
    colour = variant.get("colour") or {}
    code = str(colour.get("code") or "").strip()
    swatch = str(colour.get("swatch") or "").strip()
    # The manufacturer lists some variants without colour data; never guess their swatch.
    if not code or not swatch:
        skipped.append(variant.get("sku"))
        continue
    if code != match.group(1) or len(code) > 30:
        raise ValueError(f"Retors Mat code mismatch: {variant.get('sku')}")
    if code in seen:
        raise ValueError(f"Duplicate Retors Mat code: {code}")
    seen.add(code)
    if urllib.parse.urlparse(swatch).hostname != SWATCH_HOST:
        raise ValueError("Unexpected Retors Mat swatch host")
    values = [options[value] for value in variant.get("optionValueIds", []) if value in options]
    length = next((row["presentation"] for row in values if row["optionTypeID"] == 3), "")
    if not re.fullmatch(r"\d+m", length):
        raise ValueError(f"Unexpected Retors Mat length: {variant.get('sku')}")
    entries.append((code, str(colour.get("presentation") or f"Colore {code}").strip(), swatch, int(length[:-1]), variant))

retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()


def acquire(entry):
    code, colour_name, swatch_url, length, variant = entry
    image = fetch(swatch_url, CACHE / f"{code}.image", 1_000_000, {SWATCH_HOST})
    if image.startswith(b"\xff\xd8"):
        mime = "image/jpeg"
    elif image.startswith(b"\x89PNG"):
        mime = "image/png"
    elif image.startswith(b"RIFF"):
        mime = "image/webp"
    else:
        raise ValueError(f"Unsupported Retors Mat swatch format: {code}")
    identity = f"dmc:mat:{code}"
    product = {
        "id": identity,
        "supplier": "dmc",
        "category": "thread",
        "type": "thread",
        "brand": "DMC",
        "range": "Coton Retors Mat",
        "code": code,
        "name": f"DMC Coton Retors Mat {code}",
        "colorName": colour_name,
        "hex": None,
        "rgbSource": None,
        "url": PAGE_URL,
        "sourceUrl": PAGE_URL,
        "retrievedAt": retrieved_at,
        "verification": "manufacturer-product-data",
        "pack": {"unit": "skein", "lengthM": length, "strands": 1, "divisible": False},
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
    "format": "ricamo-official-dmc-mat",
    "version": 1,
    "retrievedAt": retrieved_at,
    "sourceUrl": DATA_URL,
    "productUrl": PAGE_URL,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "coverage": f"{len(acquired)} official Coton Retors Mat variants with a colour and swatch; {len(skipped)} listed without colour data are excluded.",
    "products": [row for row, _, _ in acquired],
    "evidence": [proof for _, proof, _ in acquired],
}
(ROOT / "data" / "dmc-mat-catalogue.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
(ROOT / "src" / "assets" / "dmc-mat-previews.json").write_text(
    json.dumps({row["id"]: preview for row, _, preview in acquired}, separators=(",", ":")) + "\n",
    encoding="utf-8",
)
print(json.dumps({"variants": len(acquired), "skipped": skipped, "bytes": sum(len(preview) for _, _, preview in acquired)}))

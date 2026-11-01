"""Offline catalogue facts from official Madeira PDFs; optional dependency PyMuPDF.
Run from the repository root. Downloaded source PDFs stay under ignored .runtime.
"""
from pathlib import Path
import datetime, hashlib, json, re, urllib.request
import fitz
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.runtime' / 'madeira'
CACHE.mkdir(parents=True, exist_ok=True)
BASE = 'https://www.madeira.com/fileadmin/user_upload/Downloads/Shade_Cards/'
HOME = 'https://www.madeira.com/it-it/materiali-da-ricamo/filati-industriali/metallizzati'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
products, evidence, sources = [], [], []
for filename, pages in [('MADEIRA_METALLICS.pdf', range(3, 10)), ('MADEIRA_CR.pdf', [4, 5])]:
    path = CACHE / filename
    if not path.exists():
        with urllib.request.urlopen(BASE + filename, timeout=50) as response:
            raw = response.read(25000001)
            if len(raw) > 25000000 or not raw.startswith(b'%PDF'): raise ValueError('Invalid source PDF')
            path.write_bytes(raw)
    document = fitz.open(path)
    sources.append({'url': BASE + filename, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'pages': len(document)})
    for page_number in pages:
        page = document[page_number - 1]
        words = page.get_text('words')
        codes = [word for word in words if re.fullmatch(r'\d{2,4}', word[4]) and 75 < word[1] < 565 and 90 < word[0] < 245 and any(abs(word[0] - x) < tolerance for x, tolerance in [(104,4),(239,5),(93.5,3),(230,4)])]
        for word in codes:
            x, y, _, _, code, *_ = word
            if filename == 'MADEIRA_CR.pdf':
                size = '20' if code.startswith('2') else '40'
                range_name = 'CR Metallic ' + size
            elif page_number == 3:
                size = '50' if code.startswith('5') else '40'
                range_name = 'FS ' + size
            elif page_number == 4: size, range_name = '30', 'FS 30'
            elif page_number == 5: size, range_name = '20', 'FS 20'
            else: size, range_name = '30', 'Supertwist 30'
            next_y = min([other[1] for other in codes if abs(other[0] - x) < 4 and other[1] > y + 2] + [564])
            label_words = sorted([other for other in words if x - 1 <= other[0] < x + 56 and y + 8 < other[1] < next_y - 2], key=lambda other: (round(other[1]), other[0]))
            color_name = ' '.join(other[4] for other in label_words).strip()
            if not color_name: raise ValueError('Missing colour name ' + code)
            # Mean of a central thread-swatch patch; this is NOT a measured physical RGB.
            box = fitz.Rect(x - 58, y + 5, x - 20, min(y + 18, next_y - 3))
            pix = page.get_pixmap(matrix=fitz.Matrix(2,2), clip=box, colorspace=fitz.csRGB, alpha=False)
            samples = pix.samples
            rgb = [round(sum(samples[channel::3]) / (len(samples) // 3)) for channel in range(3)]
            hex_color = '#' + ''.join(f'{value:02x}' for value in rgb)
            source_url = BASE + filename + '#page=' + str(page_number)
            identity = 'madeira:' + range_name.lower().replace(' ', '-') + ':' + code
            products.append({'id':identity, 'supplier':'madeira', 'category':'thread', 'type':'metallic', 'brand':'Madeira', 'range':range_name, 'code':code, 'name':f'Madeira {range_name} {code} - {color_name}', 'colorName':color_name, 'hex':hex_color, 'rgbSource':{'kind':'approximate','sourceUrl':source_url,'label':'Indicative digital average from the official Madeira shade card; metallic sheen and multicolour effects cannot be reproduced by one RGB.'}, 'colorVariation':'multicolour' if filename == 'MADEIRA_METALLICS.pdf' and page_number == 8 and x < 150 else None, 'url':HOME, 'sourceUrl':source_url, 'retrievedAt':now, 'verification':'manufacturer-shade-card', 'pack':{}, 'suitability':'verify-technique'})
            evidence.append({'id':identity,'pdf':filename,'page':page_number,'codeBox':[round(value,3) for value in word[:4]],'sampleBox':[round(value,3) for value in box],'threadSize':size})
assert len(products) == 255 and len({row['id'] for row in products}) == 255
report = {'format':'ricamo-madeira-official-snapshot','version':1,'retrievedAt':now,'home':'https://www.madeira.com/it-it/','sources':sources,'products':products,'evidence':evidence}
(ROOT / 'data' / 'madeira-metallic-catalogue.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'products':len(products),'ranges':{name:sum(row['range']==name for row in products) for name in sorted({row['range'] for row in products})}}))

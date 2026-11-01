# Public Casa Cenina catalogue facts and cover previews only; no chart instructions.
# Optional research dependency: pip install --target .runtime/research-libs beautifulsoup4
import sys, json, re, time, hashlib, base64, urllib.request, urllib.parse, concurrent.futures
from pathlib import Path
sys.path.insert(0,str(Path('.runtime/research-libs').resolve()))
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent; CACHE=ROOT/'.runtime/chart-catalogue'; CACHE.mkdir(parents=True,exist_ok=True)
IMAGES=CACHE/'previews'; IMAGES.mkdir(parents=True,exist_ok=True)
HEADERS={'User-Agent':'Ricamo catalogue research (offline inventory preview)'}
BRANDS=[('mirabilia','Mirabilia','mirabilia-design-nora-corbett'),('bella-filipina','Bella Filipina','bella-filipina')]
failures=[]
def fetch(url, kind='html'):
 key=hashlib.sha256(url.encode()).hexdigest();path=CACHE/(key+'.'+kind)
 if path.exists():return path.read_bytes()
 error=None
 for attempt in range(2):
  try:
   request=urllib.request.Request(url,headers=HEADERS)
   with urllib.request.urlopen(request,timeout=20) as response:
    data=response.read(3_000_001)
    if len(data)>3_000_000:raise ValueError('Response too large')
    if urllib.parse.urlparse(response.url).hostname not in ['www.casacenina.it','casacenina.it']:raise ValueError('Unexpected redirect')
   path.write_bytes(data);time.sleep(.12);return data
  except Exception as e:error=e;time.sleep(.5)
 raise error

def soupof(data):
 try:text=data.decode('utf-8')
 except UnicodeDecodeError:text=data.decode('cp1252',errors='replace')
 return BeautifulSoup(text,'html.parser')
rows={};evidence=[]
for brandId,brand,slug in BRANDS:
 pending={1};seen=set();urls=[]
 while pending:
  page=min(pending);pending.remove(page)
  if page in seen:continue
  if page>40:raise ValueError('Unexpected page bound')
  url=f'https://www.casacenina.it/{slug}/?filter_id=5&sort=2a&page={page}'
  try:soup=soupof(fetch(url))
  except Exception as e:failures.append({'url':url,'error':str(e)});continue
  seen.add(page);urls.append(url)
  for a in soup.select('a.bspot[href]'):
   link=a['href'];img=a.select_one('img');title=img.get('alt','').strip() if img else ''
   prefixes=[f'https://www.casacenina.it/{slug}/']+(['https://www.casacenina.it/mirabilia-design/'] if brandId=='mirabilia' else [])
   if not any(link.startswith(prefix) for prefix in prefixes) or not link.endswith('.html') or not title:continue
   box=a.find_parent(class_='c-box');button=box.select_one('[id^="add_prod_"]') if box else None
   sourceId=button['id'].replace('add_prod_','') if button else hashlib.sha256(link.encode()).hexdigest()[:16]
   rows[link]={'id':f'{brandId}:{sourceId}','brandId':brandId,'brand':brand,'name':title,'sourceUrl':link,'sourceId':sourceId,'previewSource':img.get('data-src') or img.get('src')}
  for a in soup.select('a[href]'):
   parsed=urllib.parse.urlparse(a['href']);q=urllib.parse.parse_qs(parsed.query)
   if parsed.path==f'/{slug}/' and 'page' in q:
    p=int(q['page'][0]);
    if p not in seen:pending.add(p)
  print(f'Listing {brand}: page {page}, unique products {sum(r["brandId"]==brandId for r in rows.values())}',flush=True)
 evidence.append({'brandId':brandId,'listingPages':urls,'pages':len(seen)})
(ROOT/'.runtime/chart-listings.json').write_text(json.dumps(list(rows.values()),ensure_ascii=False,indent=2),encoding='utf-8')

def detail(row):
 row=dict(row);row.update({'widthCm':None,'heightCm':None,'stitchesWidth':None,'stitchesHeight':None,'sizeNote':None,'previewFile':None})
 try:
  soup=soupof(fetch(row['sourceUrl']));h1=soup.select_one('h1')
  if h1:row['name']=h1.get_text(' ',strip=True)
  texts=[]
  for script in soup.select('script[type="application/ld+json"]'):
   try:
    value=json.loads(script.string or script.get_text());values=value if isinstance(value,list) else [value]
    for item in values:
     if item.get('@type')=='Product':texts.append(BeautifulSoup(item.get('description',''),'html.parser').get_text(' ',strip=True))
   except Exception:pass
  region=' '.join(str(node).strip() for node in h1.find_all_next(string=True) if node.parent.name not in ['script','style'] and str(node).strip()) if h1 else ''
  for marker in ['Scorrendo la pagina','Al momento non vi sono commenti','Lista dei Materiali']:
   region=region.split(marker)[0]
  texts.append(region[:6500]);text=' '.join(texts)
  number=r'(\d+(?:[.,]\d+)?)'
  cm=re.search(r'cm\.?\s*'+number+r'\s*[xX\u00d7]\s*'+number,text,re.I) or re.search(number+r'\s*cm\.?\s*[xX\u00d7]\s*'+number+r'\s*(?:cm)?',text,re.I) or re.search(number+r'\s*[xX\u00d7]\s*'+number+r'\s*cm',text,re.I)
  if cm:
   w,h=(float(n.replace(',','.')) for n in cm.groups())
   if 0<w<3000 and 0<h<3000:row['widthCm']=w;row['heightCm']=h;row['sizeNote']=text[max(0,cm.start()-70):cm.end()+35].strip()
  stitches=re.search(r'(?:punti|stitch(?:es)?\s*(?:count|size)?|design\s*size)[^\d]{0,10}(\d{1,4})\s*(?:[wW]\s*)?(?:[xX\u00d7]|by)\s*(\d{1,4})',text,re.I)
  if stitches:row['stitchesWidth']=int(stitches.group(1));row['stitchesHeight']=int(stitches.group(2))
  row['detailFetched']=True
 except Exception as e:row['detailFetched']=False;row['detailError']=str(e)
 image=row.get('previewSource')
 if image and image.startswith('https://www.casacenina.it/catalog/images/'):
  try:
   raw=fetch(image,'image');ext='.jpg' if raw.startswith(b'\xff\xd8') else '.png' if raw.startswith(b'\x89PNG') else '.webp' if raw.startswith(b'RIFF') and raw[8:12]==b'WEBP' else None
   if not ext:raise ValueError('Unsupported preview format')
   name=row['id'].replace(':','-')+ext;(IMAGES/name).write_bytes(raw);row['previewFile']=name;row['previewSha256']=hashlib.sha256(raw).hexdigest()
  except Exception as e:row['previewError']=str(e)
 return row
out=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for row in pool.map(detail,list(rows.values())):
  out.append(row)
  if len(out)%20==0:print(f'Details and previews {len(out)}/{len(rows)}',flush=True)
out=list({row['id']:row for row in out}.values())
out.sort(key=lambda r:(r['brandId'],r['name'].casefold()))
report={'format':'ricamo-retailer-chart-catalogue','version':1,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'source':'Casa Cenina','scope':'All observed scheme listings for the two manufacturers, filter_id=5, alphabetical pagination','brands':evidence,'listingFailures':failures,'items':out}
previews={}
for row in out:
 if row['previewFile']:
  raw=(IMAGES/row['previewFile']).read_bytes();mime='image/jpeg' if raw.startswith(b'\xff\xd8') else 'image/png' if raw.startswith(b'\x89PNG') else 'image/webp'
  previews[row['previewFile']]='data:'+mime+';base64,'+base64.b64encode(raw).decode('ascii')
(ROOT/'src/assets/chart-previews.json').write_text(json.dumps(previews,separators=(',',':'))+'\n',encoding='utf-8')
(ROOT/'data/pattern-catalogue.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'items':len(out),'brands':{brand:sum(r['brandId']==brand for r in out)for brand,_,_ in BRANDS},'details':sum(r['detailFetched']for r in out),'previews':sum(bool(r['previewFile'])for r in out),'declaredCm':sum(r['widthCm'] is not None for r in out),'stitchCounts':sum(r['stitchesWidth']is not None for r in out),'listingFailures':failures}),flush=True)

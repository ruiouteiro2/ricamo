"""Official DMC Diamant reference facts and small product previews.
Optional maintainer dependency: BeautifulSoup in .runtime/research-libs.
Downloaded public HTML/images remain under ignored .runtime.
"""
from pathlib import Path
import base64, concurrent.futures, datetime, hashlib, json, re, sys, urllib.request, urllib.parse
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.runtime/research-libs'))
from bs4 import BeautifulSoup
URL='https://www.dmc.com/IT/it/products/metallic-thread/diamant'
CACHE=ROOT/'.runtime/dmc-diamant';CACHE.mkdir(parents=True,exist_ok=True)
def fetch(url,path,limit):
 if path.exists():return path.read_bytes()
 request=urllib.request.Request(url,headers={'User-Agent':'Ricamo catalogue reference research'})
 with urllib.request.urlopen(request,timeout=30)as response:
  if urllib.parse.urlparse(response.url).hostname not in ['www.dmc.com','dnwjchpclcsiy.cloudfront.net']:raise ValueError('Unexpected source host')
  raw=response.read(limit+1)
 if len(raw)>limit:raise ValueError('Source response too large')
 path.write_bytes(raw);return raw
# Reuse previously observed public response when available.
prior=ROOT/'.runtime/dmc-diamant.html'
raw=prior.read_bytes() if prior.exists() else fetch(URL,CACHE/'source.html',5000000)
(CACHE/'source.html').write_bytes(raw)
soup=BeautifulSoup(raw,'html.parser');text=soup.get_text(' ',strip=True)
assert '35 metri' in text and 'monocapo' in text
images=json.loads(soup.select_one('[data-images]')['data-images'])
variants=[]
for image in images:
 match=re.search(r'380-B_(D\d+)',image.get('alt',''))
 if match:variants.append((match.group(1),image))
assert len(variants)==14 and len({code for code,_ in variants})==14
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
def acquire(entry):
 code,image=entry;source=image['srcset']['512w']
 assert urllib.parse.urlparse(source).hostname=='dnwjchpclcsiy.cloudfront.net'
 data=fetch(source,CACHE/(code+'.image'),2000000)
 assert data.startswith(b'\xff\xd8') or data.startswith(b'\x89PNG') or data.startswith(b'RIFF')
 mime='image/jpeg' if data.startswith(b'\xff\xd8') else 'image/png' if data.startswith(b'\x89PNG') else 'image/webp'
 identity='dmc:diamant:'+code
 row={'id':identity,'supplier':'dmc','category':'thread','type':'metallic','brand':'DMC','range':'Diamant','code':code,'name':'DMC Diamant '+code,'colorName':'','hex':None,'rgbSource':None,'url':URL,'sourceUrl':URL,'retrievedAt':now,'verification':'manufacturer-product-page','pack':{'unit':'spool','lengthM':35,'strands':1,'divisible':False},'suitability':'embroidery-declared'}
 evidence={'id':identity,'variantId':image['variantId'],'sourceImageUrl':source,'previewSha256':hashlib.sha256(data).hexdigest()}
 return row,evidence,'data:'+mime+';base64,'+base64.b64encode(data).decode('ascii')
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:result=list(pool.map(acquire,variants))
report={'format':'ricamo-official-dmc-diamant','version':1,'retrievedAt':now,'sourceUrl':URL,'sourceSha256':hashlib.sha256(raw).hexdigest(),'coverage':'14 Diamant SKU image references in the observed page; page selector says 11 options and body describes 13 colours. No availability claim.','products':[row for row,_,_ in result],'evidence':[proof for _,proof,_ in result]}
(ROOT/'data/dmc-diamant-catalogue.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'src/assets/dmc-diamant-previews.json').write_text(json.dumps({row['id']:preview for row,_,preview in result},separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({'references':len(result),'previewBytes':sum(len((CACHE/(row['code']+'.image')).read_bytes())for row,_,_ in result)}))

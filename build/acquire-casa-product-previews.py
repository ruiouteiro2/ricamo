# Original public Casa Cenina product thumbnails; no generated or guessed photos.
import base64,concurrent.futures,datetime,hashlib,json,re,sys,time,urllib.request,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.runtime/research-libs'))
from bs4 import BeautifulSoup
CACHE=ROOT/'.runtime/casa-product-previews';CACHE.mkdir(parents=True,exist_ok=True)
REFERENCE='https://www.casacenina.it/fili-e-filati/dmc/dmc-mouline-coloris/'
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
def fetch(url,path,limit=600000):
 if path.exists():return path.read_bytes()
 if urllib.parse.urlparse(url).hostname!='www.casacenina.it':raise ValueError('Unexpected host')
 request=urllib.request.Request(url,headers={'User-Agent':'Ricamo offline catalogue preview reference'})
 with urllib.request.urlopen(request,timeout=20)as response:
  if urllib.parse.urlparse(response.url).hostname!='www.casacenina.it':raise ValueError('Unexpected redirect')
  data=response.read(limit+1)
 if len(data)>limit:raise ValueError('Response too large')
 path.write_bytes(data);return data
def decode(raw):
 try:return raw.decode('utf-8')
 except UnicodeDecodeError:return raw.decode('cp1252')
raw=fetch(REFERENCE,CACHE/'coloris.html',3000000)
soup=BeautifulSoup(decode(raw),'html.parser');text=soup.get_text(' ',strip=True)
assert '8 metri' in text and '6 capi' in text
photos={};coloris=[]
def observe(img,productUrl,pageUrl):
 source=img.get('data-src') or img.get('src','')
 if not source.startswith('https://www.casacenina.it/catalog/images/'):return
 if source.lower().endswith(('.svg',)):return
 photos.setdefault(productUrl,{'productUrl':productUrl,'imageUrl':source,'sourcePageUrl':pageUrl,'name':img.get('alt','')})
for img in soup.find_all('img'):
 a=img.find_parent('a',href=True)
 if not a or not re.search(r'/dmc/dmc-coloris-.+-45\d{2}\.html$',a['href']):continue
 name=img.get('alt','');match=re.search(r'\b(45\d{2})$',name)
 if not match:continue
 code=match.group(1);observe(img,a['href'],REFERENCE)
 coloris.append({'id':'casa-coloris-'+code,'supplier':'casa-cenina','category':'thread','type':'variegated','brand':'DMC','range':'Coloris','code':code,'name':name,'colorName':re.sub(r'^DMC Coloris\s*-\s*|\s*45\d{2}$','',name),'colorVariation':'multicolour','url':a['href'],'sourceUrl':REFERENCE,'retrievedAt':now,'verification':'retailer-category','pack':{'unit':'skein','lengthM':8,'strands':6,'divisible':True},'suitability':'embroidery-declared'})
assert len(coloris)==24 and len({p['code'] for p in coloris})==24
# Saved public chart component lists also identify the exact material thumbnail.
charts=json.loads((ROOT/'data/pattern-catalogue.json').read_text(encoding='utf-8'))
for chart in charts['items']:
 path=ROOT/'.runtime/chart-catalogue'/(hashlib.sha256(chart['sourceUrl'].encode()).hexdigest()+'.html')
 if not path.exists():continue
 page=decode(path.read_bytes())
 for fragment in re.findall(r'<tr\b[^>]*>.*?</tr>',page,re.S|re.I):
  if 'comp_id' not in fragment:continue
  tr=BeautifulSoup(fragment,'html.parser')
  for a in tr.select('a[href]'):
   img=a.find('img')
   if img and a['href']!=chart['sourceUrl']:observe(img,a['href'],chart['sourceUrl'])
# Restrict photos to inventory product categories, excluding chart covers.
photos={url:proof for url,proof in photos.items() if not any(part in url for part in ['/mirabilia','/bella-filipina/'])}
def acquire(proof):
 try:
  source=proof['imageUrl'];data=fetch(source,CACHE/(hashlib.sha256(source.encode()).hexdigest()+'.image'))
  mime='image/jpeg' if data.startswith(b'\xff\xd8') else 'image/png' if data.startswith(b'\x89PNG') else 'image/webp' if data.startswith(b'RIFF') else 'image/gif' if data.startswith(b'GIF8') else None
  if not mime:raise ValueError('Unsupported image')
  digest=hashlib.sha256(data).hexdigest();return {**proof,'sha256':digest,'size':len(data)},'data:'+mime+';base64,'+base64.b64encode(data).decode('ascii'),None
 except Exception as e:return proof,None,type(e).__name__+': '+str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=5)as pool:results=list(pool.map(acquire,photos.values()))
images={};byUrl={};evidence=[];failures=[]
for proof,uri,error in results:
 if error:failures.append({**proof,'error':error});continue
 images[proof['sha256']]=uri;byUrl[proof['productUrl']]=proof['sha256'];evidence.append(proof)
assert all(p['url'] in byUrl for p in coloris)
(ROOT/'src/assets/casa-product-previews.json').write_text(json.dumps({'images':images,'byUrl':byUrl},separators=(',',':'))+'\n',encoding='utf-8')
(ROOT/'data/casa-product-preview-sources.json').write_text(json.dumps({'version':1,'retrievedAt':now,'reference':REFERENCE,'referenceSha256':hashlib.sha256(raw).hexdigest(),'evidence':evidence,'failures':failures},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'data/dmc-coloris-catalogue.json').write_text(json.dumps({'version':1,'sourceUrl':REFERENCE,'retrievedAt':now,'products':sorted(coloris,key=lambda p:p['code'])},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'coloris':len(coloris),'productPhotos':len(byUrl),'uniqueImages':len(images),'imageBytes':sum(p['size'] for p in evidence),'failures':len(failures)}))

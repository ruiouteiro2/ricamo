# Reproduce factual component lists from the saved public Casa Cenina chart pages.
# No chart grids or instructions; unavailable shop items retain their stated Qty.
import json,re,hashlib,html,sys
from pathlib import Path
sys.path.insert(0,str(Path('.runtime/research-libs').resolve()))
from bs4 import BeautifulSoup
root=Path(__file__).resolve().parent.parent
catalogue=json.loads((root/'data/pattern-catalogue.json').read_text(encoding='utf-8'))
products=[]
for file in ['supplier-catalogue.json','casa-supplier-supplement.json']:
 products+=json.loads((root/'data'/file).read_text(encoding='utf-8'))['products']
legacy=json.loads((root/'data/casa-cenina-catalogue.json').read_text(encoding='utf-8'))
for p in legacy['fabrics']+legacy['materials']:
 products.append({**p,'pack':{'unit':'skein'} if p['brand']=='DMC' and p['range']=='Moulin\u00e9' else {'unit':'pack'} if p['category']=='embellishment' else {}})
# Casa Cenina serves the same product paths on its localized domains.
def key(url):return re.sub(r'^https://www\.casacenina\.(?:com|fr|es)/','https://www.casacenina.it/',url)
idx={key(p['url']):p for p in products}
result={'version':1,'source':'Casa Cenina component tables (retailer recommended purchasing quantities)','checkedAt':catalogue['checkedAt'],'charts':{}}
for item in catalogue['items']:
 path=root/'.runtime/chart-catalogue'/(hashlib.sha256(item['sourceUrl'].encode()).hexdigest()+'.html')
 if not path.exists():continue
 raw=path.read_bytes()
 try:page=raw.decode('utf-8')
 except UnicodeDecodeError:page=raw.decode('cp1252')
 rows=[]
 for fragment in re.findall(r'<tr\b[^>]*>.*?</tr>',page,re.S|re.I):
  if 'comp_id' not in fragment:continue
  tr=BeautifulSoup(fragment,'html.parser')
  cid=tr.select_one('input[name^=comp_id]')
  if not cid or cid.get('value')==item['sourceId']:continue
  cells=tr.find_all('td',recursive=False)
  if not cells:cells=tr.select('tr > td')
  links=tr.select('a[href]');a=next((a for a in links if a.get_text(strip=True)),None)
  if not a:continue
  url=a['href'];name=a.get_text(' ',strip=True)
  if not url.startswith('https://www.casacenina.it/'):continue
  field=tr.select_one('input[name^=buyqty]');value=None
  if field and field.get('type')=='number':value=field.get('value')
  elif field:
   cell=field.find_parent('td');strong=cell.find('strong') if cell else None
   if strong:value=strong.get_text(' ',strip=True)
  qty=float(value.replace(',','.')) if value and re.fullmatch(r'\d+(?:[.,]\d+)?',value.strip()) else None
  product=idx.get(key(url))
  slug=url.split('/')[3]
  brands={'dmc':'DMC','mill-hill':'Mill Hill','kreinik':'Kreinik','classic-colorworks':'Classic Colorworks','caron-collection':'Caron Collection','permin-of-copenhagen':'Permin','zweigart':'Zweigart','rainbow-gallery':'Rainbow Gallery','xjudesign':'xJuDesign','valdani':'Valdani','wichelt':'Wichelt','polstitches-designs':'Polstitches Designs','mani-di-donna':'Mani di Donna','picture-this-plus':'Picture This Plus','yli':'YLI','fabric-flair':'Fabric Flair','gloriana':'Gloriana'}
  # Qty is a count of retail articles/packs, not an invented bead/piece count.
  category='embellishment' if slug=='mill-hill' else 'thread' if slug in ['dmc','kreinik','classic-colorworks','caron-collection','rainbow-gallery','valdani','yli','gloriana'] else 'fabric' if any(word in name.lower() for word in ['lino','aida','linen','lugana','evenweave','belfast','cashel','jobelan']) else 'other'
  code=re.match(r'^(\d{5})(?:\s|[-])',name) if slug=='mill-hill' else None
  rows.append({'name':name,'url':url,'quantity':qty,'productId':product['id'] if product else None,'category':product['category'] if product else category,'brand':product['brand'] if product else brands.get(slug,''), 'range':product['range'] if product else '', 'code':product['code'] if product else code.group(1) if code else '', 'unit':(product.get('pack',{}).get('unit') or 'pack') if product else 'pack'})
 result['charts'][item['id']]={'sourceUrl':item['sourceUrl'],'htmlSha256':hashlib.sha256(raw).hexdigest(),'requirements':rows}
(root/'data/chart-supplies.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'charts':len(result['charts']),'withSupplies':sum(bool(x['requirements']) for x in result['charts'].values()),'components':sum(len(x['requirements']) for x in result['charts'].values()),'knownUnits':sum(bool(r['unit']) for x in result['charts'].values() for r in x['requirements'])}))

import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,writeFileSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {listPackage,extractFile,statFile} from '@electron/asar';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const asar=resolve(process.argv[2]||join(root,'release/win-unpacked/resources/app.asar'));
const installer=resolve(process.argv[3]||join(root,'release',`Ricamo-${manifest.version}-Windows-x64-Setup.exe`));
const output=join(root,'release',`Ricamo-${manifest.version}-release-manifest.json`);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=path=>relative(root,path).replaceAll('\\','/');
const internal=path=>join(...path.split('/'));
const read=path=>extractFile(asar,internal(path));
async function hashFile(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')}
const entries=listPackage(asar).map(path=>path.replace(/^\//,''));
const files=entries.filter(path=>!statFile(asar,internal(path)).files);
const packaged=JSON.parse(read('package.json'));
assert.equal(packaged.name,manifest.name);assert.equal(packaged.version,manifest.version);assert.equal(packaged.main,manifest.main);
for(const [name,version]of Object.entries(manifest.dependencies))assert.equal(packaged.dependencies[name],version);
for(const path of files)assert.ok(['LICENSE','THIRD-PARTY-NOTICES.md','package.json'].includes(path)||['core/','desktop/','dist/','data/','node_modules/'].some(prefix=>path.startsWith(prefix)),`Unexpected packaged file: ${path}`);

const sources={};
for(const folder of ['core','desktop','dist','data']){
  const expected={};
  function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile())expected[relative(join(root,folder),path).replaceAll('\\','/')]=digest(readFileSync(path));else throw Error('Unexpected source link: '+path)}}
  walk(join(root,folder));
  const actual=files.filter(path=>path.startsWith(folder+'/')).map(path=>path.slice(folder.length+1)).sort();
  assert.deepEqual(actual,Object.keys(expected).sort(),`Packaged ${folder} file set differs`);
  for(const [path,hash]of Object.entries(expected))assert.equal(digest(read(folder+'/'+path)),hash,`Packaged ${folder}/${path} differs`);
  sources[folder]={matchesWorkspace:true,files:expected};
}
for(const name of ['LICENSE','THIRD-PARTY-NOTICES.md'])assert.equal(digest(read(name)),digest(readFileSync(join(root,name))));

const packages=[];
for(const path of files.filter(path=>path.startsWith('node_modules/')&&path.endsWith('/package.json'))){
  const row=JSON.parse(read(path));if(!row.name||!row.version)continue;
  assert.ok(!row.os||(row.os.includes('win32')&&!row.os.includes('!win32'))||(!row.os.some(os=>!os.startsWith('!'))&&!row.os.includes('!win32')),`Non-Windows dependency: ${row.name}`);
  assert.ok(!row.cpu||row.cpu.includes('x64'),`Non-x64 dependency: ${row.name}`);
  const directory=path.slice(0,-'/package.json'.length);
  packages.push({name:row.name,version:row.version,declaredLicense:row.license??row.licenses??null,path,packageJsonSha256:digest(read(path)),notices:files.filter(file=>file.startsWith(directory+'/')&&!file.slice(directory.length+1).includes('/')&&/^(licen[cs]e|notice|copying)/i.test(file.slice(directory.length+1)))});
}
packages.sort((a,b)=>a.name.localeCompare(b.name));
assert.ok(packages.some(row=>row.name==='@napi-rs/canvas-win32-x64-msvc'),'Windows Canvas optional dependency is missing');
const notices=files.filter(path=>/(^|\/)(licen[cs]e[^/]*|notice[^/]*|copying[^/]*)$/i.test(path)).map(path=>({path,sha256:digest(read(path)),bytes:read(path).length}));
assert.ok(notices.length>0);
const distribution=dirname(dirname(asar));
const runtimeNotices=[];
for(const name of ['LICENSE.electron.txt','LICENSES.chromium.html']){const path=join(distribution,name);runtimeNotices.push({name,bytes:statSync(path).size,sha256:await hashFile(path)})}
const artifacts=[];
for(const path of [installer,asar,join(distribution,'Ricamo.exe')])artifacts.push({path:local(path),bytes:statSync(path).size,sha256:await hashFile(path)});
const report={format:'ricamo-release-manifest',formatVersion:1,createdAt:new Date().toISOString(),app:{name:manifest.name,version:manifest.version},target:{platform:'win32',arch:'x64'},git:{head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirtyFiles:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean)},artifacts,sources,packages,notices,runtimeNotices,scope:'Exact packaged file identity and declared dependency/license metadata. Functional, installer lifecycle, performance and printer evidence are recorded separately.'};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
writeFileSync(join(root,'release',`Ricamo-${manifest.version}-SHA256SUMS.txt`),artifacts.map(row=>`${row.sha256}  ${row.path.replace(/^release\//,'')}`).join('\n')+'\n');
console.log(JSON.stringify({output:local(output),version:manifest.version,packages:packages.length,notices:notices.length,artifacts,sourcesMatch:true,dirtyFiles:report.git.dirtyFiles.length},null,2));

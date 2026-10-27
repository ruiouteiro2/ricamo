import assert from 'node:assert/strict';
import {win32 as path} from 'node:path';
export function windowsPath(value){
  assert.equal(typeof value,'string');assert.match(value,/^[A-Za-z]:[\\/]/,'Only absolute local Windows paths are accepted');assert.ok(!/[\0\r\n"<>|?*]/.test(value),'Unsafe path');assert.ok(!value.slice(2).includes(':'),'Alternate data streams are forbidden');
  return path.normalize(value).replace(/[\\/]+$/,'').toLowerCase();
}
export function below(parent,child){const p=windowsPath(parent),c=windowsPath(child);return c.startsWith(p+'\\')}
export function fixturePaths(config){
  const runtime=path.join(config.repoRoot,'.runtime');for(const key of ['installDir','dataDir','runDir'])assert.ok(below(runtime,config[key]),key+' must be below repository .runtime');
  for(const[a,b]of[['installDir','dataDir'],['installDir','runDir'],['dataDir','runDir']])assert.ok(windowsPath(config[a])!==windowsPath(config[b])&&!below(config[a],config[b])&&!below(config[b],config[a]),'Fixture directories must be disjoint');
  for(const key of ['installer','referenceDir'])assert.ok(below(path.join(config.repoRoot,'release'),config[key])||below(runtime,config[key]),key+' must be a repository release/runtime artifact');
  assert.match(config.oldVersion,/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/);assert.match(config.targetVersion,/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/);assert.notEqual(config.oldVersion,config.targetVersion);
  assert.equal(windowsPath(config.legacyEvidence),windowsPath(path.join(config.dataDir,'result.json')));
  return config;
}
export function uninstallExecutable(command){const match=/^"([^"\r\n]+)"\s+\/currentuser\s*$/i.exec(command);assert.ok(match,'UninstallString must be a quoted executable followed only by /currentuser');assert.equal(path.basename(match[1]).toLowerCase(),'uninstall ricamo.exe');windowsPath(match[1]);return match[1]}
export function registryMatches(entry,config,version){assert.match(entry.key,/^HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+$/i);assert.equal(entry.version,version);assert.match(entry.name,/^Ricamo(?: \d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)?$/);assert.equal(windowsPath(path.dirname(uninstallExecutable(entry.uninstall))),windowsPath(config.installDir));if(entry.location)assert.equal(windowsPath(entry.location),windowsPath(config.installDir));return entry}
export function legacyEvidence(evidence,config,state){
  assert.equal(evidence.platform,'win32');assert.equal(evidence.packaged,true);assert.equal(evidence.persistenceReopened,true);assert.equal(evidence.leadingZeroCode,true);assert.equal(evidence.decimalComma,true);assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.remoteRequests,[]);assert.equal(windowsPath(evidence.executable),windowsPath(path.join(config.installDir,'Ricamo.exe')));assert.equal(windowsPath(evidence.data),windowsPath(config.dataDir));
  assert.equal(state.materials.length,1);const material=state.materials[0];assert.equal(material.id,evidence.materialId);assert.equal(material.name,'Desktop persistence test');assert.equal(material.code,'001');assert.equal(state.lots.length,1);assert.equal(state.lots[0].materialId,material.id);assert.equal(state.lots[0].quantity,1.5);assert.equal(state.settings.language,'en');
  for(const[key,value]of Object.entries(state))if(Array.isArray(value)&&!['materials','lots','movements','audit','operations'].includes(key))assert.equal(value.length,0,'Legacy profile contains unexpected '+key);
  assert.equal(state.movements.length,1);return material.id;
}
export function unchanged(before,after){assert.deepEqual(after.state,before.state,'Domain state changed');assert.deepEqual(after.assets,before.assets,'Managed original bytes changed');assert.equal(after.schemaVersion,before.schemaVersion);}
export function afterProjectEdit(before,after,projectId,name){
  assert.equal(after.state.revision,before.state.revision+1);for(const[key,value]of Object.entries(before.state))if(!['projects','audit','operations','revision'].includes(key))assert.deepEqual(after.state[key],value,'Unexpected change to '+key);
  assert.equal(after.state.projects.length,before.state.projects.length);for(const old of before.state.projects){const current=after.state.projects.find(row=>row.id===old.id);if(old.id!==projectId)assert.deepEqual(current,old);else{assert.equal(current.name,name);const strip=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['name','updatedAt'].includes(key)));assert.deepEqual(strip(current),strip(old));}}
  assert.deepEqual(after.assets,before.assets);assert.equal(after.schemaVersion,before.schemaVersion);
}

/** Continue only an already verified run; never turn an arbitrary profile into a fixture. */
export function continuationFixture(previous,next,state){
  assert.equal(previous.kind,'ricamo-installed-upgrade-fixture');assert.equal(previous.format,1);assert.equal(previous.phase,'verified');fixturePaths(previous.config);fixturePaths(next);
  for(const key of ['repoRoot','installDir','dataDir','legacyEvidence'])assert.equal(windowsPath(next[key]),windowsPath(previous.config[key]),'Continuation must retain '+key);
  assert.equal(next.oldVersion,previous.config.targetVersion,'The verified target becomes the next source version');
  assert.ok(windowsPath(next.runDir)!==windowsPath(previous.config.runDir)&&!below(previous.config.runDir,next.runDir)&&!below(next.runDir,previous.config.runDir),'Proof folders must be disjoint');
  assert.match(previous.afterSha256,/^[a-f0-9]{64}$/);assert.match(previous.targetAsarSha256,/^[a-f0-9]{64}$/);
  const project=state.projects.find(row=>row.id===previous.fixture.projectId);assert.ok(project,'Verified project is missing');assert.equal(project.patternId,previous.fixture.patternId);assert.equal(project.revisionId,previous.fixture.revisionId);assert.equal(typeof project.name,'string');assert.ok(project.name.length);
  assert.ok(state.sessions.some(row=>row.id===previous.fixture.sessionId&&row.projectId===project.id));assert.ok(state.attachments.some(row=>row.id===previous.assetId));
  return{...structuredClone(previous.fixture),projectName:project.name};
}

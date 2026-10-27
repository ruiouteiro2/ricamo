import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/** Inspect the running renderer, not merely the launcher's intended preferences. */
export async function assertElectronSecurity(instance) {
  const evidence=await instance.evaluate(({app,BrowserWindow})=>({
    platform:process.platform,
    noSandbox:app.commandLine.hasSwitch('no-sandbox')||process.argv.includes('--no-sandbox'),
    windows:BrowserWindow.getAllWindows().map(window=>{
      const preferences=window.webContents.getLastWebPreferences();
      const pid=window.webContents.getOSProcessId();
      return {pid,sandbox:preferences.sandbox,contextIsolation:preferences.contextIsolation,nodeIntegration:preferences.nodeIntegration,osSandboxed:app.getAppMetrics().find(row=>row.pid===pid)?.sandboxed??null};
    }),
  }));
  assert.equal(evidence.noSandbox,false);
  assert.ok(evidence.windows.length);
  for(const window of evidence.windows) {
    assert.equal(window.sandbox,true);assert.equal(window.contextIsolation,true);assert.equal(window.nodeIntegration,false);
    if(['win32','darwin'].includes(evidence.platform))assert.equal(window.osSandboxed,true,'Renderer OS sandbox must be active');
    if(evidence.platform==='linux') {
      const status=readFileSync(`/proc/${window.pid}/status`,'utf8');
      window.seccomp=Number(status.match(/^Seccomp:\s*(\d+)/m)?.[1]);
      window.noNewPrivileges=Number(status.match(/^NoNewPrivs:\s*(\d+)/m)?.[1]);
      window.noSandboxArgument=readFileSync(`/proc/${window.pid}/cmdline`,'utf8').split('\0').includes('--no-sandbox');
      assert.equal(window.seccomp,2);assert.equal(window.noNewPrivileges,1);assert.equal(window.noSandboxArgument,false);
    }
  }
  return evidence;
}

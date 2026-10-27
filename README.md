# Ricamo

An offline Windows embroidery studio for materials, projects and stitch patterns. Italian is the default language; English is available throughout the interface.

Ricamo keeps catalogue identities separate from physical lots, reservations and stock movements. Progress never consumes material automatically. The application includes a drawing editor, the integrated Stitch Studio image-generation engine, PDF references, local backups and project planning.

The current verified delivery candidate is 0.4.0. [STATUS.md](docs/STATUS.md) records tested behavior and remaining verification; it is not a claim that every acceptance requirement is complete.

The 0.4 source adds local versioned thread catalogues and reviewed substitutions, border-connected background removal, coordinate/centre navigation in the drawing editor, measured fabric-defect geometry and an explicit project revision-impact review. These functions retain the separation between planning, progress and confirmed physical stock changes.

The 0.4.0 Windows installer passed the content audit, 28 native journeys, update/reinstall/uninstall and persistence checks on Windows 10 x64. The integrated domain suite passed 438 tests. See [STATUS](docs/STATUS.md) for hashes, measured performance and remaining environment limitations. The earlier 0.3 installer remains isolated because its content audit found extra files/cache.

## Install and transfer

Use `release/Ricamo-0.4.0-Windows-x64-Setup.exe`. Copy that single installer to the target Windows x64 PC, run it, choose the installation folder and open Ricamo from the Start menu. The installer bundles the application runtime; Node.js is only needed to build from source. This local build is unsigned.

Use **Settings → Create a backup** before moving computers. Transfer that backup and restore it from Settings on the destination. A project package shares selected work and does not transfer physical stock. Clean Windows 11/offline-OS testing and a second PC remain unverified; see STATUS.

## Development

Use Node.js 24 or newer. The Windows application bundles its own runtime; an end user does not need Node.js or a development environment.

```sh
npm ci
npm test
npm run build
npm start
```

`npm run dev` opens the browser development server. Browser storage is separate from the desktop SQLite database. `npm run package:win` creates the x64 installer in `release/`; build on Windows for the Windows distribution.

Run the real browser journeys with `npm run test:e2e`. The runner builds the production frontend, starts its own preview on an unused loopback port, runs inventory, tool and isolated-example journeys sequentially, and shuts the server down on completion or failure. A failed journey returns a nonzero exit status. Browser test artifacts go under ignored `.runtime/`; each journey uses separate browser storage. Install the matching Playwright Chromium runtime first with `npx playwright install chromium` if it is not already available. Required Linux libraries and environment settings remain the caller's responsibility.

```sh
npm run test:e2e
npm run test:desktop
npm run test:performance:domain
npm run test:performance
```

`test:desktop` builds the frontend and runs persistence, documents, drafts, project transfer, cancellation, kits, planning, isolated-example and open-data journeys in sequence. The corresponding `test:desktop:*` scripts run each area separately after a build. They create isolated data under ignored `.runtime/`. Set `RICAMO_EXECUTABLE` to test a packaged executable; otherwise they launch the development Electron runtime. Keep the executable and source/build under test in agreement.

`test:performance:domain` measures a synthetic core workload without launching a browser. `test:performance` builds and exercises Electron with the representative library, recording source/build/executable identity, timings, persistence checks and limitations under `.runtime/`. Set `RICAMO_PERF_OUTPUT` to an alternative artifact directory. These are host-specific measurements, not proof of performance on every Windows PC.

The Windows icon comes from the original `build/icon.svg`; `npm run icons:build` regenerates the committed multi-size `build/icon.ico` using local Playwright Chromium. Windows packaging applies the Ricamo icon, product name, version, author and copyright resources with `win.signExecutable: false`. It deliberately remains unsigned; product metadata is not a verified publisher signature.

Linux Electron test launches must explicitly request `chromiumSandbox: true`: the installed Playwright otherwise adds `--no-sandbox`. Historical functional runs without that option do not prove the operating-system sandbox. Keep security flags enabled and record effective preferences/process evidence separately from UI success.

The guarded Windows upgrade runner is [tests/windows-upgrade.ps1](tests/windows-upgrade.ps1). It accepts only marked synthetic fixtures below `.runtime`, validates exact install/profile/registry/artifact identities, and separates inspection, upgrade, verification and optional uninstall. It is not a migration tool for a personal library. Upgrade evidence and current release limitations are in [STATUS](docs/STATUS.md).

## Data and distribution

Normal desktop data lives in the operating system's application-data directory. Complete backups carry database state and managed originals. The optional example studio has separate storage and is excluded from personal-library backups. Project packages deliberately exclude physical stock; review their privacy and catalogue matching choices before import.

See [data formats](docs/DATA-FORMATS.md) for storage, backups and CSV/TSV/JSON, and [materials](docs/MATERIALS.md) for units and source-backed examples.

Generated installers, dependencies, test artifacts and user data are not committed. No telemetry or online service is required. Current development packages are unsigned; clean-machine Windows acceptance is tracked separately from tests on the development host.

## Attribution

The integrated Stitch Studio engine is MIT licensed. The included approximate DMC colour compilation is attributed to MakeBead under CC BY 4.0. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [LICENSE](LICENSE).

Repository changes follow the requested rule: one changed file per commit, pushed immediately before the next commit.

Practical documentation: [Italian user guide](docs/USER-GUIDE-IT.md), [English user guide](docs/USER-GUIDE-EN.md), [architecture](docs/ARCHITECTURE.md) and [engine audit](docs/ENGINE-AUDIT.md).

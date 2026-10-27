# Ricamo

An offline Windows embroidery studio for materials, projects and stitch patterns. Italian is the default language; English is available throughout the interface.

Ricamo keeps catalogue identities separate from physical lots, reservations and stock movements. Progress never consumes material automatically. The application includes a drawing editor, the integrated Stitch Studio image-generation engine, PDF references, local backups and project planning.

This repository is under active implementation. [STATUS.md](docs/STATUS.md) records tested behavior and remaining verification; it is not a claim that every acceptance requirement is complete.

## Development

Use Node.js 24 or newer. The Windows application bundles its own runtime; an end user does not need Node.js or a development environment.

```sh
npm ci
npm test
npm run build
npm start
```

`npm run dev` opens the browser development server. Browser storage is separate from the desktop SQLite database. `npm run package:win` creates the x64 installer in `release/`; build on Windows for the Windows distribution.

Run the real browser journeys with `npm run test:e2e`. The runner builds the production frontend, starts its own preview on an unused loopback port, runs inventory and tool journeys sequentially, and shuts the server down on completion or failure. A failed journey returns a nonzero exit status. Browser test artifacts go under ignored `.runtime/`; each journey uses separate browser storage. Install the matching Playwright Chromium runtime first with `npx playwright install chromium` if it is not already available. Required Linux libraries and environment settings remain the caller's responsibility.

```sh
npm run test:e2e
npm run test:desktop
npm run test:performance:domain
npm run test:performance
```

`test:desktop` builds the frontend and runs smoke, document and draft tests in sequence. After a build, `test:desktop:smoke`, `test:desktop:documents` and `test:desktop:drafts` run those checks individually. They create isolated data under ignored `.runtime/`. Set `RICAMO_EXECUTABLE` to test a packaged executable; otherwise they launch the development Electron runtime. Keep the executable and source/build under test in agreement.

`test:performance:domain` measures a synthetic core workload without launching a browser. `test:performance` builds and exercises Electron with the representative library, recording source/build/executable identity, timings, persistence checks and limitations under `.runtime/`. Set `RICAMO_PERF_OUTPUT` to an alternative artifact directory. These are host-specific measurements, not proof of performance on every Windows PC.

The Windows icon comes from the original `build/icon.svg`; `npm run icons:build` regenerates the committed multi-size `build/icon.ico` using local Playwright Chromium. Windows packaging applies the Ricamo icon, product name, version, author and copyright resources with `win.signExecutable: false`. It deliberately remains unsigned; product metadata is not a verified publisher signature.

## Data and distribution

Normal desktop data lives in the operating system's application-data directory. Complete backups carry database state and managed originals. Project packages deliberately exclude physical stock; review their privacy and catalogue matching choices before import.

Generated installers, dependencies, test artifacts and user data are not committed. No telemetry or online service is required. Current development packages are unsigned; clean-machine Windows acceptance is tracked separately from tests on the development host.

## Attribution

The integrated Stitch Studio engine is MIT licensed. The included approximate DMC colour compilation is attributed to MakeBead under CC BY 4.0. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [LICENSE](LICENSE).

Repository changes follow the requested rule: one changed file per commit, pushed immediately before the next commit.

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

Native regression scripts are `tests/desktop-smoke.mjs`, `tests/desktop-documents.mjs` and `tests/desktop-drafts.mjs`. They create isolated data under ignored `.runtime/`. Set `RICAMO_EXECUTABLE` to test a packaged executable; otherwise they launch the development Electron runtime against the built frontend.

## Data and distribution

Normal desktop data lives in the operating system's application-data directory. Complete backups carry database state and managed originals. Project packages deliberately exclude physical stock; review their privacy and catalogue matching choices before import.

Generated installers, dependencies, test artifacts and user data are not committed. No telemetry or online service is required. Current development packages are unsigned; clean-machine Windows acceptance is tracked separately from tests on the development host.

## Attribution

The integrated Stitch Studio engine is MIT licensed. The included approximate DMC colour compilation is attributed to MakeBead under CC BY 4.0. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [LICENSE](LICENSE).

Repository changes follow the requested rule: one changed file per commit, pushed immediately before the next commit.

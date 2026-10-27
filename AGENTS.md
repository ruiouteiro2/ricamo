# Ricamo working agreements

- Build an offline Windows x64 desktop application for embroidery, in Italian (default) and English. The user's master prompt is the acceptance contract; do not substitute a web demo for the installed product.
- Reuse the Stitch Studio generation engine, never its UI. Preserve attribution. Do not modify the original source folder or include personal projects in distributions.
- Git identity: RuiOuteiro2 <ruimiguel616@gmail.com>. Remote: https://github.com/ruiouteiro2/ricamo.git. For EVERY created or changed source/document/config file, make ONE commit containing that file alone and immediately push it before the next commit. Commit messages: type(scope): description. Do not commit dependencies, generated builds, test artifacts, user data or credentials.
- Search pages, components and shared styles before UI changes. Use shared primitives and tokens. All operational controls must work with persisted data; no fake dashboards or inert buttons.
- Unknown quantities differ from zero; reservations do not consume; progress does not consume; transfers conserve stock; physical consumption releases only the owning project's reservation atomically. Retries must be idempotent. Keep codes as strings.
- Keep production data offline, renderer sandboxed, files bounded and validated. No telemetry, remote assets, external services or automatic website opening.
- Verify domain invariants, persistence readback, browser journeys, packaged engine and actual Windows distribution separately. Never claim a clean-PC/offline installation was tested without that environment.
- Maintain docs/STATUS.md with factual progress, evidence, limitations and next actions. The six-hour mission began 2026-10-27 08:53 UTC; requested work window runs until approximately 14:53 UTC (15:53 Europe/Berlin).

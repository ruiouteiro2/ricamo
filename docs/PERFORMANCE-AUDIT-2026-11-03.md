# Ricamo interaction audit ? 2026-11-03

## Findings and changes

1. **Selection correctness regression (introduced in the previous optimization).** Vue memoized table rows retained `v-model` checkbox directive state from an older selection array. Consecutive clicks in an unfiltered list could drop another selection or fail to clear the clicked row. Replaced these directives with checked membership and change handlers that read the current selection. The earlier cross-search test remounted rows and missed this regression.
2. **Unbounded continuous-list DOM.** With pagination disabled, Mill Hill mounted 1,011 rows, including thousands of cells, controls and swatches. Replaced full mounting with a variable-height viewport window and overscan. The full list and scrollbar remain available; selection and the 200-item limit operate on the complete list, not just mounted rows. No pagination preference was changed. Row observers are disconnected when the view unmounts.
3. **Rendering effects on the entire catalogue.** Removed per-cell grayscale filters, retained subdued catalogue content, and kept checkboxes at full contrast. Filters covered thousands of cells; their individual cost was not isolated from DOM reduction in this audit.
4. **Deliberate navigation delay.** The route transition waited for the old page to exit before mounting the new page. Removed this route transition; existing control feedback remains.
5. **Repeated catalogue normalization.** Bundled supplier products were reconstructed and validated repeatedly by catalogue consumers. Cache the immutable normalized snapshot, return an independent sortable array to callers, and initialize the browser supplier fallback lazily rather than eagerly in the native renderer. Validation of saved inventory and commands remains enabled.

## Method and evidence

The installed application was measured using a consistent SQLite backup of the current profile: 517 materials, 601 lots, 602 movements, two projects, two patterns, and approximately 2.32 MB of serialized state. Tests used separate profiles; private production data is not committed.

Renderer CPU sampling and Chromium Event Timing distinguished input delay, event processing and presentation from Playwright actionability/scrolling overhead. Real pointer clicks, not only `element.click()`, exposed the lost-selection bug. A prior audit figure of 15?20 ms measured only scripted activation through two animation frames; it did not establish correctness or complete mouse-to-screen latency.

- Baseline native automation clicks in Mill Hill: approximately 121?696 ms including locator/actionability checks and presentation. Some expected deselections stayed checked. Navigation from that list to Shopping/Projects/Patterns measured approximately 362/242/235 ms.
- Corrected source candidate on the same copied profile: consecutive checked/unchecked states remained correct. Browser-reported steady checkbox click presentation was 16?32 ms, with input delay generally under 2 ms; full automation actions were about 66?83 ms. These are different metrics and must not be substituted for each other.
- Corrected source navigation to Shopping/Projects/Patterns measured approximately 95/75/141 ms. Cold catalogue entry still includes synchronous catalogue preparation; a 266 ms task was observed. No claim that every operation is instantaneous is supported.
- Standalone SQLite-backed material saves on the copied profile measured 97?144 ms over six operations. Saves clone, validate and durably commit the application snapshot. Checkbox selection does not save or issue a network request; its delays are not caused by SQLite. This audit preserves validation and durability.
- Evidence: `.runtime/audit-p6iSEI` (CPU profiles, events, save measurements) and `.runtime/inventory-responsiveness-ynP8JO` (synthetic interaction regression). Runtime artifacts remain local.

## Regression coverage

`tests/desktop-inventory-responsiveness.mjs` uses synthetic stock and more than 1,000 catalogue entries with pagination disabled. It checks consecutive native toggles without searching, preserved neighboring selections, bounded DOM, the 200-selection limit, scrolling to distant catalogue rows and back, cross-window selection persistence, purchase creation and unchanged stock/movements. The existing DMC journey covers searching and mixed owned/catalogue purchases. The capped select-all checkbox now shows a mixed state instead of incorrectly remaining checked after reaching the limit.

The general suite passed: 613 tests, 612 passed, one skipped, zero failures. The previously recurring tool-date failure came from the calendar test changing process-wide TZ in a shared Windows test process; timezone cases now execute in child processes. No product date validation was relaxed.

## Limits

This is a targeted code and runtime audit of navigation, inventory interaction, catalogue preparation and command persistence on the current Windows host. It is not an exhaustive benchmark of every editor, print/export operation, physical device or possible data size. Large synchronous saves and cold module/catalogue preparation remain finite costs. The installed build and visible production-profile launch must be checked separately from source runs before delivery.

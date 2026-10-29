<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Conferência isolates CSV/dashboard and atomic invoker RPC by module/batch; route/start keys retain history, pure wall-clock helpers derive shifts/durations/rankings, preserving manual MISSORTED.
- Record indexes use module/date DESC NULLS LAST/id; one import-cache predicate refreshes affected aggregate/history/search/treated readers without freshness or source changes.
- Themes use one root provider/shared CSS tokens, pre-paint preference restore and light-only login; portals/charts/notifications stay consistent.
- Ranking privacy uses one root provider, browser persistence and session-stable labels; only people presentation changes, never identities/calculations/categories.
- Shared blocks/PieBlock use opt-in sizing; Floating heights are scoped and Operational Errors fills its ranking-aligned reason panel, preserving defaults/analytics.
- Floating collaborator ranking modes use a pure helper on filtered active rows and shared privacy-aware Ranking presentation, keeping shift counts independent.
- Operational Errors rankings use ranking-only login filtering/copies, existing countBy and errorShift partitioning; local privacy presentation keeps the unidentified group neutral without affecting source rows or other analytics.
- Import deletion uses owner-authorized atomic functions and one shared confirmation control; Floating wraps existing deletion with the replacement advisory lock and explicit active-pointer confirmation, removing only that pointer without restoring history. Exact batch/module/source-row links preserve unrelated records and collaborator identities, and affected query caches refresh after success.
- Erros Operacionais reads only TABELAS or its CSV using header-evidenced four-column legacy or five-column dated blocks; ambiguous layouts stop before import, the block defines responsible shift, original values remain intact, and the isolated date-only parser feeds existing normalized/raw date columns without changing other modules.
- Reports use records.module + batch_id isolation. Flutuantes commits complete snapshots via atomic invoker RPC with concurrency checking and an active pointer; dedicated reads exclude old snapshots from active views and other reports.
- Module definitions (fields, required, dedupe key, aliases) live in `src/lib/modules.ts`; file parsing runs client-side in `src/lib/parsers.ts`, validation/commit in `src/lib/importer.ts`.
- Never fabricate data; missing fields show "Nenhum dado disponível".
- Period analysis uses reusable pure date helpers and a shared day/week/month/custom selector; AVARIA filters its fetched module rows before every visualization, while two-period comparison reads the same originals without writes.
- Initial date defaults are applied once after hydration through shared system-date utilities; tables inside period-controlled dashboards opt out of their independent default so manual period changes never acquire a second date restriction.
- AVARIA analysis normalizes official types, simple AM1/AM 1, AM2/AM 2, PM1/PM 1 shift spellings, and collaborator casing without source writes; its shift filter applies after period filtering to the complete dashboard and both compared periods, while import-time shift/SOC choices remain independent and auditable.
- Product-family analytics use one pure, conservative whole-word resolver shared by AVARIA rankings and monthly comparison; unknown or mixed products retain normalized descriptions so original records stay untouched and unrelated objects are not merged by material.
- AVARIA pie charts use the filtered record count as denominator and show missing values as an informational segment only when real field values exist, so absent attributes are not inferred or silently excluded.
- ON HOLD uses dedicated record columns and a dedicated dashboard component while sharing the reusable period utilities; Código do Produto maps to Pedido/BR, Tracking Number stays separate, and shift analysis recognizes only standalone AM1/AM2/PM1 markers in original row values without source writes, keeping its import and analytics isolated from every other module.
- Retidos de Veículos: XLSX reads PACOTES RETIRADOS plus romaneio/Plano de expedição as route cross-reference stored in records.extra; stable per-row keys ignore exact reimports but keep legitimate repeats. Original time fields remain text, while a pure wall-clock parser derives creation dates and analysis-only shifts; shared import and table extensions are opt-in to preserve other modules.
- Retidos reasons, equivalence and realized-model counts use pure helpers on filtered rows; route KPIs share one panel, preserving source names.
- FULL uses base TOs + BR status lookup, preserving manual_status on reimport. Selection/copy use complete authorized reads and stable IDs; bulk edits use an atomic RLS-enforced invoker RPC, confirmed date/shift/BR scope (batch fallback if incomplete), and preserve entire manually classified groups unless overwrite is explicit.
- Summary stays isolated: FULL uses normId after date/shift filtering; other modules retain occurrence counts/treatment sums, never global deduplication.
- MISSORTED uses isolated date/shift-unique entries and singleton target with authenticated RLS and creator-only deletion; shared weighted calculation/cache powers its card and dialogs without touching treatment sources.
- ON HOLD treated packages come only from the imported "Pacotes Tratados / Não MEXER" sheet stored per date+shift in `on_hold_treated_imports` (upsert replaces, never sums); manual Tratativas keep only Avarias Salvas, so official totals never mix sources.
- LHs / Rotas uses a dedicated XLSX import (LTS PENDENTES A CHEGAR as schedule, SPX/LHs sheets only as real arrival evidence) stored as one records row per LH (dedupe by trip number) and a dedicated dashboard with canvas PNG export of all filtered LHs, isolating it from the generic importer.
- LH table keeps local scrolling; origin ranking uses responsive HTML/CSS bars on existing originData to avoid sizing failures and horizontal overflow, preserving shared charts and PNG export.

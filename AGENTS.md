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
- Conferência isolates CSV/RPC by module/batch; route/start keys retain history. Pure helpers derive shifts/durations and login-keyed distinct-route Top 5; chart counts ignore speed mode and preserve manual MISSORTED.
- Record indexes use module/date DESC NULLS LAST/id; one import-cache predicate refreshes affected aggregate/history/search/treated readers without freshness or source changes.
- Themes use one root provider/shared CSS tokens, pre-paint preference restore and light-only login; portals/charts/notifications stay consistent.
- Ranking privacy uses one root provider, browser persistence and session-stable labels; only people presentation changes, never identities/calculations/categories.
- Shared blocks/PieBlock use opt-in sizing; Floating heights are scoped and Operational Errors fills its ranking-aligned reason panel, preserving defaults/analytics.
- Floating collaborator ranking modes use a pure helper on filtered active rows and shared privacy-aware Ranking presentation, keeping shift counts independent.
- Operational Errors rankings use ranking-only login filtering/copies, existing countBy and errorShift partitioning; local privacy presentation keeps the unidentified group neutral without affecting source rows or other analytics.
- Import deletion uses owner-authorized atomic functions and one shared confirmation control; Floating wraps existing deletion with the replacement advisory lock and explicit active-pointer confirmation, removing only that pointer without restoring history. Exact batch/module/source-row links preserve unrelated records and collaborator identities, and affected query caches refresh after success.
- Erros Operacionais locates four/five-column TABELAS blocks past notices/separators, retaining contiguous fallback and ignoring summaries; ambiguity stops import. Block responsibility, raw values/conflicts and date-only parsing stay isolated; missing logins normalize only on new imports.
- Reports use records.module + batch_id isolation. Flutuantes commits complete snapshots via atomic invoker RPC with concurrency checking and an active pointer; dedicated reads exclude old snapshots from active views and other reports.
- Module definitions (fields, required, dedupe key, aliases) live in `src/lib/modules.ts`; file parsing runs client-side in `src/lib/parsers.ts`, validation/commit in `src/lib/importer.ts`.
- Never fabricate data; missing fields show "Nenhum dado disponível".
- Period analysis uses reusable pure date helpers and a shared day/week/month/custom selector; AVARIA filters its fetched module rows before every visualization, while two-period comparison reads the same originals without writes.
- Initial date defaults are applied once after hydration through shared system-date utilities; tables inside period-controlled dashboards opt out of their independent default so manual period changes never acquire a second date restriction.
- AVARIA normalizes types, shared shift names and collaborator casing without historical writes; period then shift filters control all analysis and comparisons, while import shift/SOC choices remain independent and auditable.
- Product-family analytics use one pure, conservative whole-word resolver shared by AVARIA rankings and monthly comparison; unknown or mixed products retain normalized descriptions so original records stay untouched and unrelated objects are not merged by material.
- AVARIA pie charts use the filtered record count as denominator and show missing values as an informational segment only when real field values exist, so absent attributes are not inferred or silently excluded.
- ON HOLD uses dedicated columns/dashboard and shared periods; Código do Produto maps to Pedido/BR, Tracking Number stays separate. Shift analysis uses shared standalone source markers, never time inference or historical writes; analytics stay module-isolated.
- Retidos de Veículos: XLSX reads PACOTES RETIRADOS plus romaneio/Plano de expedição as route cross-reference stored in records.extra; stable per-row keys ignore exact reimports but keep legitimate repeats. Original time fields remain text, while a pure wall-clock parser derives creation dates and analysis-only shifts; shared import and table extensions are opt-in to preserve other modules.
- Retidos reasons, equivalence and realized-model counts use pure helpers on filtered rows; route KPIs share one panel, preserving source names.
- FULL uses base TOs + BR status lookup, preserving manual_status on reimport. Selection/copy use complete authorized reads and stable IDs; bulk edits use an atomic RLS-enforced invoker RPC, confirmed date/shift/BR scope (batch fallback if incomplete), and preserve entire manually classified groups unless overwrite is explicit.
- Summary: FULL normId; others counts/sums. PNG snapshots root-theme tokens at click before awaits; same data, layout and dynamic 16:9, without site changes.
- MISSORTED uses isolated date/shift-unique entries and singleton target with authenticated RLS and creator-only deletion; shared weighted calculation/cache powers its card and dialogs without touching treatment sources.
- ON HOLD totals use date/shift imports, with isolated team-RLS deletion by confirmed ID and shared cache refresh. Manual Tratativas use Avarias Salvas; bulk deletion snapshots filtered IDs and retains failures. Neither deletion affects other sources.
- Shared shifts.ts preserves internal operation keys at import/read boundaries with original evidence in extra; shiftLabel translates only presentation (including exports). Keep time/date derivation, database uniqueness and stored FULL operation keys; no historical writes. LH uses schedule + arrival evidence, trip dedupe and filtered PNG.
- LH table scrolls locally; origin ranking uses responsive HTML/CSS bars on originData, avoiding overflow and preserving charts/PNG.
- RLS gates data by `is_team_member` (user_roles): shared among members; new sign-ups need authorization.
- AVARIA ranking mode stays local; per-shift view partitions filtered rows into three shared privacy-aware rankings, preserving other analysis.

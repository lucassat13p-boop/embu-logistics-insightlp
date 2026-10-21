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
- Record-read indexes match module equality and descending date with nulls last plus ID ordering; import cache refreshes share one affected-key predicate covering aggregate/history/search readers and successfully saved treated totals, without changing freshness windows or source data.
- Visual themes use one root provider and shared CSS tokens, with pre-paint browser preference restoration and a light-only login; this keeps portalled controls, charts and notifications consistent without changing page logic.
- People-ranking privacy uses one root React provider with browser-only preference persistence and session-stable neutral labels; opt in only ranking and comparison presentation so source identities, calculations and non-person categories remain unchanged.
- Charts use shared blocks and PieBlock; Floating opts into scoped sizing and BarBlock height, preserving shared defaults, data, filtering, order and limits.
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
- Main dashboard summary calculations are isolated from advanced analytics; FULL summary reuses normId after operational date/shift filtering, while other modules retain occurrence counts and treatment sums, preventing global deduplication or source changes.
- ON HOLD treated packages come only from the imported "Pacotes Tratados / Não MEXER" sheet stored per date+shift in `on_hold_treated_imports` (upsert replaces, never sums); manual Tratativas keep only Avarias Salvas, so official totals never mix sources.

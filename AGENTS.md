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
- Import deletion uses the owner-authorized atomic `delete_import_batch` database function and one shared confirmation control; exact batch/module/source-row links prevent cross-import deletion, collaborator identities remain intact, and affected query caches refresh after success.
- Erros Operacionais reads only the TABELAS tab (or its CSV export) by fixed column positions A–D/E–H/I–L = AM1/AM2/PM1; the block alone defines the responsible shift, the original shift is kept in extra, and row/block-based dedupe keys make re-imports idempotent without merging legitimate repeated BRs.
- All imported report rows live in `public.records` with a strict `module` discriminator and `batch_id` → `import_batches`; pages must always filter by module so reports never leak across modules.
- Module definitions (fields, required, dedupe key, aliases) live in `src/lib/modules.ts`; file parsing runs client-side in `src/lib/parsers.ts`, validation/commit in `src/lib/importer.ts`.
- Never seed or fabricate data; UI shows "Nenhum dado disponível" when a field has no real values.
- Period analysis uses reusable pure date helpers and a shared day/week/month/custom selector; AVARIA filters its fetched module rows before every visualization, while two-period comparison reads the same originals without writes.
- Initial date defaults are applied once after hydration through shared system-date utilities; tables inside period-controlled dashboards opt out of their independent default so manual period changes never acquire a second date restriction.
- AVARIA analysis normalizes official types, simple AM1/AM 1, AM2/AM 2, PM1/PM 1 shift spellings, and collaborator casing without source writes; its shift filter applies after period filtering to the complete dashboard and both compared periods, while import-time shift/SOC choices remain independent and auditable.
- Product-family analytics use one pure, conservative whole-word resolver shared by AVARIA rankings and monthly comparison; unknown or mixed products retain normalized descriptions so original records stay untouched and unrelated objects are not merged by material.
- AVARIA pie charts use the filtered record count as denominator and show missing values as an informational segment only when real field values exist, so absent attributes are not inferred or silently excluded.
- ON HOLD uses dedicated record columns and a dedicated dashboard component while sharing the reusable period utilities; Código do Produto maps to Pedido/BR, Tracking Number stays separate, and shift analysis recognizes only standalone AM1/AM2/PM1 markers in original row values without source writes, keeping its import and analytics isolated from every other module.
- Retidos de Veículos uses its own module and dedicated analysis/dashboard; append-only inserts use batch/row occurrence keys so repeated source rows never deduplicate or overwrite. Original time fields remain text, while a pure wall-clock parser derives creation dates and analysis-only shifts; shared import and table extensions are opt-in to preserve other modules.
- Retidos reason summaries are pure presentation-only values resolved from the first recognized source phrase; its chart groups these values and opt-in table columns expose summaries alongside unchanged source details, keeping other module tables unchanged.

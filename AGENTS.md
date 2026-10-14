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
- All imported report rows live in `public.records` with a strict `module` discriminator and `batch_id` → `import_batches`; pages must always filter by module so reports never leak across modules.
- Module definitions (fields, required, dedupe key, aliases) live in `src/lib/modules.ts`; file parsing runs client-side in `src/lib/parsers.ts`, validation/commit in `src/lib/importer.ts`.
- Never seed or fabricate data; UI shows "Nenhum dado disponível" when a field has no real values.
- Period analysis uses reusable pure date helpers and a shared day/week/month/custom selector; AVARIA filters its fetched module rows before every visualization, while two-period comparison reads the same originals without writes.
- AVARIA analysis normalizes official types, shifts, and collaborator casing without source writes; import-time shift/SOC choices are independent and stored with each batch for auditability.
- Product-family analytics use one pure, conservative whole-word resolver shared by AVARIA rankings and monthly comparison; unknown or mixed products retain normalized descriptions so original records stay untouched and unrelated objects are not merged by material.
- AVARIA pie charts use the filtered record count as denominator and show missing values as an informational segment only when real field values exist, so absent attributes are not inferred or silently excluded.
- ON HOLD uses dedicated record columns and a dedicated dashboard component while sharing the reusable period utilities, keeping its import and analytics isolated from every other module.

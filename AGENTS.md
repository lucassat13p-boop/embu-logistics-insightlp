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

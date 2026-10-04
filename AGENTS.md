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
- Data access is client-side via the browser Supabase client + TanStack Query, all app routes under `_authenticated/` (ssr:false); why: single-user app, RLS enforces ownership.
- Goal edits go through the localStorage-backed save queue in `src/lib/goals.ts`; why: offline-tolerant autosave, never lose edits.
- New week / seeding / make-current are SQL RPCs (`create_new_week`, `seed_if_empty`, `make_current`); why: atomic copy of 45 goals.
- BTM planner (`/btm`) uses its own localStorage queue in `src/lib/btm.ts`, with upserts keyed by natural identity (user+scope+date+slot, block id); why: an edit always lands on the date it was typed for, and it's independent of goals/snapshots.
- BTM dates are local "YYYY-MM-DD" strings via `src/lib/btm-utils.ts` (never toISOString); why: avoids UTC day shifts.

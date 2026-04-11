# Branch protection (GitHub + Vercel)

This repo uses **`main`** for production (Vercel’s Production Branch should stay **`main`**) and **`staging`** for pre-production previews. Branch rules reduce the chance of broken or unintended code reaching production.

## Protect `main` (recommended)

Configure in GitHub: **Repository → Settings → Branches → Branch protection rules → Add rule**.

1. **Branch name pattern:** `main`
2. Consider enabling:
   - **Require a pull request before merging** — no direct pushes to `main`; changes land via PR.
   - **Require approvals** (e.g. 1 reviewer) — optional but useful for solo/small teams as a deliberate merge step.
   - **Require status checks to pass** — if you add CI (build/tests), require them before merge.
   - **Require conversation resolution before merging** — ensures review comments are addressed.
   - **Do not allow bypassing the above settings** — uncheck “Allow administrators to bypass” if you want rules to apply to everyone.
3. Usually leave **Allow force pushes** and **Allow deletions** **disabled** for `main`.

Result: production deploys only update when **`main`** moves forward (merge or allowed merge), not from random local pushes.

## Optional: lighter rules for `staging`

Add a second rule for pattern **`staging`** if you want:

- Require PRs into `staging`, or  
- Only block **force push** / **deletion** so the branch history stays recoverable.

`staging` is still a **Vercel Preview** branch, not production; stricter rules are optional.

## Optional: protect feature branches pattern

Some teams add a rule for `release/*` or use **Rulesets** (Settings → Rules → Rulesets) for more advanced patterns. Not required for a simple `main` + `staging` + feature-branch flow.

## Quick workflow reminder

| Branch        | Role              | Vercel        |
| ------------- | ----------------- | ------------- |
| `main`        | Production code   | Production    |
| `staging`     | Integration / QA  | Preview URL   |
| Feature/*     | Development       | Preview URL   |

Merge **feature → `staging`** to validate on staging; merge **`staging` → `main`** (or **feature → `main`** via PR) when ready for production.

## Vercel check

**Vercel → Project → Settings → Git → Production Branch** should be **`main`** so the above GitHub rules align with what actually ships to your production URL.

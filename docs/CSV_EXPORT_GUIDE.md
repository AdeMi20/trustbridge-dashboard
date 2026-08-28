# CSV Export Guide

CSV exports should be treated as payout artifacts.

## Recommended columns

- GitHub username.
- Stellar address.
- Readiness status.
- Asset code and issuer.
- Last checked timestamp.

## Export columns

The CSV export includes the following columns:

- `id` — Contributor internal ID
- `githubUsername` — GitHub username
- `stellarAddress` — Stellar public key
- `funded` — Account funded (yes/no)
- `trustlineReady` — Trustline established (yes/no)
- `trustlineAuthorized` — Trustline authorized (yes/no)
- `verified` — On-chain verified (yes/no)
- `xlmBalance` — XLM balance
- `spendableXlmBalance` — Spendable XLM balance
- `readiness` — Readiness status (ready/low_reserve/not_ready)
- `lastCheckedAt` — Last check timestamp
- `horizonDebugSummary` — Horizon state summary
- `horizonNextAction` — Recommended next action
- `freighterProofChallenge` — Freighter proof challenge

## Export confirmation

Every export from the dashboard goes through an accessible confirmation dialog
(`ConfirmDialog` in `src/components/ui/confirm-dialog.tsx`) before a file is
written. An export carries GitHub handles, Stellar addresses and balances, so
the prompt names the row count and says plainly that the file is personal data.

The dialog is what makes that prompt usable rather than something to click past:

- `role="alertdialog"` with `aria-modal`, labelled by its title and described by
  its body — the whole prompt is announced on open.
- Focus lands on **Cancel**, not on the button that downloads the data.
- Tab and Shift+Tab cycle inside the dialog; focus cannot reach the page behind.
- ESC and the backdrop cancel, and focus returns to the button that opened it.
- Cancel stays enabled even mid-export, so a keyboard user is never trapped.
- Confirm fires at most once per opening — a double click cannot download twice.

When the selection contains stale rows, the staleness warning is rendered
**inside** the dialog's described region rather than as a second, native
`window.confirm()`. Call sites therefore pass `force` to
`exportContributorsCsv()` / `exportContributorsJson()` after the dialog is
accepted: stacking a second prompt is how confirmations get ignored.

The dialog is a client-side check on top of the API's authorization, not a
replacement for it — `/api/contributors/export/*` still enforces the maintainer
session on every request.

`src/components/ui/confirm-dialog.test.tsx` holds these guarantees as tests.

## Before sending payments

Re-run readiness checks, exclude not-ready contributors, and keep the export alongside the transaction batch hash for later review.

## Security notes

- CSV exports are maintainer-only
- Never commit exports with real data to version control
- Exports are audit-logged
- No access tokens or secrets are included in exports

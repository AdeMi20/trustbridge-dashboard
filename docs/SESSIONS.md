# Sessions

TrustBridge signs users in with GitHub OAuth through NextAuth, using the
**JWT session strategy** (`session.strategy: "jwt"` in
[`src/lib/auth.ts`](../src/lib/auth.ts)). This document explains what that
means, what the account panel can and cannot tell a user, and what it would
take to change.

## How a session works here

1. A user signs in with GitHub. NextAuth exchanges the OAuth code, and the
   `jwt` callback upserts the `User` row and resolves maintainer status and
   RBAC role from the GitHub org and teams.
2. NextAuth issues a **signed, self-contained token** and stores it in the
   `next-auth.session-token` cookie.
3. On every request, the server verifies the signature and reads the claims.
   `withAuth` in [`src/middleware.ts`](../src/middleware.ts) does this for page
   routes; API routes do it through `getServerSession`.

Sessions last **30 days** (`SESSION_MAX_AGE_SECONDS` in
[`src/lib/session-info.ts`](../src/lib/session-info.ts), wired into
`authOptions.session.maxAge`). Both places read the same constant, and
`session-info.test.ts` fails if they drift.

## The consequence: there is no session list

**The server keeps no record that a session exists.** A valid signature is the
whole of the proof. Nothing is written when a user signs in, and nothing is
read to decide whether a token is still good.

Three things follow, and the UI states all three rather than working around
them:

| | Possible? | Why |
| --- | --- | --- |
| Show details of the current session | **Yes** | The token carries `iat` and `exp`. |
| List the user's other devices | **No** | There is no row per session to enumerate. |
| Remotely end a session on another device | **No** | There is nothing to delete; the token stays valid until `exp`. |

`prisma/schema.prisma` does declare `Account` and `Session` models — they ship
with the NextAuth Prisma adapter. **With the JWT strategy the adapter never
writes session rows.** Reading them would return an empty list that looks
authoritative, which is worse than showing nothing: someone whose laptop was
stolen would read "no other sessions" as reassurance.

## What the account panel shows

[`SessionPanel`](../src/components/SessionPanel.tsx), on
`/dashboard/settings`, reads `GET /api/auth/session-info` and shows:

- **Signed in at** — the token's `iat`, in the reader's own locale and zone.
- **Expires at** — the token's `exp`.
- **Time remaining** — how long the current session has left.
- **Session type** — "Signed token (JWT)", so the limitation below is traceable
  to a cause rather than reading as a missing feature.

It then states plainly that other devices cannot be listed or signed out from
here, and points at the remedy that actually works (below).

### What the endpoint deliberately does not return

`GET /api/auth/session-info` returns timing facts and nothing else. It does
**not** return:

- the GitHub access token, encrypted or otherwise;
- IP address, user agent, or approximate location;
- the user's email, name, or GitHub handle.

The last group is the interesting one. Recording IP and user agent per sign-in
is the usual way to build a device list — and it would mean **collecting new
PII to power a feature that still could not end a remote session.** The cost is
real and the benefit is cosmetic, so it is not collected. The endpoint takes no
user parameter either, so it cannot be asked about anybody but the caller.

## Signing out

The panel's button calls NextAuth's `signOut()`, which clears the cookie in
**that browser only**. Sessions in other browsers stay valid until they expire —
up to 30 days after they were created.

**If a device is lost or the account may be compromised**, the effective step
is to revoke TrustBridge's access from
[GitHub's authorized OAuth apps](https://github.com/settings/applications) and
change the GitHub password. That stops TrustBridge from acting on the user's
behalf, and it invalidates the stored access token, so any still-valid session
token loses the GitHub authority behind it. The panel says this.

## Switching to database sessions

Real device management needs `session.strategy: "database"`. That is a
deliberate trade, not an oversight:

**What it would buy**

- One `Session` row per signed-in device, so a list is possible.
- Deleting a row ends that session immediately — real remote sign-out.
- "Sign out everywhere" becomes a `deleteMany` on the user's sessions.

**What it would cost**

- A database read on **every authenticated request**, including middleware.
  Today the signature check is pure computation with no I/O.
- A hard dependency on database availability for authentication. A database
  blip currently degrades the dashboard; it would then log everyone out.
- Session rows to expire and prune.
- Meaningful device labels still require storing user agent and IP — the PII
  question above does not go away, it just becomes worth paying.

If it is taken on, the work is roughly:

1. Set `session.strategy: "database"` and attach `PrismaAdapter` in
   `authOptions` (`@auth/prisma-adapter` is already a dependency).
2. Move the claims the `jwt` callback computes today — `isMaintainer`, `role` —
   into the `session` callback, reading them from the `User` row.
3. Add `GET /api/auth/sessions` (list) and `DELETE /api/auth/sessions/:id`
   plus a revoke-all route, all scoped to the caller.
4. Replace `SessionPanel`'s limitation notice with the real list, and flip
   `canListOtherSessions` / `signOutEndsAllSessions` in
   `buildSessionInfo()` — the UI already reads those flags rather than
   hardcoding the assumption.
5. Decide the user-agent/IP question explicitly, and write down the answer.

## Related

- [`docs/CSRF.md`](./CSRF.md) — same-origin enforcement on mutating routes.
- [`docs/OAUTH_CHECKLIST.md`](./OAUTH_CHECKLIST.md) — GitHub OAuth app setup.
- `src/lib/token-crypto.ts` — GitHub access tokens are encrypted at rest
  (AES-256-GCM) and never leave the server.

# hushh

**hushh** is a private, real-time messaging web app. You communicate with a
unique **Chat ID** instead of exposing an email address — no email, no phone
number, no noise.

```
                        hushh
                          |
                   React + Vite (frontend)
                          |
                    Supabase Client
                          |
          +---------------+---------------+
          |               |               |
      Supabase Auth   PostgreSQL      Realtime
          |               |               |
    login/register    profiles        messages
                      secrets
                      conversations
                          |
                          |
              ONE Edge Function
               recover-password
                          |
                  Supabase Admin
                          |
                   password reset
```

There is **no traditional backend server**. The backend is a cloud-hosted
Supabase project (Auth + PostgreSQL + Realtime) plus **one** Edge Function
for server-side password recovery.

---

## 1. What hushh is

- **Create an account** with a display name, a Chat ID, a password, and a
  security question/answer. A secret **Recovery ID** is generated for you.
- **Log in with Chat ID + password** — no email field anywhere.
- **Search other users by Chat ID** and start private 1:1 conversations.
- **Real-time messaging** over Supabase Realtime — no polling, no refresh.
- **Message history** and **deleting your own messages** (soft delete).
- **Password recovery** via **Recovery ID + security answer** — the Chat ID
  alone can never recover an account.
- **Unread counts** — a badge per chat shows how many messages you haven't
  seen yet; it clears when you open the chat.
- **Delete a chat (for me)** — remove a conversation (and that user's chat)
  from your list only; the other person's copy is untouched.
- **Avatar gallery** — pick one of 12 bundled avatars from the Settings menu
  (gear icon in the chat sidebar); no uploads, no file storage.

### Portability promise

The project is fully portable:

1. Delete the entire local project folder.
2. Download a fresh copy.
3. Create/copy one `.env` file with your Supabase configuration.
4. `npm install`
5. `npm run dev`

Everything else (users, messages, schema) lives in your **existing cloud
Supabase project**. There is no local database, no local PostgreSQL, no
MongoDB, no Redis, and no persistent backend server.

---

## 2. Tech stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Frontend   | React 18 + Vite 5 (JavaScript/JSX)                  |
| Routing    | react-router-dom v6                                 |
| Cloud      | Supabase Auth, Supabase PostgreSQL, Supabase Realtime |
| Server-side| ONE Supabase Edge Function: `recover-password` (Deno) |
| Testing    | Vitest                                              |

Explicitly **not** used: Firebase, Firestore, MongoDB, local PostgreSQL,
Redis, Express, traditional Node backends, App Check, Cloud Armor, custom
token systems, custom password databases.

---

## 3. How the pieces fit

### 3.1 Chat ID → internal email mapping (Supabase Auth)

Supabase Auth authenticates email/password credentials. hushh users never
have or see an email. Instead the frontend derives a **deterministic internal
email** from the normalized Chat ID (`src/utils/emailMapping.js`):

```
"  Soumyadeep  "  →  "soumyadeep@<your-project-hostname>"
```

- Never displayed in the UI, never searchable, never a public profile field.
- Because Supabase Auth enforces **unique emails**, this is a second layer of
  Chat-ID uniqueness on top of the database `UNIQUE` constraint.

### 3.2 Secrets handling

| Secret          | Stored as                                              | Where        |
| --------------- | ------------------------------------------------------ | ------------ |
| Login password  | Handled entirely by **Supabase Auth** — hushh never stores or hashes it | Supabase Auth |
| Security answer | `PBKDF2-HMAC-SHA256(answer, per-user salt, 210 000)`   | `user_secrets` |
| Recovery ID     | `SHA-256(normalizedRecoveryId)`                        | `user_secrets` |

Recovery IDs carry **~140 bits of CSPRNG entropy** (7 groups × 4 characters
from a 32-character unambiguous alphabet, e.g.
`RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD-K2RT`). That makes enumeration of the
recovery endpoint computationally infeasible.

- The plaintext security answer only exists in memory while deriving its hash.
- The plaintext Recovery ID is shown **once** in a dialog after registration,
  then dropped from state. It is never written to `localStorage`,
  `sessionStorage`, cookies, the URL, analytics, logs or the database.

### 3.3 Password recovery (Edge Function)

A logged-out browser must never perform an administrative password reset, so
recovery goes through exactly one Edge Function: **`recover-password`**.

```
Forgot password → Enter Recovery ID → question shown → answer
→ new password → Edge Function verifies everything → Supabase Admin changes password
```

The Edge Function:

1. receives `{ action: 'lookup' | 'reset', recoveryId, securityAnswer?, newPassword? }`
2. hashes the Recovery ID and looks the row up by hash
3. verifies the security answer against its PBKDF2 hash (timing-safe)
4. rate-limits failures (**5 failed attempts within 15 minutes → 15-minute
   lock**). The count/lock update is one **atomic upsert** in the server-side
   function `public.record_recovery_attempt()` (migration `0004`), so
   concurrent requests cannot read-then-write their way past the limit. The
   policy is mirrored in `tests/helpers/rateLimitPolicy.js` and pinned by
   unit tests.
5. validates the new password server-side
6. changes the Supabase Auth password via the Admin API (service-role key,
   which exists **only** as an Edge Function secret) and then revokes all of
   the user's existing sessions (`admin.signOut`) so old tokens cannot keep a
   compromised account alive
7. returns only generic `{ success: true | false, error? }` — never hashes,
   salts, answers, passwords, user IDs or credentials

### 3.4 Row Level Security

RLS is enabled on every user-sensitive table:

| Table | Client can | Notes |
| ----- | ---------- | ----- |
| `profiles` | SELECT/INSERT/UPDATE/DELETE **only own row** | Other users' rows are read only through security-definer functions returning just `id, display_name, chat_id` |
| `user_secrets` | INSERT own row only | No SELECT/UPDATE/DELETE for any client role — only the service role (Edge Function) can read it |
| `conversations` | SELECT if participant | No client writes (created by security-definer RPC) |
| `conversation_participants` | SELECT if participant | No client writes — users cannot add themselves to conversations |
| `messages` | SELECT if participant; INSERT as self into own conversations; UPDATE only own, undeleted message (soft delete) | Body edits and moves are blocked by a trigger |
| `recovery_attempts` | nothing | service role only |

Realtime is RLS-aware: a client only receives events for rows it can SELECT,
so **realtime can never leak messages from conversations you're not in**.

---

## 4. Project structure

```
hushh/
├── .env.example                  # ← copy to .env and fill in
├── .env                          # local config (git-ignored, NOT in archives)
├── package.json
├── vite.config.js
├── index.html
├── supabase/
│   ├── migrations/               # cloud schema, RLS, functions, realtime
│   │   ├── 0001_schema.sql
│   │   ├── 0002_rls_and_functions.sql
│   │   ├── 0003_realtime.sql
│   │   └── 0004_hardening.sql    # revokes, constraints, triggers, rate limiter
│   └── functions/
│       └── recover-password/
│           └── index.ts          # the ONE Edge Function — self-contained,
│                                 # paste-ready for the Dashboard editor
├── src/
│   ├── lib/
│   │   └── supabase.js           # Supabase client (env vars only)
│   ├── components/               # UI components
│   ├── pages/                    # Landing, Register, Login, ForgotPassword, Chat
│   ├── services/                 # auth, profiles, secrets, conversations,
│   │                             # messages, recovery (UI → services → Supabase)
│   ├── hooks/                    # useAuth, useRealtimeMessages, useRealtimeConversations
│   ├── utils/                    # pure business logic (chatId, recoveryId, hash, …)
│   ├── data/                     # security questions list
│   └── styles/
│       └── global.css            # design system
└── tests/                        # Vitest unit tests
```

The layering is strict: **UI → services → Supabase**. No database logic
inside components.

---

## 5. Supabase project setup (one-time, manual — nothing is auto-deployed)

### 5.1 Create a Supabase project

1. Go to https://supabase.com → **New project** (a dedicated project for hushh).
2. Note the project password for yourself (the dashboard keeps it).

### 5.2 Configure Auth

Dashboard → **Authentication → Sign In / Providers → Email**:

- Turn **OFF** “Confirm email”. hushh signs users up and signs them in
  immediately; it never sends emails, and registration needs an instant
  session to create the profile row.
- (Optional) set **Password min length** to 8 — the app already enforces 8+
  with a letter and a number.
- Keep **Allow new users to sign up** enabled.

### 5.3 Database migrations (already applied — do not rerun)

The four migrations have **already been manually applied** to the hushh
Supabase Cloud project:

1. `supabase/migrations/0001_schema.sql` — tables, indexes, constraints
2. `supabase/migrations/0002_rls_and_functions.sql` — RLS policies, triggers,
   security-definer functions, grants
3. `supabase/migrations/0003_realtime.sql` — Realtime publication
4. `supabase/migrations/0004_hardening.sql` — explicit REVOKEs (defense in
   depth), Chat ID charset constraints, profile identity immutability
   (Chat ID / auth id can never change), message sender-forcing trigger
   (`sender_id` is derived from `auth.uid()`, never trusted from the client),
   stricter edit guard, and the atomic recovery rate-limiter
5. `supabase/migrations/0005_fix_recursive_rls.sql` — fixes the recursive
   RLS policy on `conversation_participants` (PostgreSQL "infinite recursion
   detected in policy" → PostgREST HTTP 500 on conversation/participant/
   message reads) by adding a hardened `SECURITY DEFINER`
   `is_conversation_participant(uuid)` helper (fixed `search_path`,
   `auth.uid()`-scoped, boolean-only, EXECUTE restricted to `authenticated`)
   and rewriting the four participant-dependent policies to use it. Also
   re-grants INSERT on `user_secrets` to `authenticated` (idempotent repair).
6. `supabase/migrations/0006_unread_delete_avatars.sql` — unread message
   counts (per-participant read cursor `last_read_at`), delete-chat-for-me
   (`delete_conversation_for_me` removes only YOUR participant row and cleans
   up the conversation when nobody remains), and the fixed avatar gallery
   (`profiles.avatar_id`, validated 1..12). All new server logic is hardened
   `SECURITY DEFINER` functions (fixed `search_path`, `auth.uid()`-scoped,
   EXECUTE for `authenticated` only).

The `supabase/migrations/` folder is kept as **documentation/versioning** of
the cloud schema. Do **not** recreate, modify or rerun 0001–0004 — they are
already live in the cloud project. Apply 0005 (a new, additive migration)
the same way: Dashboard → SQL Editor → paste → Run. No local PostgreSQL and
no Supabase CLI are required anywhere in this project.

**Verify RLS** (one time, optional): in **Table Editor**, select a table →
**RLS policies**. You should see the policies described in §3.4. If RLS were
ever disabled on `user_secrets`, recovery hashes would become readable —
keep it enabled.

### 5.4 Configure Realtime

`0003_realtime.sql` already added `messages` and `conversations` to the
`supabase_realtime` publication. You can verify in the dashboard:
**Database → Replication** → both tables present. RLS governs what each user
receives.

### 5.5 Deploy the recover-password Edge Function (Dashboard — no CLI)

The function source is **self-contained** (`supabase/functions/
recover-password/index.ts`) and is deployed through the **Supabase
Dashboard Edge Functions editor** — no Supabase CLI, no Docker, no local
Deno.

1. Open your hushh project in the Supabase Dashboard.
2. Sidebar → **Edge Functions** → **Create a new function**.
   (If `recover-password` already exists, open it and skip to step 4.)
3. Name the function exactly: `recover-password` (lowercase, hyphens).
4. In the editor, delete the boilerplate and paste the **entire contents of
   `supabase/functions/recover-password/index.ts`**.
5. Click **Deploy**.
6. Open the deployed function → **Settings** and turn **OFF
   “Enforce JWT verification”** (the Dashboard equivalent of the CLI’s
   `--no-verify-jwt`).

Why JWT verification must be off: password recovery runs while the user is
**logged out**, so the function must be reachable without a user JWT. It is
protected by its own server-side rate limiting (5 failed attempts / 15 min →
15-min lock) instead of JWT checks.

**Secrets:** nothing to configure. Supabase automatically injects
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into every Edge Function in
the project. The service-role key exists **only** there — never in Vite
environment variables, never in the frontend, never committed.

**Verify:** the function URL is
`https://<project-ref>.supabase.co/functions/v1/recover-password`. The
frontend calls it automatically through the Supabase client.

### 5.6 Create `.env`

```
cp .env.example .env
```

Fill in from Dashboard → **Project Settings → API**:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon / publishable key>
```

Only the **public** URL and the **anon/publishable key** are needed — these
are safe to ship to the browser. The new-style Supabase **publishable key**
works as a drop-in for the anon key. **Never** put the `service_role` key in
`.env` or any frontend file.

---

## 6. Run it

The frontend connects **directly to the Supabase Cloud project** — no local
backend, no local database, no Supabase CLI.

```bash
npm install        # only needed when dependencies change
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # run the unit test suite (Vitest)
npm run build      # production build into dist/
npm run preview    # preview the production build
```

---

## 7. Security decisions (why it's shaped this way)

- **Passwords live in Supabase Auth.** No custom password database, no custom
  hashing of the login password, no plaintext passwords in PostgreSQL.
- **Recovery ID hash is unsalted SHA-256** by design: the Edge Function must
  look the row up directly from the hash, and the Recovery ID carries ~140
  bits of random entropy, so an unsalted hash is resistant to brute force.
  The **security answer** is low-entropy and human-chosen, so it gets
  PBKDF2 with a unique random salt per user.
- **Recovery requires Recovery ID + security answer.** The Chat ID is never
  sufficient, and recovery data is never exposed through Chat ID search.
- **Chat-ID uniqueness is enforced at the database level** (unique index on
  `profiles.chat_id_normalized`, plus Supabase Auth's unique internal email),
  not just in the UI — concurrent duplicate registrations are rejected. The
  allowed character set is additionally enforced by database CHECK
  constraints, and Chat IDs are **immutable** after registration (trigger).
- **Chat IDs are ASCII-only** (letters, digits, hyphens; normalized to
  lowercase), so JavaScript and PostgreSQL case-folding can never diverge and
  two visually-equivalent inputs can never become separate identities.
- **The internal Auth email is injective**: different normalized Chat IDs
  always map to different emails (proven by unit tests over a large sample).
- **Conversations are created by a security-definer RPC**, so a client can
  never add itself to a conversation it wasn't invited to. A 1:1 conversation
  is identified by a deterministic `dedupe_key` with a UNIQUE constraint.
- **The database, not the client, decides who sent a message**: the RLS
  insert policy AND a `BEFORE INSERT` trigger derive `sender_id` from
  `auth.uid()`, so spoofing `sender_id` or `conversation_id` is impossible.
- **Messages are text-only in v1**; empty and >2000-char messages are blocked
  in the UI, in the service layer, and by a database CHECK constraint. Bodies
  are immutable (trigger); only the owner can soft-delete their own message,
  and deleted messages cannot be restored or re-modified.
- **One Edge Function only.** Everything else is RLS-protected PostgreSQL +
  Supabase Auth + Realtime. No queues, no Redis, no microservices.
- **Secrets are never readable by clients**: `user_secrets` and
  `recovery_attempts` are additionally REVOKEd from `anon`/`authenticated`
  (defense in depth on top of RLS), so even a misconfigured policy cannot
  expose them.
- **A successful recovery revokes old sessions** (`admin.signOut`), so an
  attacker who used a stolen Recovery ID cannot keep a previously-issued
  session alive after the password change.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| “Account created, but sign-in is pending…” | “Confirm email” is ON | Turn it OFF (§5.2) |
| `AuthApiError: User already registered` | That normalized Chat ID is taken | Pick another Chat ID |
| Registration succeeds but no profile | Email confirmation ON / RLS not applied | Check §5.2 and §5.3 |
| No realtime updates | `messages`/`conversations` not in publication | Run `0003_realtime.sql` or check Database → Replication |
| Forgot-password always fails | Edge Function not deployed, or “Enforce JWT verification” is ON | §5.5 |
| Forgot-password always fails | Function URL differs (`recover-password` not created in the project) | §5.5 |

---

## 9. Tests

### `npm test` — always runs, no database needed (140 tests)

Covers: Chat ID validation / normalization / canonicalization (including
hostile, Unicode and SQL-like input), internal-email injectivity, password
validation, registration validation, security answer normalization +
hashing, Recovery ID format / randomness / 140-bit entropy / hashing,
recovery validation, rate-limit policy (5 / 15 min / 15 min lock), 1:1
conversation key logic, and message validation — plus **static security
regression suites** that pin the RLS policies, REVOKEs, constraints,
SECURITY DEFINER properties, and Edge Function invariants to the actual
migration/function source files, so an accidental policy weakening fails the
build even without a live database.

### `npm run test:security` — live penetration matrix (optional)

`scripts/security-audit-live.mjs` proves the RLS / Realtime / rate-limiting
guarantees against a real Supabase **test** project using direct
PostgREST/Realtime calls (not the UI): A↔B↔C cross-user access, message
sender spoofing, participant spoofing, secrets isolation, duplicate
case-insensitive Chat IDs, 12 concurrent rate-limit attempts, and Realtime
delivery to authorized participants only. It requires `VITE_SUPABASE_URL` +
`VITE_SUPABASE_ANON_KEY` pointing at a dedicated test project with the
migrations applied and the Edge Function deployed; it skips gracefully
otherwise. Never run it against a production project — it creates real
users.

---

*This project is intentionally small. There is no file storage, no profile
photos, no group chats, no device/session management in v1.*

---

## 10. CAPTCHA (bot protection) at registration AND sign-in

hushh uses Supabase Auth's built-in CAPTCHA protection (hCaptcha) at **account
creation and sign-in**. The **public site key** is loaded by the frontend; the
**secret key** is configured only in Supabase Cloud and is verified server-side
by Supabase Auth — it never reaches the browser.

Both forms share ONE widget implementation (`src/components/CaptchaWidget.jsx`,
built on the utilities in `src/lib/captcha.js`).

### Setup (one time, in Supabase Cloud)

1. Create an hCaptcha account → add a site → copy the **site key** and
   **secret key** (https://dashboard.hcaptcha.com).
2. Supabase Dashboard → **Authentication → Security → Bot and Abuse
   Protection → CAPTCHA** → enable, choose **hCaptcha**, paste the **secret
   key**, save.
3. Put the **site key** in `.env`:

   ```
   VITE_CAPTCHA_SITE_KEY=<your hcaptcha site key>
   ```

4. Restart `npm run dev`.

### Behavior

- **Registration and Sign in**: when a site key is configured, the form shows
  the hCaptcha widget and a completed token is REQUIRED before the request is
  sent. The token is forwarded to `supabase.auth.signUp()` / 
  `supabase.auth.signInWithPassword()` as `options.captchaToken` and verified
  by Supabase Auth against the secret. Submitting without a completed token is
  blocked with "Please complete the CAPTCHA to continue."
- **Important**: with CAPTCHA enabled in Supabase, password sign-in WITHOUT a
  token is rejected by Supabase (HTTP 400 `token?grant_type=password`). hushh
  now always sends the token when CAPTCHA is enabled.
- Failed or expired tokens reset the widget so a fresh, single-use token is
  required on the next attempt.
- Without a site key (local dev / preview / tests): the widget is skipped and
  auth works normally — the app stays runnable without extra credentials.
- No new backend, no new Edge Function, no npm package: it uses the existing
  Supabase Auth endpoints.

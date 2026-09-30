# hushh

**hushh** is a private, real-time messaging web app.

Instead of showing an email address, users find each other with a **Chat ID** — no email, no phone number, no noise.

```text
                         hushh
                           |
                    React + Vite
                           |
                    Supabase Client
                           |
             +-------------+-------------+
             |             |             |
        Supabase Auth   PostgreSQL    Realtime
             |             |             |
           login       profiles       messages
                        secrets      conversations
                           |
                    recover-password
                     Edge Function
                           |
                    Supabase Admin
                           |
                     password reset
```

There is no traditional backend server. The app uses Supabase for authentication, PostgreSQL and Realtime, with one Edge Function for password recovery.

---

## What hushh does

- Create an account with a display name, Chat ID, password and security question/answer.
- Get a secret **Recovery ID** when registering.
- Log in with **Chat ID + password**.
- Search for other users by Chat ID and start private 1:1 conversations.
- Send and receive messages in real time.
- View message history and delete your own messages.
- Recover a password with the Recovery ID and security answer.
- See unread message counts for each conversation.
- Delete a chat from your own list without deleting it for the other person.
- Choose one of 12 bundled avatars from Settings.

### Portability

I wanted the project to be easy to move between machines.

A fresh copy only needs the environment variables for the existing Supabase project:

```bash
npm install
npm run dev
```

Users, messages and the database schema stay in Supabase. There is no local database or persistent backend server to set up.

---

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React 18 + Vite 5 |
| Routing | react-router-dom |
| Backend services | Supabase Auth, PostgreSQL, Realtime |
| Server-side code | Supabase Edge Function (Deno) |
| Testing | Vitest |

The project intentionally keeps the backend small: most of the application logic is handled by Supabase Auth, PostgreSQL/RLS and Realtime.

---

## How it works

### Chat ID

Supabase Auth normally works with email/password credentials, but hushh does not expose an email field to users.

The frontend turns the normalized Chat ID into an internal email value:

```text
Soumyadeep
    ↓
soumyadeep@<your-project-hostname>
```

That value is only used internally for Supabase Auth. It is not shown or used as a public profile field.

Chat IDs are also unique in the database.

### Passwords and recovery

Login passwords are handled by Supabase Auth.

The separate recovery system uses:

- a generated Recovery ID
- a security question and answer
- PBKDF2 for security-answer hashes
- SHA-256 for stored Recovery IDs

The Recovery ID is shown once after registration and is not stored in browser storage.

Password recovery happens through the `recover-password` Edge Function because an administrative password reset should not happen directly in the browser.

The basic flow is:

```text
Forgot password
      ↓
Recovery ID
      ↓
Security question
      ↓
Security answer
      ↓
New password
      ↓
recover-password
      ↓
Supabase Auth
```

The recovery endpoint also rate-limits failed attempts.

### Row Level Security

RLS is enabled on the user-sensitive tables.

| Table | Access |
| --- | --- |
| `profiles` | Users can manage their own profile |
| `user_secrets` | Client can insert its own row; secrets are not readable by clients |
| `conversations` | Participants can read their conversations |
| `conversation_participants` | Participants can read their own memberships |
| `messages` | Participants can read messages; users can create/update their own messages |
| `recovery_attempts` | Server-side only |

Realtime follows the same database access rules, so users only receive events they are allowed to access.

---

## Project structure

```text
hushh/
├── .env.example
├── package.json
├── vite.config.js
├── index.html
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql
│   │   ├── 0002_rls_and_functions.sql
│   │   ├── 0003_realtime.sql
│   │   ├── 0004_hardening.sql
│   │   ├── 0005_fix_recursive_rls.sql
│   │   └── 0006_unread_delete_avatars.sql
│   │
│   └── functions/
│       └── recover-password/
│           └── index.ts
│
├── src/
│   ├── lib/
│   │   └── supabase.js
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── utils/
│   ├── data/
│   └── styles/
│
└── tests/
```

The frontend follows a simple:

```text
UI → services → Supabase
```

pattern, keeping database calls out of the UI components.

---

## Supabase setup

The project uses an existing Supabase Cloud project. There is no local PostgreSQL setup and the Supabase CLI is not required.

### 1. Create a Supabase project

Create a project at [Supabase](https://supabase.com).

### 2. Configure Auth

In **Authentication → Sign In / Providers → Email**:

- Turn **Confirm email** off.
- Keep new user sign-ups enabled.
- The app already checks its own password requirements.

### 3. Apply the migrations

The migrations in `supabase/migrations/` contain the database schema, RLS policies, functions, triggers and Realtime configuration.

Apply them to the Supabase project in order:

```text
0001_schema.sql
0002_rls_and_functions.sql
0003_realtime.sql
0004_hardening.sql
0005_fix_recursive_rls.sql
0006_unread_delete_avatars.sql
```

The migration files are kept in the repository so the database structure can be recreated and tracked alongside the code.

### 4. Deploy the recovery function

Create an Edge Function called:

```text
recover-password
```

Then use the contents of:

```text
supabase/functions/recover-password/index.ts
```

as the function source.

Because password recovery is available while logged out, JWT verification for this function needs to be disabled. The function has its own checks and rate limiting.

Supabase provides the function with:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key stays on the server and is never placed in the frontend.

### 5. Environment variables

Copy the example file:

```bash
cp .env.example .env
```

Then add:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

Only the public Supabase URL and anon/publishable key are needed by the frontend.

---

## Run locally

```bash
npm install
npm run dev
```

The development server runs on:

```text
http://localhost:5173
```

Other useful commands:

```bash
npm test
npm run build
npm run preview
```

---

## Security notes

A few decisions I made while building hushh:

- Login passwords are handled by Supabase Auth.
- Recovery IDs are generated randomly and only their hashes are stored.
- Security answers are stored as PBKDF2 hashes with per-user salts.
- Chat IDs are normalized and enforced as unique by the database.
- Conversation membership is controlled by PostgreSQL/RLS rather than trusting the client.
- Message ownership is checked by the database.
- Messages are text-only in v1 and have a length limit.
- A successful password recovery revokes existing sessions.
- The service-role key is only available to the Edge Function.

The goal was to keep the application small while letting the database enforce the important rules instead of relying only on frontend checks.

---

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Account created but sign-in is pending | Turn off email confirmation |
| User already registered | The Chat ID may already be taken |
| Registration succeeds but no profile appears | Check Auth settings and RLS migrations |
| No realtime messages | Check the Realtime publication for `messages` and `conversations` |
| Password recovery fails | Check that `recover-password` is deployed and JWT verification is disabled |

---

## Tests

Run:

```bash
npm test
```

The test suite covers things such as:

- Chat ID validation and normalization
- password and registration validation
- Recovery ID generation and validation
- security-answer hashing
- recovery logic and rate limiting
- conversation key generation
- message validation
- security-related database configuration

There is also an optional live security test:

```bash
npm run test:security
```

It uses a dedicated Supabase test project and should not be run against a production database.

---

## CAPTCHA

hushh can use Supabase Auth's CAPTCHA protection with hCaptcha for registration and sign-in.

The frontend needs:

```env
VITE_CAPTCHA_SITE_KEY=<your-hcaptcha-site-key>
```

The hCaptcha secret is configured in Supabase Cloud and never reaches the browser.

When no site key is configured, the CAPTCHA widget is skipped, which keeps local development and tests simple.

---

## Current scope

hushh is intentionally small for its first version.

It currently focuses on private 1:1 messaging and does not include:

- group chats
- file storage
- profile photo uploads
- device/session management

Those are separate problems, and I wanted the first version to stay focused.

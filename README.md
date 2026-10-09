# Gather — community workshop registration

Live UI: https://gather-workshop-desk-20261009.netlify.app. The login screen clearly distinguishes sample demo mode from real Supabase staff access.

Next.js 16 + TypeScript frontend and API, Supabase Auth/PostgreSQL backend, deployed with Netlify's Next.js adapter. Node **22 or newer** is required.

## Run locally

1. Install Node 22+ and Docker Desktop. Run `npm ci`.
2. Run `npx supabase start`, then `npx supabase db reset`. The committed `supabase/config.toml` disables public signup and the migration creates the schema and checked RPCs.
3. Copy `.env.example` to `.env.local`. Set the URL, anonymous key, and service role key printed by `npx supabase status`. Choose a development-only `SEED_PASSWORD` of at least 12 characters. Keep the service role key server-side and never commit `.env.local`.
4. Run `npm run seed`, then `npm run dev`. Open http://localhost:3000.

Seeded logins: `admin@gather.test`, `manager@gather.test`, `staff@gather.test`. All use **your configured SEED_PASSWORD**. For a disposable local installation, `Gather-local-demo-2026!` is a suitable development-only example. Six future workshops are seeded. Seeding does not reset existing account passwords or duplicate workshops.

## Hosted Supabase setup

Create a dedicated project in your existing Supabase account. Apply `supabase/migrations/202610090001_workshop_service.sql` in the SQL Editor, or use `npx supabase link --project-ref YOUR_PROJECT_REF` and `npx supabase db push`. In Authentication → Providers → Email, **disable “Allow new users to sign up”**; disabling the signup UI alone is insufficient. Set the site URL to your Netlify URL. Set the project URL, publishable/anon key and service role key in `.env.local` and seed. Do not reuse the example local password on a publicly hosted project.

## Netlify deployment

The `netlify.toml` uses `npm run build`, publishes `.next`, and selects Node 22. Netlify detects Next.js and installs its OpenNext adapter. Create/link a Netlify project. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for build and functions. The two public variables must exist **at build time**; changing them requires rebuilding. Keep `SEED_PASSWORD` local. Run `netlify deploy --build --prod` or connect this repository for automatic builds.

The app has an explicit **Try manager / staff / admin** demo on the login screen. It uses sample data stored in sessionStorage and does not call or bypass the production API. It is for UI exploration, not shared durable data. Real staff access requires the Supabase setup above.

## Permissions

| Operation                                     | Admin | Manager | Staff |
| --------------------------------------------- | ----- | ------- | ----- |
| Create accounts and set roles                 | Yes   | No      | No    |
| Add/edit workshops                            | No    | Yes     | No    |
| Register/cancel attendees                     | No    | Yes     | Yes   |
| View workshops, registrations and their audit | No    | Yes     | Yes   |

Next.js verifies each bearer token with Supabase Auth and reads the authoritative profile role. RLS limits reads. Direct writes are revoked; security-definer RPCs enforce roles again. An Admin's audit view contains only account events. Role changes cannot remove the last Admin. Account passwords are used only in the server's Auth Admin API and are never logged or audited.

## Booking integrity

`register_attendee`, `cancel_registration`, and `save_workshop` acquire the same `SELECT … FOR UPDATE` workshop lock. A transaction checks capacity and increments the counter together with the registration and audit insert. The capacity constraint adds a second check. Cancellations never delete records; they retain both actors/timestamps and decrement the counter only once. Capacity cannot fall below existing bookings. Duplicate active emails are refused by a partial unique index. A cancelled attendee can be registered again as a new historical record. Cancelling a workshop requires first cancelling its active registrations. Past or non-scheduled workshops refuse new bookings.

## HTTP API

Send `Authorization: Bearer <Supabase access token>` on every request and `Content-Type: application/json` for mutations. Supabase Auth handles password sign-in; there is no signup endpoint.

| Method and path                | Purpose                                                         | Permitted roles       |
| ------------------------------ | --------------------------------------------------------------- | --------------------- |
| GET `/api/data`                | Role-filtered profile, catalogue, registrations, team and audit | All, filtered by role |
| POST `/api/workshops`          | Create/edit with optional `id`                                  | Manager               |
| POST `/api/registrations`      | Register using `workshop_id`, `attendee_name`, `attendee_email` | Manager, Staff        |
| PATCH `/api/registrations/:id` | Cancel idempotently                                             | Manager, Staff        |
| POST `/api/users`              | Create Auth account and role profile                            | Admin                 |
| PATCH `/api/users`             | Set `id` and `role`                                             | Admin                 |

Responses are JSON; errors include a human-readable `error`. Validation failures return 400, unauthorized/forbidden requests 401/403, and duplicates 409. With no configured database, API routes return 503 and demo mode remains available.

## Verification

`npm run typecheck`, `npm test`, and `npm run build`. Unit/database tests apply the **actual migration** to PGlite PostgreSQL and exercise RPC permissions, RLS, direct-write denial, capacity limits, duplicate bookings, retained history, and last-admin protection. PGlite executes requests in one embedded database; it does **not** establish multi-session production concurrency. After connecting and seeding Supabase, `npm run test:integration` sends twenty truly simultaneous network booking requests for one seat, and checks exactly one succeeds. It creates an identifiable test workshop, cancels its registrations, and retains the workshop as cancelled for audit.

All list APIs paginate Supabase reads to retain access to the full history. Dashboard data refreshes every 15 seconds and after writes; final seat allocation is always decided by the database.

See `DESIGN.md` for the short design statement. Waitlists, notification emails, password recovery, export, and staff deactivation are outside this implementation's scope.

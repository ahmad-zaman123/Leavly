# Leavly

A small, informal leave tracker for a group of colleagues: everyone logs their own leave, it counts immediately, and balances exclude weekends and public holidays. There is no approval step.

## Roles

- **Admin** adds colleagues (name, email, starting password), sees every balance, overrides a person's allowance, manages leave types, weekend days and public holidays, and can remove a wrongly logged leave.
- **Member** logs leave, removes their own, sees their balance and the team calendar, and can change their password.

The first account, created at `/register`, becomes the admin. After that nobody can self-register; the admin adds people from the Admin page.

## Run locally

```bash
cp .env.example .env      # defaults to a local SQLite file
npm install
npm run db:push           # creates the tables in local.db
npm run dev               # http://localhost:3000
```

## Deploy to Vercel

The app needs a hosted database. [Turso](https://turso.tech) is a hosted SQLite that works with the same driver, and has a free tier.

1. Create the database and get its credentials:
   ```bash
   turso db create leavly
   turso db show leavly --url        # libsql://...
   turso db tokens create leavly     # the auth token
   ```
2. Create the tables in it from your machine:
   ```bash
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:push
   ```
3. Push the project to GitHub and import it in Vercel. Framework preset: Next.js, no special build settings.
4. Add these environment variables in the Vercel project:
   - `DATABASE_URL` = the libsql URL
   - `DATABASE_AUTH_TOKEN` = the token
   - `AUTH_SECRET` = a long random string (`openssl rand -base64 32`)
5. Deploy, open the site, and create the first account. That account is the admin; add everyone else from the Admin page.

Vercel also offers Turso through its Marketplace (Storage tab), which fills in the two database variables for you.

## Stack

Next.js 15 (App Router, server actions), Drizzle ORM, libsql/SQLite, signed-cookie sessions (jose), bcrypt password hashing.

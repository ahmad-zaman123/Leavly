<h1 align="center">🗓️ Leavly</h1>

<p align="center">
  <b>Leave, kept simple.</b><br/>
  One place for a small team's days off. Log a day in two clicks, see your balance, never update a spreadsheet again.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000?logo=nextdotjs&logoColor=white&style=flat-square" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square" alt="React 19" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black&style=flat-square" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/SQLite-Turso-4169E1?logo=sqlite&logoColor=white&style=flat-square" alt="SQLite / Turso" />
  <img src="https://img.shields.io/badge/deploy-Vercel-000?logo=vercel&logoColor=white&style=flat-square" alt="Vercel" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-how-it-counts">How it counts</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-admin">Admin</a> ·
  <a href="#%EF%B8%8F-deployment">Deployment</a>
</p>

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Leavly dashboard with balance, log leave box and calendar" width="860" />
</p>

---

## 🧭 What is Leavly?

An informal leave tracker for a group of colleagues who do not have an HR system. Everyone logs their own leave and it counts straight away, with no approval step. Balances count **working days only**: weekends and public holidays are never deducted. An admin adds people, sets the allowances and holidays, and gets a monthly report of who was away.

| ✍️ Log | 📊 Balance | 👥 Team |
|---|---|---|
| Pick a type, a date or a range, optionally a half day, and you are done | Days left per type and in total for the leave year, with history and a running balance | Admins see the whole team on a calendar, a weekly strip and a monthly report |

## 🚀 Quick start

**Prerequisites:** Node 18+. Nothing else; the local database is a SQLite file.

```bash
git clone https://github.com/ahmad-zaman123/leavly.git
cd leavly
cp .env.example .env      # defaults to a local SQLite file
npm install
npm run db:push           # creates the tables in local.db
npm run dev               # http://localhost:3000
```

Open `/register`. The **first account becomes the admin**. After that nobody can self-register; the admin adds colleagues from the Admin page and gives each a starting password, which they must replace on first sign-in.

<details>
<summary><b>🔧 Environment variables</b> (<code>.env</code>)</summary>
<br/>

| Key | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | `file:local.db` locally, or a Turso `libsql://…` URL in production. |
| `DATABASE_AUTH_TOKEN` | prod | Turso auth token. Leave empty for the local file. |
| `AUTH_SECRET` | **prod** | Long random string used to sign sessions. `openssl rand -base64 32`. |

</details>

<details>
<summary><b>📜 Scripts</b></summary>
<br/>

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:push` | Create or update the database tables from the schema |
| `npm run format` | Prettier over `src/` |

</details>

## 🧮 How it counts

```
 leave year ──▶ starts in July (configurable) ──▶ 2026–27 = 1 Jul 2026 … 30 Jun 2027
                                                        │
 entry ──▶ every date from → to ──▶ skip weekends ──▶ skip public holidays ──▶ ½ if half day ──▶ days used
```

| Rule | Default |
|---|---|
| Leave types and allowance | Casual 14 · Sick 10 · **24 days a year** |
| Leave year | July to June, set on the Settings page |
| Weekend | Saturday and Sunday, any days can be chosen |
| Public holidays | Per date, or repeating every year |
| Half days | A single working day counted as 0.5 |
| Over the balance | Allowed, with a warning before saving |
| Overlaps | Blocked; one entry per person per day |
| Year boundary | An entry across 30 June is split between the two leave years |

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### ✍️ Log leave in seconds
Type chips, Yesterday / Today / Tomorrow, an inline date picker in the app's own format, or click and drag on the calendar. The summary and the button tell you exactly what will be saved, and overlaps or weekend-only dates are caught before you press it.

### 📅 Calendar
Month and week views with your leave as coloured pills, holidays named, today marked. Press <kbd>L</kbd> anywhere to jump to the form.

### 📊 Balance and history
Days left in total and per type, next and last leave at a glance, and a My leaves page with totals, a type filter, a running balance per row and CSV export.

</td>
<td width="50%" valign="top">

### ↩️ Undo, not confirm
Removing a leave is instant, with an Undo toast. Deactivating a person asks first.

### 🔒 Private by default
Members see only their own leave. Admins see everyone. Sessions are signed cookies, passwords are bcrypt hashed, and new people must choose their own password on first sign-in.

### 🌗 Light, dark, phone
Light and dark themes, a bottom-sheet form and floating button on phones, and a web manifest so it installs to a home screen.

</td>
</tr>
</table>

## 🛡️ Admin

<p align="center">
  <img src="docs/screenshots/admin-team.png" alt="Admin team tab with this week strip and people" width="860" />
</p>

| Tab | What you can do |
|---|---|
| **Team** | Add people, search and sort, open a person to set per-type allowances, change their role, reset their password or deactivate them. A This week / This month strip shows who is off, and Upcoming leave lists everyone's future entries with remove and undo. |
| **Away** | Any month at a glance: people away, days of leave, busiest day, a per-day strip and a per-person list. Export the month as CSV. |
| **Settings** | Leave types and their days, the month the leave year starts, weekend days, and public holidays, one-off or repeating every year. Changes save as you leave a field. |

<p align="center">
  <img src="docs/screenshots/admin-away.png" alt="Admin monthly away report" width="860" />
</p>

## 🛠️ Tech stack

| Layer | Tech |
|---|---|
| **Framework** | Next.js 15 (App Router, server actions), React 19 |
| **Database** | SQLite via libsql, Drizzle ORM; Turso in production |
| **Auth** | Signed-cookie sessions (jose), bcrypt password hashing |
| **Styling** | Hand-written CSS with light and dark theme tokens |
| **Deployment** | Vercel + Turso |

## 🗂️ Project structure

```
leavly/
├── src/
│   ├── app/
│   │   ├── page.tsx            dashboard
│   │   ├── leaves/             my leaves
│   │   ├── account/            change password
│   │   ├── admin/              team · away · settings
│   │   └── login · register · welcome
│   ├── components/             dashboard, forms, calendar, date picker, admin
│   ├── db/                     Drizzle schema and client
│   ├── lib/
│   │   ├── actions.ts          all server actions
│   │   ├── auth.ts             sessions
│   │   ├── dates.ts            working-day and leave-year maths
│   │   └── data.ts             queries and balances
│   └── middleware.ts           route guard
└── public/                     icons and manifest
```

## ☁️ Deployment

The app needs a hosted database. [Turso](https://turso.tech) is hosted SQLite that uses the same driver and has a free tier.

1. Create the database and get its credentials:
   ```bash
   turso db create leavly
   turso db show leavly --url        # libsql://…
   turso db tokens create leavly     # the auth token
   ```
2. Create the tables in it from your machine:
   ```bash
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:push
   ```
3. Import the repository in [Vercel](https://vercel.com/new) with the Next.js preset and set `DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `AUTH_SECRET`.
4. Deploy, open the site, create the first account at `/register`, and add everyone else from the Admin page.

Turso is also available in Vercel's Marketplace under Storage, which fills in the two database variables for you.

## 📄 License

[MIT](LICENSE) © 2026 Ahmad Zaman

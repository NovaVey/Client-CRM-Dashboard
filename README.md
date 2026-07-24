# Client CRM Dashboard

A lightweight CRM for small businesses to keep track of clients and leads in one place. It centralizes contacts, notes, and follow-up tasks behind a simple dashboard, so a solo operator or small team can see at a glance who needs attention without the overhead of a full-featured sales platform. Built by Nova Vey Engineering as a portfolio project.

## Features

- **Dashboard summary** — at-a-glance counts of total contacts, open leads, and upcoming/overdue follow-up tasks.
- **Contact list** — searchable and filterable view of all clients and leads.
- **Contact detail view** — per-contact history of notes and associated follow-up tasks.
- **Notes** — add or remove freeform notes on any contact to track conversations and context.
- **Follow-up tasks** — create tasks tied to a contact, mark them complete, or delete them.
- **Overdue task flagging** — tasks past their due date are visually flagged so nothing falls through the cracks.
- **Realistic seed data** — a seed script populates 20 sample contacts with notes and tasks so the app looks lived-in immediately.
- **Email reminders (optional)** — an opt-in daily digest email listing overdue and soon-due tasks, sent via [Resend](https://resend.com). Off by default; see [Email Reminders](#email-reminders) below.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL, accessed via the [`pg`](https://node-postgres.com/) driver using raw SQL (no ORM)
- **Frontend:** Vanilla HTML, CSS, and JavaScript — a single-page app with no framework and no build step

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL running locally or accessible via connection string

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/NovaVey/client-crm-dashboard.git
   cd client-crm-dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example env file and fill in your database connection string and port:

   ```bash
   cp .env.example .env
   ```

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/client_crm
   PORT=3004
   ```

4. **Create the database**

   ```bash
   createdb client_crm
   ```

5. **Apply the schema**

   ```bash
   npm run db:init
   ```

6. **Seed sample data**

   Loads 20 realistic small-business contacts with notes and follow-up tasks, so the dashboard has meaningful data right away:

   ```bash
   npm run db:seed
   ```

7. **Start the app**

   ```bash
   npm start
   ```

   Or, for auto-reload during development:

   ```bash
   npm run dev
   ```

8. Visit **http://localhost:3004**

## Email Reminders

The app can send a daily digest email ("3 overdue, 2 due this week") listing incomplete tasks that are overdue or due within 3 days. It's **disabled by default** and only turns on if you explicitly configure it.

### Configuration

Set these in your `.env` (or your host's environment variables):

| Variable | Required | Description |
|---|---|---|
| `REMINDER_EMAILS_ENABLED` | Yes | Set to `true` to turn reminders on. Any other value (or unset) keeps them off. |
| `RESEND_API_KEY` | Yes, if enabled | API key from your [Resend](https://resend.com) account. |
| `REMINDER_FROM_EMAIL` | Yes, if enabled | The verified sender address in Resend (e.g. `reminders@yourdomain.com`). |
| `REMINDER_TO_EMAIL` | No | Address the digest is sent to. Defaults to the app owner's email if unset. |

You can check the current status and send a digest on demand from the **Dashboard** view (an "Email Reminders" card shows enabled/disabled and has a "Send Now" button), or via the API:

- `GET /api/reminders/status` — `{ "enabled": true|false }`
- `POST /api/reminders/send` — sends the digest immediately if enabled and there's anything due; otherwise responds with a reason and sends nothing.

### Scheduling a daily send

For a recurring digest (rather than manual "Send Now" clicks), run the standalone job on a schedule:

```bash
npm run reminders:send
```

This script connects to the database, checks `REMINDER_EMAILS_ENABLED`, and sends (or skips) accordingly, then exits — it's meant to be invoked by a scheduler, not left running. On Railway, add a **Cron Job** service pointed at this repo with the start command `npm run reminders:send` and the same environment variables as the main app (`DATABASE_URL`, `REMINDER_EMAILS_ENABLED`, `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `REMINDER_TO_EMAIL`), scheduled once daily.

## API Reference

| Method | Endpoint | Description |
|--------|----------|--------------|
| GET | `/api/dashboard` | Get summary stats (contact counts, open leads, upcoming/overdue tasks) |
| GET | `/api/contacts` | List all contacts |
| POST | `/api/contacts` | Create a new contact |
| GET | `/api/contacts/:id` | Get a single contact, including its notes and tasks |
| PUT | `/api/contacts/:id` | Update a contact |
| DELETE | `/api/contacts/:id` | Delete a contact (also removes its notes and tasks) |
| POST | `/api/notes` | Add a note to a contact |
| DELETE | `/api/notes/:id` | Delete a note |
| POST | `/api/tasks` | Create a follow-up task for a contact |
| PATCH | `/api/tasks/:id/complete` | Mark a task as complete |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/reminders/status` | Check whether email reminders are enabled |
| POST | `/api/reminders/send` | Send the overdue/due-soon task digest email now (if enabled) |

## License

MIT — see [LICENSE](LICENSE) for details.

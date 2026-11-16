# Police Performance Dashboard — run & host locally

React (frontend) + FastAPI (backend) + MongoDB. The two historical workbooks in `backend/seed/` are loaded automatically on first start.

## 1. Before you start: set up sign-in (Clerk, free)
The hosted version uses Emergent-managed sign-in. Locally you need your own Clerk application:
1. Create a free account at https://dashboard.clerk.com → **Create application** → enable **Email** + **Password**.
2. Copy the **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`) from **API Keys**.
3. `cp backend/.env.example backend/.env` and paste both keys into `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
4. Set `WEBHOOK_CRON_SECRET` to any long random string.

The email in `ADMIN_EMAIL` becomes admin automatically after it signs up and verifies its address. All other users start as *Pending approval* until the admin assigns a role.

## 2a. Easiest: Docker (one command)
Requires Docker Desktop.
```bash
docker compose up --build -d
```
Open http://localhost:3000. To stop it, run `docker compose down`. Data is kept in the `mongo_data` volume.

## 2b. Without Docker (developer mode)
Requires Python 3.11+, Node 20+, Yarn 1.x, and MongoDB 6+ running on `localhost:27017`.
```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# frontend (new terminal)
cd frontend
cp .env.example .env
yarn install
yarn start            # opens http://localhost:3000
```
In this mode `CORS_ORIGINS` in `backend/.env` must include `http://localhost:3000`.

## 3. Scheduled jobs (daily data sync, monthly report)
The hosted platform runs these automatically. Locally you can trigger them yourself or with your OS scheduler:
```bash
./run_cron.sh daily-sync            # syncs API sources set to "Daily"
./run_cron.sh monthly-report        # builds and emails the leadership report
```
Crontab example (Linux/macOS): `30 3 1 * * /path/to/run_cron.sh monthly-report` and `30 0 * * * /path/to/run_cron.sh daily-sync`.
For developer mode, pass the backend URL as the second argument: `./run_cron.sh daily-sync http://localhost:8001`.

## 4. Email
Report emails use Emergent's managed email service (`EMERGENT_EMAIL_KEY`), which is only available on the Emergent platform. Locally, reports are still created and downloadable as PDF from the **Reports** page. The email deliveries show as *failed* until a key is configured. To send email from your own server, replace `send_email` in `backend/emailer.py` with your own email provider (SMTP, Resend, SES, etc.).

## 5. Hosting on your own server
- Run the Docker setup on a Linux VM and put HTTPS in front of port 3000 (e.g. Caddy or nginx with Let's Encrypt).
- In Clerk, create a **production** instance for your domain and use its `pk_live_`/`sk_live_` keys. With live keys the app sends Clerk traffic through `https://<your-domain>/api/__clerk`. In the Clerk dashboard, go to **Domains → Proxy** and set the proxy URL to that address. Alternatively, add the DNS records Clerk lists.
- Back up the `mongo_data` volume regularly (`mongodump`).

## Project layout
```
backend/   server.py (API), scoring.py (KPI engine), workbook.py (Excel import),
           reports.py (PDF), emailer.py, clerk_auth.py, seed/*.xlsm
frontend/  src/pages (Overview, dashboards, Trends, Reports, Approvals, Admin), src/components
```
See `PRD.md` for the full feature list.

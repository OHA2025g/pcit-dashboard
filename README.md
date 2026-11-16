# Police Performance Dashboard — run & host locally

React (frontend) + FastAPI (backend) + MongoDB. The two historical workbooks in `backend/seed/` are loaded automatically on first start.

## 1. Before you start: set up sign-in
The app uses self-hosted email + password login (JWT sessions stored in the browser).
1. `cp backend/.env.example backend/.env`
2. Set `AUTH_JWT_SECRET` to a long random string (16+ characters).
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` — on first start the backend creates that admin account if none exists.
4. Set `WEBHOOK_CRON_SECRET` to any long random string.

Anyone can register at `/sign-up`. The `ADMIN_EMAIL` address gets the **admin** role; all other new users start as *Pending approval* until an admin assigns a role.

## 2a. Easiest: Docker (one command)
Requires Docker Desktop.
```bash
docker compose up --build -d
```
Open http://localhost:8200 and sign in. To stop it, run `docker compose down`. Data is kept in the `mongo_data` volume.

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
- Run the Docker setup on a Linux VM and put HTTPS in front of port 8200 (e.g. Caddy or nginx with Let's Encrypt).
- Use a strong unique `AUTH_JWT_SECRET` and `ADMIN_PASSWORD` in production; never commit real secrets.
- Back up the `mongo_data` volume regularly (`mongodump`).

## Project layout
```
backend/   server.py (API), scoring.py (KPI engine), workbook.py (Excel import),
           reports.py (PDF), emailer.py, auth.py, seed/*.xlsm
frontend/  src/pages (Overview, dashboards, Trends, Reports, Approvals, Admin), src/components
```
See `PRD.md` for the full feature list.

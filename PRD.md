# Police Performance Dashboard — PRD

## Original problem
"The details to create the dashboard is attached in the document and excel, create dashboarding platform using it" — BRD PDF (Police Performance Dashboard) + Conviction_Final Dashboard_v3.xlsm + 60_90_Final Dashboard_v3.xlsm.

## User choices
Email+password login (Emergent-managed Clerk); roles Admin / State viewer / Range viewer (new users = pending); ADMIN_EMAIL=aghoreshwar@hotmail.com; seed from workbooks + admin uploads newer versions; extras: per-unit step explanation, CSV/XLSX/PDF export, editable scoring rules, audit log, provision for API data sources.

## Architecture
FastAPI + MongoDB (datasets, facts, policy, policy_versions, users, audit, api_sources) · React + recharts + shadcn · Clerk auth (clerk_auth.py). scoring.py = KPI engine (replicates Excel formulas, sums counts before rates); workbook.py = macro-free XLSM "Source Data" parser.

## Implemented (2026-06)
- Overview (both domains: KPIs, top/bottom 5, category distribution, range comparison)
- Conviction & Timeliness dashboards: filters (type, unit, base/latest period, range, category), 8 KPIs, 10 BRD chart views, sortable/searchable ranking table, 10/11-step worked explanation dialog + PDF
- Exports CSV/XLSX/PDF with filter context & definitions (logged)
- Admin: workbook upload/versions/activate/archive, scoring policy editor (weights, bands, rank bands, versions), users & roles (range scope), API source config (test/sync JSON feed), audit log
- Verified scores match Excel Rankings sheets exactly

## Backlog
- DONE (iteration 3): Section A KPIs — acquittal rate, Session−JMFC gap, pending charge sheets, late rate, consistency (std-dev), rank movement, workload share, combined index (policy combined_weight, via approval) maker-checker approval (Approver role), daily API source auto-sync (platform cron), unit trend view, monthly leadership email + server PDF (Resend, cron 1st @ 9:00 IST)
- P1: independent policy approver workflow (BRD maker-checker); scheduled API sync; data-quality exception review before publish
- P2: protected server-side export files with expiry/checksum; scheduled email reports; Training/ATS forms (pending department decision)

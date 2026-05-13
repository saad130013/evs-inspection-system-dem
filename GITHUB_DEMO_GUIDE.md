# GitHub Demo Guide

This copy is prepared for GitHub demo and presentation use.

## Included

- Full React + Vite frontend.
- Full Express backend.
- Authentication and roles.
- Inspection form with Public, Mid Risk, and High Risk templates.
- Category then Area selection.
- Photo upload and camera capture support.
- PDF and HTML report generation.
- Excel summary generation.
- Weekly and monthly reports.
- Monthly deduction calculation.
- Monthly report Excel.
- Dashboard, filters, quick search, and report viewer.
- Daily backup service.

## Demo Login Accounts

```text
Admin:
username: admin
password: admin123

Manager:
username: manager
password: manager123

Supervisor:
username: supervisor
password: super123

Inspector:
username: inspector
password: inspect123
```

## Demo Data

This GitHub copy keeps demo users, checklist templates, locations, categories, and issue options.

`server/data/submissions.json` starts empty so demos can create fresh reports safely.

Generated reports, Excel files, and backups are created locally under `storage/` when the app is used.
Those runtime files are ignored by Git through `.gitignore`.

## Run

```bash
npm install
npm run install:all
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:4000
```

## Recommended Demo Flow

1. Login as `inspector / inspect123`.
2. Submit a Public Area inspection.
3. Add at least one photo or camera capture.
4. Login as `manager / manager123`.
5. Open Dashboard.
6. Use quick search.
7. Open the generated report.
8. Export Excel.
9. Generate Weekly PDF.
10. Generate Monthly PDF and Monthly Excel.

## Deploy Frontend To Vercel

This repository includes `vercel.json` so Vercel can build the React app from the `client` folder.

Vercel settings:

```text
Framework Preset: Other or Vite
Build Command: npm run build --prefix client
Output Directory: client/dist
Install Command: npm install && npm run install:all
```

Important: Vercel can host the frontend, but the Express backend uses local file storage, Excel files, Puppeteer PDF generation, and daily backups. Those backend features are designed for a local/server machine, not Vercel static hosting.

For full online demo, deploy the backend separately on a Node server that supports persistent storage, then set this Vercel environment variable:

```text
VITE_API_BASE=https://your-backend-domain.com
```

For local/internal network use, run both frontend and backend on the same machine with `npm run dev`.

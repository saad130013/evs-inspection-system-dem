# EVS Inspection Checklist System

نظام إلكتروني لجولات تفتيش خدمات البيئة / التدبير المنزلي في المستشفى.

The system allows inspectors to complete inspection checklists online, generate PDF/HTML reports, attach violation photos, and maintain Excel summaries for all submissions.

## What The System Does

- تسجيل الدخول حسب الدور الوظيفي.
- تعبئة نماذج التفتيش إلكترونياً.
- دعم 3 أنواع من النماذج:
  - Public Area
  - Mid Risk Area
  - High Risk Area
- حساب الدرجة تلقائياً:
  - Total Score
  - Maximum Score
  - Percentage
  - Rating
- إرفاق صور المخالفات مع كتابة ملاحظة تحت كل صورة.
- إنشاء تقرير HTML و PDF.
- حفظ تقارير كل مفتش في مجلد مستقل حسب الشهر.
- تحديث ملف Excel شامل لكل المفتشين.
- إنشاء ملف Excel شهري شامل لكل المفتشين.
- داشبورد لعرض التقارير والفلاتر والتفاصيل.
- تقرير إنجاز أسبوعي PDF للتقييمات.
- دعم عربي / إنجليزي واتجاه RTL للعربية.

## Tech Stack

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- PDF: Puppeteer
- Excel: ExcelJS
- Storage: Local folders
- Data: JSON files
- Auth: JWT-style token with secure password hashing

## Folder Structure

```text
client/                 React frontend
server/                 Express backend
server/data/            Checklists, users, master data, submissions
server/assets/          Hospital logo used in PDF/HTML reports
storage/reports/        Generated inspection reports
storage/weekly-reports/ Generated weekly achievement reports
storage/monthly-reports/ Generated monthly achievement reports
storage/excel/          Excel summary files
storage/backups/        Daily automatic backups
```

## Install

From the project root:

```bash
npm install
npm run install:all
```

If Puppeteer cannot download a browser because of network restrictions, the backend can still save HTML reports, but PDF generation may fail until Puppeteer is available.

## Run Locally

Run frontend and backend together:

```bash
npm run dev
```

URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
```

Run separately if needed:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

## Demo Users

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

## Roles And Permissions

Inspector:

- Can submit inspections.
- Can view only their own reports.

Supervisor:

- Can access dashboard.
- Can view and review reports/photos.
- Can filter by inspector, location, date, score, and status.

Manager:

- Can view all reports.
- Can access dashboard KPIs.
- Can export Excel.

Admin:

- Full access.
- Can manage users.
- Can reset passwords.
- Can manage locations/master lists.
- Can manage checklist templates.
- Can export Excel.

## Report Storage

Reports are saved by inspector and month:

```text
storage/reports/INSPECTOR-NAME/YYYY-MM/
```

Example:

```text
storage/reports/demo-inspector/2026-05/inspection_2026-05-12_14-35_demo-inspector_public-area_3DBC6117.pdf
```

Each submission saves:

- PDF report
- HTML report

If photos are attached, they appear as extra pages after the main report.

## Excel Storage

Excel remains combined for all inspectors.

Main all-time file:

```text
storage/excel/inspection_summary.xlsx
```

Monthly combined file:

```text
storage/excel/inspection_summary_YYYY-MM.xlsx
```

Example:

```text
storage/excel/inspection_summary_2026-05.xlsx
```

## Change Storage Location

Copy `.env.example` to:

```text
server/.env
```

Then set:

```env
REPORT_STORAGE_PATH=../storage
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=change-this-secret-in-production
BACKUP_TIME=02:00
BACKUP_RETENTION_DAYS=30
```

## How To Use

1. Open the frontend:

```text
http://localhost:5173
```

2. Login with an inspector account.

3. Choose checklist type:

- Public Area
- Mid Risk Area
- High Risk Area

4. Fill:

- Area / Room #
- Main Category
- Area / Visit Location
- Date
- Time
- Supervisor
- Checklist scores
- Issues / observations
- Inspector comments

5. Optional: add photos.

- Click `Add Photos`.
- Select images.
- Write violation / observation under each photo.

6. Submit the inspection.

7. The system will:

- Generate PDF/HTML report.
- Save the report in the inspector monthly folder.
- Append the row to Excel.
- Show the report in the dashboard.

## Dashboard

The dashboard includes:

- Total inspections
- Average score
- Low / failed inspections
- Inspections by area type
- Inspections by inspector
- Filters
- Report table
- Report details viewer
- Quick report search by submission ID, inspector, location, room, or date
- PDF open button
- Excel export for Manager/Admin
- Weekly PDF achievement report for Supervisor/Manager/Admin
- Monthly PDF achievement report for Supervisor/Manager/Admin

Click a report row or `Report Viewer` to see report details.

## Weekly Achievement Report

From the dashboard, click:

```text
Weekly PDF
```

If `From` and `To` dates are selected in the filters, the weekly report uses that range.
If dates are empty, it generates the current week automatically.

The weekly report includes:

- Total inspection count.
- Average score.
- Number of evaluated areas.
- Count of scores below 70%.
- Score distribution:
  - Less than 70
  - 70 to 80
  - 80 to 90
  - 90 to 100
- Supervisor activity: how many inspections each supervisor reviewed.
- Inspector activity.
- Area type totals.
- Top 3 weakest areas.
- Weekly inspection list.

Weekly reports are saved under:

```text
storage/weekly-reports/YYYY-MM/
```

## Monthly Achievement Report

From the dashboard, click:

```text
Monthly PDF
```

If `From Date` is selected in the filters, the monthly report uses that same month from the first day to the last day.
If `From Date` is empty, it generates the current month automatically.

The monthly report includes the same KPI layout as the weekly report:

- Total inspection count.
- Average score.
- Monthly performance deduction based on the approved deduction table.
- Number of evaluated areas.
- Count of scores below 70%.
- Score distribution:
  - Less than 70
  - 70 to 80
  - 80 to 90
  - 90 to 100
- Supervisor activity.
- Inspector activity.
- Area type totals.
- Top 3 weakest areas.
- Monthly inspection list.

Monthly reports are saved under:

```text
storage/monthly-reports/YYYY-MM/
```

Each monthly report folder contains:

- Monthly PDF report.
- Monthly HTML report.
- Monthly Excel report with summary, deduction, inspections, supervisor activity, inspector activity, and weak areas.

Example:

```text
storage/monthly-reports/2026-05/monthly_inspection_report_2026-05-01_to_2026-05-31.xlsx
```

## Daily Automatic Backups

The backend creates one automatic backup every day.

Default backup time:

```text
02:00
```

Backup location:

```text
storage/backups/YYYY-MM-DD/
```

Each backup contains:

- `server-data/`: checklist templates, users, master data, and submissions.
- `storage/`: reports, weekly reports, monthly reports, and Excel files.
- `manifest.json`: backup details.

Admin-only API endpoints:

```text
GET  /api/backups/status
POST /api/backups/run
```

To change backup time or retention days, edit `server/.env`:

```env
BACKUP_TIME=02:00
BACKUP_RETENTION_DAYS=30
```

## Checklist Templates

Checklist templates are stored in:

```text
server/data/checklists.json
```

Example item:

```json
{
  "id": "pa-1",
  "label": "Carpet Clean",
  "maxScore": 6,
  "scores": [6, 4, 2, 0]
}
```

Rules:

- Keep every item `id` unique.
- `maxScore` should match the first/highest score.
- Restart the backend after editing templates.

## Master Data

Location categories and their related areas are stored in:

```text
server/data/masterData.json
```

The form uses `areaCategories` to show a main `Category` list first, then filters the `Area / Visit Location` list based on the selected category.

Inspectors, supervisors, locations, and issue options are stored in:

```text
server/data/masterData.json
```

Admin can also manage some lists from the dashboard.

## Hospital Logo

The hospital logo files are:

```text
client/public/hospital-logo.png
server/assets/hospital-logo.png
```

The frontend uses the client copy.
The PDF/HTML report uses the server copy.

## API Endpoints

```text
POST /api/auth/login
GET  /api/auth/me
GET  /api/config
POST /api/submissions
GET  /api/submissions
GET  /api/dashboard
GET  /api/reports/:submissionId
GET  /api/reports/:submissionId/html
GET  /api/export/excel
GET  /api/users
POST /api/users
PUT  /api/users/:id
POST /api/users/:id/reset-password
```

Most endpoints require login token.

## Production Notes

Before production:

- Set a strong `JWT_SECRET`.
- Change default demo passwords.
- Review access to the `storage` folder.
- Keep Excel files closed when submitting if possible.
- Back up `server/data` and `storage` regularly.

## Troubleshooting

Blank frontend page:

- Run `npm run build --prefix client`.
- Check browser console.
- Make sure frontend runs at `http://localhost:5173`.

Failed to fetch:

- Make sure backend runs at `http://localhost:4000`.
- Check `client/vite.config.js` proxy.
- Check CORS settings in `server/src/index.js`.

PDF not generated:

- Check Puppeteer installation.
- HTML report will still be saved as fallback.

Excel not updating:

- Close the Excel file if it is open.
- Pending rows are queued and flushed later.

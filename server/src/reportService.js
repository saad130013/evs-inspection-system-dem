import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import slugify from "slugify";
import { resolveStorageRoot } from "./paths.js";
import { buildReportHtml } from "./reportHtml.js";

function safePart(value) {
  return slugify(String(value || "unknown"), { lower: true, strict: true }) || "unknown";
}

export async function generateReport({ submission, template }) {
  const storageRoot = resolveStorageRoot();
  const month = submission.date.slice(0, 7);
  const inspectorFolder = safePart(submission.inspectorName);
  const reportDir = path.join(storageRoot, "reports", inspectorFolder, month);
  await fs.mkdir(reportDir, { recursive: true });

  const fileBase = `inspection_${submission.date}_${submission.time.replaceAll(":", "-")}_${safePart(submission.inspectorName)}_${safePart(template.riskType)}_${submission.submissionId}`;
  const htmlPath = path.join(reportDir, `${fileBase}.html`);
  const pdfPath = path.join(reportDir, `${fileBase}.pdf`);
  const html = buildReportHtml({ submission, template });
  await fs.writeFile(htmlPath, html, "utf8");

  try {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" },
      preferCSSPageSize: false
    });
    await browser.close();
    return { reportFilePath: pdfPath, htmlReportPath: htmlPath };
  } catch (error) {
    return { reportFilePath: htmlPath, htmlReportPath: htmlPath, pdfError: error.message };
  }
}

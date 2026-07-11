/**
 * PDF renderer (Module 8 — PDF Engine).
 *
 * Converts an HTML string into a PDF buffer using a headless browser
 * (Puppeteer / Chromium). Puppeteer is imported lazily and the browser instance
 * is reused across requests (launching Chromium is expensive). This module is the
 * only place that touches the browser, so tests mock it wholesale and never need
 * a real Chromium install.
 */
import { PDF_PAGE_FORMAT, PDF_MARGINS } from '../../config/constants.js';
import logger from '../../config/logger.js';

let browserPromise = null;

/** Launch (or reuse) a shared headless browser instance. */
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = import('puppeteer')
      .then(({ default: puppeteer }) =>
        puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      )
      .catch((err) => {
        // Reset so a later request can retry a failed launch.
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Render an HTML page to a PDF buffer.
 * @param {string} html - a complete, self-contained HTML document
 * @returns {Promise<Buffer>}
 */
export async function renderHtmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: PDF_PAGE_FORMAT,
      printBackground: true,
      margin: PDF_MARGINS,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Close the shared browser (used on graceful shutdown). Safe to call repeatedly. */
export async function closeBrowser() {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    const browser = await pending;
    await browser.close();
  } catch (err) {
    logger.warn?.(`Failed to close PDF browser: ${err.message}`);
  }
}

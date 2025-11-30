import puppeteer from 'puppeteer-extra';
import { executablePath } from 'puppeteer'
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin())

export async function loginAndGetCookie() {
  const username = process.env.UT_USERNAME;
  const password = process.env.UT_PASSWORD;
  const isHeadless = process.env.HEADLESS;
  if (!username || !password) {
    throw new Error(
      'Set UT_USERNAME and UT_PASSWORD environment variables before running.'
    );
  }

  const browser = await puppeteer.launch({
    headless: isHeadless,
    executablePath: executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-session-crashed-bubble',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--noerrdialogs',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();

  const url = `https://pustaka.ut.ac.id/reader/index.php?modul=EKMA411603`;
  await page.goto(url, { waitUntil: 'networkidle2' });

  try {
    await page.waitForSelector('button.g-recaptcha', { timeout: 2000 });
    await page.click('button.g-recaptcha');
    await page.waitForTimeout(2000);
  } catch (err) {
    // No captcha button found — continue with normal flow
  }
  await page.waitForSelector('input#username');
  await page.type('input#username', username, { delay: 50 });
  await page.type('input#password', password, { delay: 50 });
  // Captcha
  await page.waitForSelector('span.captcha-text > strong');
  const captchaText = await page.$eval(
    'span.captcha-text > strong',
    (el) => el.innerText
  );
  // Evaluate the captcha (simple math)
  const captchaResult = eval(captchaText.replace(/[^-+*/0-9.()]/g, ''));
  await page.type('input#ccaptcha', String(captchaResult));
  await Promise.all([
    page.click('button'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  const cookies = await page.cookies();
  const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  await browser.close();

  return cookieString;
}

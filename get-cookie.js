export async function loginAndGetCookie() {
    const username = process.env.UT_USERNAME;
  const password = process.env.UT_PASSWORD;
    if (!username || !password) {
        throw new Error('Set UT_USERNAME and UT_PASSWORD environment variables before running.');
    }

		const browser = await puppeteer.launch({ headless: true });
  	const page = await browser.newPage();

    const url = `https://pustaka.ut.ac.id/reader/index.php?modul=EKMA411603`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input#username');
    await page.type('input#username', username, { delay: 50 });
    await page.type('input#password', password, { delay: 50 });
    // Captcha
    await page.waitForSelector('span.captcha-text > strong');
    const captchaText = await page.$eval('span.captcha-text > strong', el => el.innerText);
    // Evaluate the captcha (simple math)
    const captchaResult = eval(captchaText.replace(/[^-+*/0-9.()]/g, ''));
    await page.type('input#ccaptcha', String(captchaResult));
    await Promise.all([
      page.click('button'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

		const cookies = await page.cookies();
		const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')
		return cookieString
}
// Customer journey: landing, card activation, onboarding, editing, public page, rename, release, security.
const path = require('path');
const H = require('./helpers.js');
const { BASE, SHOTS, check } = H;
const shot = (page, name, full) => page.screenshot({ path: path.join(SHOTS, name), fullPage: !!full });

(async () => {
  await H.resetEmulators();
  const browser = await H.launch();

  // Landing
  const visitor = await H.newPage(browser, { width: 390, height: 844 });
  await visitor.goto(BASE);
  await visitor.waitForSelector('.hero');
  check(await visitor.isVisible('text=أنشئ صفحتك مجاناً'), 'landing page renders');
  await shot(visitor, 'landing-mobile.png', true);

  // Seller with admin rights creates cards
  const seller = await H.newPage(browser);
  await seller.goto(BASE + 'app.html');
  await seller.waitForURL(/login\.html/);
  check(true, 'dashboard redirects to login when signed out');
  await H.fillSignup(seller, 'Seller', 'seller@test.com');
  await H.onboard(seller, 'seller');
  await seller.goto(BASE + 'admin.html');
  await seller.waitForSelector('.code-box');
  const sellerUid = (await seller.textContent('.code-box')).trim();
  await H.makeAdmin(sellerUid, 'seller@test.com');
  await seller.goto(BASE + 'admin.html');
  await seller.waitForSelector('#admin');
  await seller.fill('#count', '3');
  await seller.click('#create');
  await seller.waitForFunction(() => document.querySelectorAll('#rows .code-link').length === 3, null, { timeout: 15000 });
  const codes = await seller.$$eval('#rows .code-link', (els) => els.map((e) => e.textContent));
  check(codes.length === 3, 'admin created 3 cards');

  // Customer taps a new card, signs up, card is claimed
  const customer = await H.newPage(browser, { width: 390, height: 844 });
  await customer.goto(BASE + '?c=' + codes[0]);
  await customer.waitForSelector('text=بطاقتك الجديدة');
  check(true, 'new card shows the activation screen');
  await shot(customer, 'new-card.png');
  await customer.click('text=تفعيل البطاقة');
  await H.fillSignup(customer, 'سارة', 'sara@test.com');
  await H.onboard(customer, 'sara', 'onboarding.png');
  await customer.waitForSelector('#banner.ok', { timeout: 15000 });
  check(/تم تفعيل البطاقة/.test(await customer.textContent('#banner')), 'card activated after onboarding');

  // Edit profile: bio, WhatsApp number, Instagram link pasted without https
  await customer.fill('#bio', 'مصممة جرافيك');
  await customer.click('#platforms .platform-btn >> text=واتساب');
  await customer.locator('#links .link-item input[dir=ltr]').nth(0).fill('+213 555 11 12 22');
  await customer.click('#platforms .platform-btn >> text=إنستغرام');
  await customer.locator('#links .link-item input[dir=ltr]').nth(1).fill('instagram.com/sara.design');
  const resolved = (await customer.locator('#links .resolved').allTextContents()).map((t) => t.trim());
  check(resolved.includes('https://instagram.com/sara.design'), 'pasted link shown as the final URL');
  check(/رابط حسابك على إنستغرام/.test(await customer.textContent('#links')), 'Instagram field asks for the account link');
  check(await customer.$eval('#save-bar', (e) => e.classList.contains('show')), 'save bar appears after a change');
  await customer.click('.tab[data-tab=design]');
  await customer.click('#themes .theme-opt >> nth=4');
  // Cover photo + brightness
  // A HEIC photo is refused with a clear message; a big noisy photo is compressed to fit.
  await customer.setInputFiles('#cover-file', { name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('not really heic') });
  await H.toastHas(customer, /HEIC/);
  check((await customer.locator('.cover-preview.has-img').count()) === 0, 'HEIC photo refused with a clear message');
  await customer.setInputFiles('#cover-file', { name: 'cover.png', mimeType: 'image/png', buffer: H.noisyPng(2400, 3200) });
  await customer.waitForSelector('.cover-preview.has-img img');
  check(await customer.isVisible('#cover-light'), 'brightness slider appears after uploading a cover');
  await customer.fill('#cover-light', '60');
  await shot(customer, 'design-tab.png', true);
  check(/brightness\(60%\)/.test(await customer.getAttribute('.cover-preview img', 'style')), 'brightness applied to the cover preview');
  await customer.click('.tab[data-tab=content]');
  // Payment details
  await customer.click('#payments .platform-btn >> text=بريدي موب');
  await customer.locator('#links .link-item input[dir=ltr]').nth(2).fill('00799999 0012345678 90');
  check(/RIP/.test(await customer.textContent('#links')), 'RIP field asks for the RIP number');
  await customer.click('#save');
  await H.toastHas(customer, /تم حفظ/);
  await shot(customer, 'dashboard-mobile.png', true);

  // Public page through the card
  const stranger = await H.newPage(browser, { width: 390, height: 844 });
  await stranger.goto(BASE + '?c=' + codes[0]);
  await stranger.waitForSelector('.p-name');
  check((await stranger.textContent('.p-name')) === 'سارة', 'tapping the claimed card opens the owner page');
  check((await stranger.getAttribute('.p-pill[data-type=whatsapp]', 'href')) === 'https://wa.me/213555111222', 'WhatsApp button uses the number');
  check((await stranger.getAttribute('.p-social-btn', 'href')) === 'https://instagram.com/sara.design', 'Instagram icon uses the pasted link');
  check((await stranger.locator('.p-social-btn').count()) === 1 && (await stranger.locator('.p-pill').count()) === 1, 'each link shown once (Instagram icon, WhatsApp button)');
  check((await stranger.getAttribute('.profile', 'data-theme')) === 'sunset', 'chosen theme applied');
  check((await stranger.locator('.p-save').count()) === 0, 'no save-contact button');
  check(/brightness\(60%\)/.test(await stranger.getAttribute('.p-bg img', 'style')), 'photo fills the page background with the chosen brightness');
  const bgBox = await stranger.locator('.p-bg').boundingBox();
  check(bgBox && bgBox.width >= 389 && bgBox.height >= 800, 'background photo covers the whole screen (' + (bgBox && Math.round(bgBox.width)) + 'x' + (bgBox && Math.round(bgBox.height)) + ')');
  const coverLen = (await stranger.getAttribute('.p-bg img', 'src')).length;
  check(coverLen <= 380000, 'large photo compressed under the limit (' + coverLen + ' chars)');
  check((await stranger.textContent('.p-pay-value')).trim() === '00799999 0012345678 90', 'RIP shown in the payment section');
  await stranger.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await stranger.click('.p-pay');
  await H.toastHas(stranger, /تم نسخ/);
  check((await stranger.evaluate(() => navigator.clipboard.readText())) === '00799999 0012345678 90', 'tapping the RIP copies the number');
  const overflow = await stranger.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, 'public page has no horizontal scroll');
  await shot(stranger, 'profile-mobile.png');
  await stranger.waitForTimeout(800);

  await stranger.goto(BASE + '?u=sara');
  await stranger.waitForSelector('.p-name');
  await stranger.waitForTimeout(800);
  check(true, '?u=sara opens the page');
  await stranger.goto(BASE + '?u=nobody1');
  await stranger.waitForSelector('text=الصفحة غير موجودة');
  check(true, 'unknown username shows not-found');
  await stranger.goto(BASE + '?c=ZZZZZZZZ');
  await stranger.waitForSelector('text=بطاقة غير معروفة');
  check(true, 'unknown card shows an error');

  // Counters
  await customer.reload();
  await customer.waitForSelector('#dashboard', { timeout: 15000 });
  await customer.waitForTimeout(800);
  check(Number(await customer.textContent('#views')) >= 2, 'view counter');
  check(Number(await customer.textContent('#taps')) === 1, 'tap counter');

  // Security for a normal user (backend-specific probe from the test build)
  const sec = await customer.evaluate(([uid, codes]) => window.__test.probe(uid, codes), [sellerUid, codes]);
  for (const [k, v] of Object.entries(sec)) {
    if (k === 'claimSecondCard') check(v === 'allowed', 'a user can claim a second unowned card');
    else check(v !== 'allowed', 'blocked: ' + k + ' (' + v + ')');
  }

  // Another user cannot take over an activated card
  const thief = await H.newPage(browser);
  await thief.goto(BASE + 'login.html?mode=signup&next=' + encodeURIComponent('app.html?activate=' + codes[0]));
  await H.fillSignup(thief, 'Thief', 'thief@test.com');
  await H.onboard(thief, 'thief');
  await thief.waitForSelector('#banner.err', { timeout: 15000 });
  check(/حساب آخر/.test(await thief.textContent('#banner')), 'another user cannot activate an owned card');
  await stranger.goto(BASE + '?c=' + codes[0]);
  await stranger.waitForSelector('.p-name');
  check((await stranger.textContent('.p-name')) === 'سارة', 'card still belongs to its owner');

  // Rename frees the old username; card keeps working
  await customer.fill('#username', 'sara-art');
  await customer.waitForFunction(() => /متاح/.test((document.getElementById('username-check') || {}).textContent || ''), null, { timeout: 10000 });
  await customer.click('#save');
  await customer.waitForFunction(() => !document.getElementById('save-bar').classList.contains('show'), null, { timeout: 15000 });
  check((await customer.textContent('#my-url')).endsWith('?u=sara-art'), 'share link updated after rename');
  await stranger.goto(BASE + '?u=sara');
  await stranger.waitForSelector('text=الصفحة غير موجودة');
  await stranger.goto(BASE + '?c=' + codes[0]);
  await stranger.waitForSelector('.p-name');
  check(true, 'old username freed; card still opens the page');

  // Release a card
  await customer.click('.tab[data-tab=cards]');
  await customer.click('#cards .card-item:has-text("' + codes[0] + '") .btn');
  await customer.waitForFunction(() => document.querySelectorAll('#cards .card-item').length === 1, null, { timeout: 10000 });
  await stranger.goto(BASE + '?c=' + codes[0]);
  await stranger.waitForSelector('text=بطاقتك الجديدة');
  check(true, 'released card can be activated again');

  // Logout
  await customer.click('#logout');
  await customer.waitForURL(/login\.html/);
  check(true, 'logout returns to login');

  await browser.close();
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });

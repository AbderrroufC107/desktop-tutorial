// Admin panel: access, cards, search/filter, notes, QR window, selection/print/CSV, customers, reset/delete.
const fs = require('fs');
const path = require('path');
const H = require('./helpers.js');
const { BASE, SHOTS, check } = H;

const rows = (page) => page.locator('#rows tr:not(.empty-row)').count();

(async () => {
  await H.resetEmulators();
  const browser = await H.launch();

  // Not yet an admin
  const admin = await H.newPage(browser);
  await admin.goto(BASE + 'login.html?mode=signup');
  await H.fillSignup(admin, 'Owner', 'owner@test.com');
  await H.onboard(admin, 'owner');
  check(!(await admin.isVisible('#admin-link')), 'non-admin has no admin link');
  await admin.goto(BASE + 'admin.html');
  await admin.waitForSelector('.code-box');
  const uid = (await admin.textContent('.code-box')).trim();
  check(/^[A-Za-z0-9]+$/.test(uid), 'non-admin sees the locked screen with their uid');
  await H.makeAdmin(uid, 'owner@test.com');
  await admin.goto(BASE + 'app.html');
  await admin.waitForSelector('#admin-link', { timeout: 10000 });
  check(true, 'admin link appears for admins');

  // Create batches
  await admin.goto(BASE + 'admin.html');
  await admin.waitForSelector('#admin');
  check((await rows(admin)) === 0 && /لا توجد بطاقات/.test(await admin.textContent('#rows')), 'empty state');
  await admin.fill('#count', '5');
  await admin.fill('#note', 'batch A');
  await admin.click('#create');
  await H.toastHas(admin, /تم إنشاء 5/);
  await admin.waitForFunction(() => document.querySelectorAll('#rows .code-link').length === 5);
  check((await admin.inputValue('#note')) === '', 'note field cleared after creating');
  await admin.fill('#count', '2');
  await admin.fill('#note', 'batch B');
  await admin.click('#create');
  await admin.waitForFunction(() => document.querySelectorAll('#rows .code-link').length === 7);
  check((await admin.textContent('#s-total')) === '7', 'stat: 7 cards');
  const codes = await admin.$$eval('#rows .code-link', (els) => els.map((e) => e.textContent));
  check(new Set(codes).size === 7 && codes.every((c) => /^[A-Z2-9]{8}$/.test(c)), 'codes unique and well-formed');
  await admin.fill('#count', '0');
  await admin.click('#create');
  await admin.waitForFunction(() => document.querySelectorAll('#rows .code-link').length === 8);
  check(true, 'count 0 is clamped to 1');

  // Search
  await admin.fill('#search', codes[0].toLowerCase());
  check((await rows(admin)) === 1, 'search by code, case-insensitive');
  await admin.fill('#search', 'batch b');
  check((await rows(admin)) === 2, 'search by note');
  await admin.fill('#search', 'zzzz');
  check(/لا توجد نتائج/.test(await admin.textContent('#rows')), 'no-results message');
  await admin.fill('#search', '');

  // A customer activates codes[0] and gets a visit
  const cust = await H.newPage(browser);
  await cust.goto(BASE + '?c=' + codes[0]);
  await cust.waitForSelector('text=بطاقتك الجديدة');
  await cust.click('text=تفعيل البطاقة');
  await H.fillSignup(cust, 'Sara', 'sara@test.com');
  await H.onboard(cust, 'sara');
  await cust.waitForSelector('#banner.ok', { timeout: 15000 });
  await cust.click('#platforms .platform-btn >> text=واتساب');
  await cust.locator('#links .link-item input[dir=ltr]').first().fill('+213555000111');
  await cust.click('#save');
  await H.toastHas(cust, /تم حفظ/);
  const visitor = await H.newPage(browser);
  await visitor.goto(BASE + '?c=' + codes[0]);
  await visitor.waitForSelector('.p-name');
  await visitor.waitForTimeout(800);

  await admin.click('text=تحديث');
  await H.toastHas(admin, /تم التحديث/);
  check((await admin.textContent('#s-used')) === '1', 'stat: 1 activated');
  check(/13%/.test(await admin.textContent('#admin .stat-row')), 'activation rate 1/8 = 13%');
  check((await admin.textContent('#s-customers')) === '2', 'stat: 2 customers');
  check((await admin.textContent('#s-taps')) === '1', 'stat: 1 tap');
  check(Number(await admin.textContent('#s-views')) >= 1, 'stat: views');
  check((await admin.textContent('#rows')).includes('@sara'), 'owner chip shows @sara');

  // Filter
  await admin.click('#filter [data-filter=used]');
  check((await rows(admin)) === 1, 'filter: activated');
  await admin.click('#filter [data-filter=free]');
  check((await rows(admin)) === 7, 'filter: not activated');
  await admin.click('#filter [data-filter=all]');
  await admin.fill('#search', 'sara');
  check((await rows(admin)) === 1, 'search by customer');
  await admin.fill('#search', '');

  // Notes
  const row = admin.locator('#rows tr', { hasText: codes[1] });
  await row.locator('.note-btn').click();
  await row.locator('.note-input').fill('بيعت لمحل أحمد');
  await row.locator('.note-input').press('Enter');
  await H.toastHas(admin, /تم حفظ الملاحظة/);
  await admin.reload();
  await admin.waitForSelector('#rows .code-link');
  check((await admin.locator('#rows tr', { hasText: codes[1] }).textContent()).includes('بيعت لمحل أحمد'), 'note persists after reload');
  const row2 = admin.locator('#rows tr', { hasText: codes[2] });
  await row2.locator('.note-btn').click();
  await row2.locator('.note-input').fill('should not save');
  await row2.locator('.note-input').press('Escape');
  check(!(await row2.textContent()).includes('should not save'), 'Escape cancels note edit');

  // QR window
  await admin.click('#rows .code-link >> text=' + codes[0]);
  await admin.waitForSelector('#card-modal');
  check((await admin.textContent('#card-modal .modal-code')) === codes[0], 'window shows the code');
  check((await admin.locator('#card-modal .modal-qr svg').count()) === 1, 'window shows a QR code');
  check((await admin.textContent('#card-modal')).includes('@sara'), 'window shows the owner');
  check((await admin.textContent('#card-modal .modal-url')).endsWith('?c=' + codes[0]), 'window shows the card link');
  await admin.screenshot({ path: path.join(SHOTS, 'admin-modal.png') });
  const [qrDl] = await Promise.all([admin.waitForEvent('download'), admin.click('#card-modal >> text=تحميل QR')]);
  check(qrDl.suggestedFilename() === 'nfcrs-' + codes[0] + '.svg', 'QR download file name');
  await admin.click('#card-modal >> text=كتابة على NFC');
  await H.toastHas(admin, /لا يدعم/);
  check(true, 'NFC button explains unsupported desktop browser');
  await admin.keyboard.press('Escape');
  check((await admin.locator('#card-modal').count()) === 0, 'Escape closes the window');
  await admin.click('#rows .code-link >> nth=0');
  await admin.click('.modal-backdrop', { position: { x: 5, y: 5 } });
  check((await admin.locator('#card-modal').count()) === 0, 'backdrop click closes the window');

  // Selection, print, CSV
  await admin.locator('#rows tr', { hasText: codes[3] }).locator('input[type=checkbox]').check();
  await admin.locator('#rows tr', { hasText: codes[4] }).locator('input[type=checkbox]').check();
  check(/2 بطاقة محددة/.test(await admin.textContent('#selection-bar')), 'selection bar shows 2');
  check(/\(2\)/.test(await admin.textContent('#print')), 'print button shows the selection count');
  check((await admin.locator('#sheet .print-item').count()) === 2, 'print sheet has only the selected cards');
  const [csv] = await Promise.all([admin.waitForEvent('download'), admin.click('#export')]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  check(csvText.trim().split('\n').length === 3 && csvText.includes(codes[3]) && csvText.includes(codes[4]), 'CSV exports only the selection');
  await admin.click('#select-all');
  check((await admin.locator('#sheet .print-item').count()) === 8, 'select all');
  await admin.click('#select-all');
  check((await admin.locator('#selection-bar').count()) === 0, 'unselect all hides the selection bar');
  await admin.emulateMedia({ media: 'print' });
  check(await admin.isVisible('#sheet'), 'print view shows the QR sheet');
  check(!(await admin.isVisible('.topbar')), 'print view hides the header');
  await admin.emulateMedia({ media: 'screen' });
  const [csvAll] = await Promise.all([admin.waitForEvent('download'), admin.click('#export')]);
  const all = fs.readFileSync(await csvAll.path(), 'utf8');
  check(all.trim().split('\n').length === 9 && all.includes('sara') && all.includes('بيعت لمحل أحمد'), 'CSV of all cards with owner and note');

  // Customers tab
  await admin.click('.tab[data-tab=customers]');
  await admin.waitForSelector('#customers .customer');
  check((await admin.locator('#customers .customer').count()) === 2, 'customers tab lists 2 customers');
  const sara = admin.locator('#customers .customer', { hasText: 'sara' });
  check((await sara.getAttribute('href')).endsWith('?u=sara'), 'customer links to their page');
  await admin.fill('#customer-search', 'sar');
  check((await admin.locator('#customers .customer').count()) === 1, 'customer search');
  await admin.screenshot({ path: path.join(SHOTS, 'admin-customers.png') });
  await admin.click('.tab[data-tab=cards]');

  // Reset and delete
  await admin.locator('#rows tr', { hasText: codes[0] }).locator('button[title="إعادة تعيين"]').click();
  await H.toastHas(admin, /إعادة تعيين/);
  await admin.waitForFunction(() => document.getElementById('s-used').textContent === '0');
  await visitor.goto(BASE + '?c=' + codes[0]);
  await visitor.waitForSelector('text=بطاقتك الجديدة');
  check(true, 'reset card shows the activation screen again');
  await admin.locator('#rows tr', { hasText: codes[6] }).locator('button[title="حذف"]').click();
  await H.toastHas(admin, /تم حذف/);
  await admin.waitForFunction(() => document.getElementById('s-total').textContent === '7');
  await visitor.goto(BASE + '?c=' + codes[6]);
  await visitor.waitForSelector('text=بطاقة غير معروفة');
  check(true, 'deleted card link shows unknown card');

  // Non-admin
  const probe = await cust.evaluate(([uid, codes]) => window.__test.probe(uid, codes), [uid, codes]);
  const sec = { listCustomers: probe.listCustomers, listCards: probe.listAllCards, editNote: probe.editCardNote };
  for (const [k, v] of Object.entries(sec)) check(v !== 'allowed', 'non-admin blocked: ' + k + ' (' + v + ')');

  // Layout
  await admin.screenshot({ path: path.join(SHOTS, 'admin-desktop.png'), fullPage: true });
  const mobile = await admin.context().newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(BASE + 'admin.html');
  await mobile.waitForSelector('#rows .code-link');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, 'admin: no horizontal scroll on phone');
  await mobile.screenshot({ path: path.join(SHOTS, 'admin-mobile.png'), fullPage: true });

  await browser.close();
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });

// オンライン対戦の通しテスト：ホスト1台＋参加者2台のブラウザで、招待→承認→ドラフト→最後まで、途中で参加者を再読み込み。
// 使い方は README の「オンライン対戦のテスト」を参照。
const { chromium, devices } = require('playwright');
const URL0 = 'http://localhost:4174/';
(async () => {
  const b = await chromium.launch();
  const mk = async (tag) => {
    const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] });
    const page = await ctx.newPage();
    page.errs = [];
    page.on('pageerror', e => page.errs.push(tag + ': ' + e.message));
    page.on('dialog', d => d.accept());
    return page;
  };
  const host = await mk('host'), g1 = await mk('g1'), g2 = await mk('g2');
  await host.goto(URL0);
  await host.fill('input', 'K');
  await host.click('text=友だちと遊ぶ');
  await host.waitForSelector('.qr svg');
  const roomId = await host.evaluate(() => JSON.parse(localStorage.getItem('midorino.host')).roomId);
  const invite = URL0 + '#join=' + roomId;
  for (const [p, n] of [[g1, 'たろう'], [g2, 'はなこ']]) {
    await p.goto(invite);
    await p.fill('input', n);
    await p.click('text=参加する');
  }
  await host.waitForSelector('text=承認', { timeout: 15000 });
  await host.waitForTimeout(1000);
  await host.screenshot({ path: 'e2e-o1-lobby.png' });
  while (await host.locator('button:has-text("承認")').count()) { await host.locator('button:has-text("承認")').first().click(); await host.waitForTimeout(300); }
  await g1.waitForSelector('text=参加しました');
  await host.click('text=この3人で始める');
  const pages = [host, g1, g2];
  for (const p of pages) { await p.waitForSelector('.draft .cards > *', { timeout: 10000 }); await p.locator('.draft .cards > *').first().click(); }
  let reloaded = false;
  for (let i = 0; i < 400; i++) {
    let allDone = true;
    for (const p of pages) {
      if (await p.locator('.result').count()) continue;
      allDone = false;
      if (await p.locator('.modal').count()) {
        if (await p.locator('.mkt').count()) { await p.locator('.modal-head button').click(); continue; }
        await p.locator('.modal-body button').first().click(); await p.waitForTimeout(150); continue;
      }
      const placeBtn = p.locator('button:has-text("置く")').last();
      if (!(await placeBtn.count())) continue;
      const cands = p.locator('.mi-sp:not(.is-off)');
      const n = await cands.count();
      if (!n) continue;
      await cands.nth(Math.floor(Math.random() * n)).click({ force: true });
      const btn = p.locator('button:has-text("ここに置く")');
      if (await btn.count() && await btn.isEnabled()) { await btn.click(); await p.waitForTimeout(150); }
    }
    if (allDone) { console.log('all done at', i); break; }
    if (!reloaded && i === 40) { await g1.reload(); reloaded = true; await g1.waitForTimeout(3000); await g1.screenshot({ path: 'e2e-o3-reload.png' }); }
    if (i === 20) await g2.screenshot({ path: 'e2e-o2-guest.png' });
  }
  await g2.screenshot({ path: 'e2e-o4-end.png' });
  console.log('errors', [...host.errs, ...g1.errs, ...g2.errs].slice(0, 8));
  console.log('results', await Promise.all(pages.map(p => p.locator('.result').count())));
  await b.close();
})();

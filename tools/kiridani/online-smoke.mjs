// 霧谷の冒険者団：オンライン対戦の通しテスト（ブラウザ2つ＋手元の PeerJS サーバー）。
//   ホスト：「友だちと遊ぶ」→ 部屋をつくる → 参加申請を承認 → 3人（空き1席は AI）で開始
//   参加者：招待リンクを開く → 名前 → 承認待ち → 待合室 → 試合
//   両方の画面でドラフト・キャラ・置き場所・トレイ・シートを答えて進め、途中で参加者を読み込み直し（同じ席に戻るか）、
//   人どうしの取引（ホストが申し込み → 1回目は参加者が断る・2回目は受ける）を試し、
//   最後にホストが部屋を閉じて、参加者に知らせが出るかを見る。
// 使い方：node tools/kiridani/online-smoke.mjs [--rounds 12] [--shots DIR] [--headed]
//   （アプリを VITE_PEER_* つきで一時フォルダに作り直し、内蔵のサーバーで配る）
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright'); }
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const express = require(join(ROOT, 'node_modules/express'));
const { ExpressPeerServer } = require(join(ROOT, 'node_modules/peer'));

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const ROUNDS = Number(opt('--rounds') ?? 12);
const SHOTS = opt('--shots');
const PEER_PORT = Number(opt('--peer-port') ?? 9123);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---- PeerJS サーバー
const papp = express();
const psrv = papp.listen(PEER_PORT, '127.0.0.1');
papp.use('/', ExpressPeerServer(psrv, { path: '/' }));

// ---- アプリを作る（接続先を手元のサーバーに）
const dist = opt('--dist') ?? await mkdtemp(join(tmpdir(), 'kd-online-'));
if (!opt('--dist')) {
  log('build →', dist);
  execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], {
    cwd: join(ROOT, 'packages/app'), stdio: 'ignore',
    env: { ...process.env, VITE_PEER_HOST: '127.0.0.1', VITE_PEER_PORT: String(PEER_PORT), VITE_PEER_PATH: '/', VITE_PEER_SECURE: 'false' },
  });
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const web = await new Promise((ok) => {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try { const b = await readFile(join(dist, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end(); }
  });
  srv.listen(0, '127.0.0.1', () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
});
const APP = `${web.url}?speed=minimal`;

// ---- ブラウザ2つ
const launch = () => pw.chromium.launch({ headless: !args.includes('--headed'), args: ['--no-proxy-server'] });
const [bh, bg] = await Promise.all([launch(), launch()]);
const errors = [];
async function mkPage(browser, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|WebSocket|peer|Failed to load resource/i.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
  return page;
}
const host = await mkPage(bh, 'host');
const guest = await mkPage(bg, 'guest');
const shot = async (page, name) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, name) }); log('shot', name); } };
const fits = async (page) => page.evaluate(() => { const se = document.scrollingElement; return se.scrollHeight <= innerHeight && se.scrollWidth <= innerWidth; });
const checks = [];
const check = (ok, what) => { checks.push([ok, what]); log(ok ? 'OK  ' : 'FAIL', what); };

let failed = false;
try {
  // ホスト：部屋をつくる
  await host.goto(APP);
  await host.click('text=友だちと遊ぶ');
  await host.fill('#kd-host-name', 'ホスト');
  await host.click('button:has-text("部屋をつくる")');
  await host.waitForSelector('.kd-room-qr svg');
  await host.waitForSelector('text=招待を待っています', { timeout: 15000 });
  const invite = (await host.textContent('.kd-room-url')).trim();
  check(/#join=[0-9a-f]{32}$/.test(invite), `招待リンク ${invite.slice(-45)}`);

  // 参加者：招待リンクを開いて申請
  await guest.goto(invite.replace('#', '?speed=minimal#'));
  await guest.waitForSelector('#kd-nick');
  await guest.fill('#kd-nick', 'アオイ');
  await shot(guest, '60-join-guest.png');
  check(await fits(guest), '参加の画面が1画面に収まる（390×844）');
  await guest.click('button:has-text("参加を申し込む")');
  await guest.waitForSelector('text=ホストの承認を待っています', { timeout: 15000 });

  // ホスト：承認 → 待合室
  await host.waitForSelector('.kd-room-wait button:has-text("承認")', { timeout: 15000 });
  await host.click('.kd-room-wait button:has-text("承認")');
  await guest.waitForSelector('text=ホストが始めるのを待っています', { timeout: 15000 });
  await host.click('.kd-room-seg button:has-text("3人")');
  await sleep(300);
  await shot(host, '60-lobby-host.png');
  check(await fits(host), '待合室が1画面に収まる（390×844）');
  await host.setViewportSize({ width: 844, height: 390 });
  await sleep(300);
  check(await fits(host), '待合室が1画面に収まる（844×390）');
  await shot(host, '60-lobby-host-landscape.png');
  await host.setViewportSize({ width: 390, height: 844 });
  const seats = await guest.$$eval('.kd-room-seats li', (els) => els.map((e) => e.textContent));
  check(seats.length === 3 && seats.some((s) => s.includes('AI')), `参加者の待合室に席が見える：${seats.join(' / ')}`);

  await host.click('.kd-room-start');
  log('start');

  // ---- 両方の画面で答えて進める
  const avoid = new Map([[host, new Set()], [guest, new Set()]]);
  async function step(page) {
    const tray = await page.$('.kd-tray');
    if (tray) {
      const go = await page.$('.kd-tray-act .kd-btn.is-primary:not([disabled])');
      if (go && !(await page.$('.kd-tray .kd-partners'))) { await go.click(); return 'tray'; }
      // 市場：売れるものを1つ選ぶ
      const chip = await page.$('.kd-tray .kd-tchip.is-res:not([aria-disabled="true"])');
      if (chip && !(await page.$('.kd-tray .kd-partners'))) { await chip.click(); await sleep(80); const g2 = await page.$('.kd-tray-act .kd-btn.is-primary:not([disabled])'); if (g2) { await g2.click(); return 'market'; } }
      await page.click('.kd-tray-act .kd-btn:not(.is-primary)');
      return 'tray-cancel';
    }
    const choice = await page.$('.kd-sheet .kd-choice');
    if (choice) { await choice.click(); return 'sheet'; }
    const card = await page.$('.kd-offer .kd-card:not(.is-selected)');
    const conf = await page.$('.kd-confirm .kd-btn.is-primary');
    if (conf) {
      if (await conf.isDisabled()) {
        const c = card ?? await page.$('.kd-charcard:not(.is-gone)');
        if (c) await c.click();
        await sleep(60);
      }
      const c2 = await page.$('.kd-confirm .kd-btn.is-primary:not([disabled])');
      if (c2) { await c2.click(); return 'pick'; }
    }
    if (await page.$('.kd-root.is-myturn')) {
      const av = avoid.get(page);
      const cands = (await page.$$('[data-kd^="space:"].is-can, button.kd-nest.is-can')).filter(Boolean);
      const keyed = [];
      for (const c of cands) keyed.push([c, (await c.getAttribute('data-kd')) ?? 'nest']);
      const pick = keyed.find(([, k]) => !av.has(k)) ?? keyed[0];
      if (!pick) return null;
      await pick[0].click();
      await sleep(60);
      const go = await page.$('.kd-mybar .kd-btn.is-primary:not([disabled])');
      if (go) { await go.click(); av.add(pick[1]); if (av.size > 4) av.clear(); return 'place'; }
    }
    return null;
  }
  // 人どうしの取引：ホストがアオイに申し込み、1回目は断られ、2回目は受けてもらう
  const inner = (page) => page.evaluate(() => {
    const se = document.scrollingElement;
    const bad = [];
    if (se.scrollHeight > innerHeight || se.scrollWidth > innerWidth) bad.push(`page ${se.scrollWidth}x${se.scrollHeight}`);
    for (const el of document.querySelectorAll('.kd-tray, .kd-tray *')) {
      const cs = getComputedStyle(el);
      const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (dy > 2 || dx > 2)) bad.push(`${el.className} +${dy}↓ +${dx}→`);
    }
    return bad;
  });
  const MINE = '.kd-tray-sec:has(h4:has-text("あなたの持ち物")) .kd-tchip:not([aria-disabled="true"])';
  const THEIRS = '.kd-tray-sec:has(h4:has-text("アオイの持ち物")) .kd-tchip:not([aria-disabled="true"])';
  const cancelTray = () => host.click('.kd-tray-act .kd-btn:not(.is-primary)');
  async function propose(give = 1) {
    const btn = await host.$('.kd-tradebtn:not([disabled])');
    if (!btn) { log('trade: no button'); return false; }
    await btn.click();
    await host.waitForSelector('.kd-tray .kd-partners');
    const who = await host.$('.kd-partners .kd-tchip:has-text("アオイ")');
    if (!who) { await cancelTray(); return false; }
    await who.click();
    await sleep(100);
    if (!(await host.$(MINE)) || !(await host.$(THEIRS))) { log('trade: nothing to exchange'); await cancelTray(); return false; }
    for (let i = 0; i < give; i++) { const m = await host.$(MINE); if (m) await m.click(); await sleep(60); }
    await host.click(THEIRS);
    await sleep(100);
    const go = await host.$('.kd-tray-act .kd-btn.is-primary:has-text("申し込む"):not([disabled])');
    if (!go) { await cancelTray(); return false; }
    await go.click();
    await host.waitForSelector('.kd-tray[aria-label="取引の申し込み"]', { timeout: 10000 });
    await guest.waitForSelector('.kd-tray[aria-label="取引の申し込みが届いた"]', { timeout: 20000 });
    await sleep(500);
    return true;
  }
  let traded = false;
  async function tradeScenario() {
    if (!(await propose(1))) return false;
    log('offer 1 sent');
    await shot(host, '61-offer-wait-host.png');
    await shot(guest, '61-offer-guest.png');
    for (const [pg, nm] of [[host, '返事待ち'], [guest, '申し込み']]) { const b = await inner(pg); check(!b.length, `${nm}のシートが1画面に収まる（390×844）${b.join(' ')}`); }
    for (const pg of [host, guest]) await pg.setViewportSize({ width: 844, height: 390 });
    await sleep(400);
    for (const [pg, nm] of [[host, '返事待ち'], [guest, '申し込み']]) { const b = await inner(pg); check(!b.length, `${nm}のシートが1画面に収まる（844×390）${b.join(' ')}`); }
    await shot(guest, '61-offer-guest-landscape.png');
    for (const pg of [host, guest]) await pg.setViewportSize({ width: 390, height: 844 });
    await sleep(300);
    await guest.click('.kd-tray[aria-label="取引の申し込みが届いた"] .kd-btn:has-text("断る")');
    await host.waitForSelector('.kd-netnote:has-text("アオイが取引を断りました")', { timeout: 10000 });
    check(!(await host.$('.kd-tray[aria-label="取引の申し込み"]')) && !!(await host.$('.kd-root.is-myturn')), '断られると、申し込んだ人の番が続く');
    await sleep(300);
    if (!(await propose(2))) { check(false, '2回目の申し込みができない'); return true; }
    log('offer 2 sent');
    await guest.click('.kd-tray[aria-label="取引の申し込みが届いた"] .kd-btn:has-text("受ける")');
    await host.waitForSelector('.kd-netnote:has-text("アオイが取引を受けました")', { timeout: 10000 });
    await guest.waitForSelector('.kd-netnote:has-text("ホストとの取引が成立しました")', { timeout: 10000 });
    check(true, '受けると、両方にお知らせが出る');
    traded = true;
    return true;
  }
  const roundOf = (page) => page.evaluate(() => Number(document.querySelector('.kd-hud-meta b')?.textContent ?? 0));
  let reloaded = false, guestShot = false;
  const counts = {};
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    if (!guestShot && (await roundOf(guest)) >= 2 && await guest.$('.kd-root.is-myturn')) {
      // 演出が終わって盤面だけになるまで待ってから撮る
      await guest.waitForSelector('.kd-hud-ctl .kd-iconbtn[disabled]', { timeout: 15000 }).catch(() => {});
      await sleep(600);
    }
    if (!guestShot && (await roundOf(guest)) >= 2 && await guest.$('.kd-root.is-myturn') && !(await guest.$('.kd-ovwrap')) && await guest.$('.kd-hud-ctl .kd-iconbtn[disabled]')) {
      await shot(guest, '60-ingame-guest.png');
      check(await fits(guest), '参加者の試合画面が1画面に収まる（390×844）');
      guestShot = true;
    }
    if (!traded && reloaded && guestShot && await host.$('.kd-root.is-myturn')) {
      await host.waitForSelector('.kd-hud-ctl .kd-iconbtn[disabled]', { timeout: 15000 }).catch(() => {});
      await sleep(400);
    }
    if (!traded && reloaded && guestShot && await host.$('.kd-root.is-myturn') && !(await host.$('.kd-ovwrap'))) {
      try { await tradeScenario(); } catch (e) { check(false, `取引の通し：${String(e).split('\n')[0]}`); traded = true; }
    }
    for (const page of [host, guest]) {
      const r = await step(page).catch((e) => { if (!/detached|not attached|Target closed|intercepts pointer/.test(String(e))) errors.push(`step: ${String(e).split('\n')[0]}`); return null; });
      if (r) counts[r] = (counts[r] ?? 0) + 1;
    }
    const [rh, rg] = [await roundOf(host), await roundOf(guest)];
    if (!reloaded && rg >= 3) {
      const before = await guest.textContent('.kd-pchip.is-me');
      await guest.reload();
      await guest.waitForSelector('.kd-pchip.is-me', { timeout: 20000 });
      await sleep(1500);
      const after = await guest.textContent('.kd-pchip.is-me');
      const name = (s) => s.replace(/[0-9]/g, '');
      check(!(await guest.$('#kd-nick')) && name(after) === name(before), `参加者が読み込み直して同じ席に戻る（${name(after)}）`);
      reloaded = true;
    }
    const done = (await host.$('.kd-final')) && (await guest.$('.kd-final'));
    if (done || Math.min(rh, rg) > ROUNDS) { log('reached', done ? 'final' : `round ${rh}/${rg}`, counts); break; }
    if (i % 25 === 0) log(`round host ${rh} guest ${rg}`, counts);
    if (Date.now() - t0 > 25 * 60_000) throw new Error('時間切れ');
    await sleep(40);
  }
  if (!guestShot) check(false, '参加者の番の盤面にたどり着けなかった');
  if (!traded) check(false, '人どうしの取引を試せなかった');
  if (ROUNDS >= 12) {
    await guest.waitForSelector('.kd-final', { timeout: 60000 });
    for (const p of [host, guest]) await p.waitForSelector('.kd-hud-ctl .kd-iconbtn[disabled]', { timeout: 60000 });
    await sleep(1500);
    const tot = async (p) => p.$$eval('.kd-final .kd-ftotal', (els) => els.map((e) => e.textContent.trim()));
    const [th, tg] = [await tot(host), await tot(guest)];
    check(th.length > 0 && JSON.stringify(th) === JSON.stringify(tg), `最終得点が両方の画面で同じ：${tg.join(',')}`);
    await shot(guest, '60-final-guest.png');
  }
  check(counts.pick > 0 && counts.place > 0, `ドラフト・キャラ・置き場所を両方の画面で答えた ${JSON.stringify(counts)}`);

  // ホストが部屋を閉じる → 参加者に知らせ
  await host.click('.kd-hud-ctl .kd-cat-menu:not(.kd-hudmenu) summary');
  await host.click('button:has-text("部屋を閉じてタイトルへ")');
  await guest.waitForSelector('text=部屋が閉じました', { timeout: 15000 });
  check(true, '参加者に「部屋が閉じました」が出る');
  await shot(guest, '60-host-left-guest.png');
} catch (e) {
  failed = true;
  console.error('ERROR', e);
  await shot(host, '60-error-host.png').catch(() => {});
  await shot(guest, '60-error-guest.png').catch(() => {});
}
const bad = checks.filter(([ok]) => !ok).length;
log(`checks ${checks.length - bad}/${checks.length}`, errors.length ? `errors: ${errors.slice(0, 8).join(' | ')}` : 'no page errors');
await bh.close(); await bg.close(); web.srv.close(); psrv.close();
process.exit(failed || bad || errors.length ? 1 : 0);

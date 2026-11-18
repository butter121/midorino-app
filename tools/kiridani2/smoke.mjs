// 霧谷 v2（新ルール）の通しテスト：ブラウザで
//   A. ひとりで遊ぶ：タイトル → 5年・4人 → 準備（リーダー・職能・割合・品物・初期カード・秘密依頼）→ 数ラウンド → ⚙「自分の席もAIに任せる」→ 最終得点（内訳）
//   B. 友だちと遊ぶ：ホスト＋参加者（手元の PeerJS サーバー）→ 新ルールの待合室 → 数ラウンド → チャット → 参加者の途中退室と復帰 → 部屋を閉じる
// 画面写真（deviceScaleFactor 2、縦 390×844・横 844×390）を --shots DIR に保存する。
// 使い方：node tools/kiridani2/smoke.mjs [--shots DIR] [--only solo|online] [--headed] [--dist DIR]
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
const SHOTS = opt('--shots');
const ONLY = opt('--only');
const PEER_PORT = Number(opt('--peer-port') ?? 9124);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const PORTRAIT = { width: 390, height: 844 }, LANDSCAPE = { width: 844, height: 390 };

const papp = express();
const psrv = papp.listen(PEER_PORT, '127.0.0.1');
papp.use('/', ExpressPeerServer(psrv, { path: '/' }));

const dist = opt('--dist') ?? await mkdtemp(join(tmpdir(), 'kd2-smoke-'));
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

const launch = () => pw.chromium.launch({ headless: !args.includes('--headed'), args: ['--no-proxy-server'] });
const browsers = [];
const errors = [];
async function mkPage(tag) {
  const b = await launch(); browsers.push(b);
  const ctx = await b.newContext({ viewport: PORTRAIT, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|WebSocket|peer|Failed to load resource/i.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
  return page;
}
const shot = async (page, name) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, name) }); log('shot', name); } };
const fits = async (page) => page.evaluate(() => { const se = document.scrollingElement; return se.scrollHeight <= innerHeight + 1 && se.scrollWidth <= innerWidth + 1; });
const checks = [];
const check = (ok, what) => { checks.push([ok, what]); log(ok ? 'OK  ' : 'FAIL', what); };
/** 縦と横の両方で撮る（横は収まるかも見る） */
async function both(page, name, what) {
  await shot(page, `${name}.png`);
  if (what) check(await fits(page), `${what}が1画面に収まる（390×844）`);
  await page.setViewportSize(LANDSCAPE); await sleep(350);
  await shot(page, `${name}-landscape.png`);
  if (what) check(await fits(page), `${what}が1画面に収まる（844×390）`);
  await page.setViewportSize(PORTRAIT); await sleep(250);
}
const roundOf = (page) => page.evaluate(() => Number(document.querySelector('.kd-hud-meta b')?.textContent ?? 0));
const idle = async (page) => { await page.waitForSelector('.kd-hud-ctl .kd-iconbtn[disabled]', { timeout: 15000 }).catch(() => {}); await sleep(300); };

// ---- 1手すすめる（画面に出ているものに答える）
const avoid = new Map();
async function step(page, seen) {
  const tray = await page.$('.kd-tray');
  if (tray) {
    const lab = await tray.getAttribute('aria-label');
    if (lab === '戦闘' && seen && !seen.has('tray')) { seen.add('tray'); await sleep(300); await both(page, '30-fight-tray', '戦闘のトレイ'); }
    if (/取引の申し込み/.test(lab ?? '')) return null;
    const go = await page.$('.kd-tray-act .kd-btn.is-primary:not([disabled])');
    if (go && !(await page.$('.kd-tray .kd-partners'))) { await go.click(); return 'tray'; }
    const chip = await page.$('.kd-tray .kd-tchip:not([aria-disabled="true"])');
    if (chip && !(await page.$('.kd-tray .kd-partners'))) { await chip.click(); await sleep(80); const g2 = await page.$('.kd-tray-act .kd-btn.is-primary:not([disabled])'); if (g2) { await g2.click(); return 'tray2'; } }
    await page.click('.kd-tray-act .kd-btn:not(.is-primary)');
    return 'tray-cancel';
  }
  const choice = await page.$('.kd-sheet .kd-choice');
  if (choice) {
    if (seen && !seen.has('sheet')) { seen.add('sheet'); await shot(page, '31-sheet.png'); }
    await choice.click(); return 'sheet';
  }
  if (await page.$('.kd2-ratio')) {
    const conf = await page.$('.kd-confirm .kd-btn.is-primary');
    if (seen && !seen.has('ratio')) { seen.add('ratio'); for (const l of ['武器', '道具', '秘術']) { const b = await page.$(`button[aria-label="${l}を増やす"]:not([disabled])`); if (b) await b.click(); } await sleep(100); await both(page, '10-setup-ratio', '割合の画面'); }
    for (let i = 0; i < 6 && conf && await conf.isDisabled(); i++) {
      const plus = await page.$('.kd2-ratio button[aria-label$="を増やす"]:not([disabled])');
      if (plus) await plus.click(); else { const minus = await page.$('.kd2-ratio button[aria-label$="を減らす"]:not([disabled])'); if (minus) await minus.click(); }
      await sleep(40);
    }
    const c2 = await page.$('.kd-confirm .kd-btn.is-primary:not([disabled])');
    if (c2) { await c2.click(); return 'ratio'; }
    return null;
  }
  const conf = await page.$('.kd-confirm .kd-btn.is-primary');
  if (conf) {
    const title = ((await page.textContent('.kd-screen-h').catch(() => '')) ?? '').trim();
    if (seen) {
      const key = title.replace(/\s+/g, '').slice(0, 12);
      if (!seen.has(`pick:${key}`)) { seen.add(`pick:${key}`); const n = [...seen].filter((x) => x.startsWith('pick:')).length; await sleep(300); await both(page, `1${n}-setup-${n}`, `準備「${title.slice(0, 16)}」`); }
    }
    if (await conf.isDisabled()) { const c = await page.$('.kd-offer .kd-card:not(.is-selected)'); if (c) await c.click(); await sleep(60); }
    const c2 = await page.$('.kd-confirm .kd-btn.is-primary:not([disabled])');
    if (c2) { await c2.click(); return 'pick'; }
  }
  if (await page.$('.kd-root.is-myturn')) {
    if (!avoid.has(page)) avoid.set(page, new Set());
    const av = avoid.get(page);
    const keyed = [];
    for (const c of await page.$$('[data-kd^="space:"].is-can')) keyed.push([c, await c.getAttribute('data-kd')]);
    // 巣（戦い）を少し優先して、戦闘トレイも通す
    const nest = keyed.find(([, k]) => /nest|lair/.test(k) && !av.has(k));
    const pick = (Math.random() < 0.35 && nest) || keyed.find(([, k]) => !av.has(k)) || keyed[0];
    if (!pick) return null;
    await pick[0].click();
    await sleep(60);
    const go = await page.$('.kd-mybar .kd-btn.is-primary:not([disabled])');
    if (go) { await go.click(); av.add(pick[1]); if (av.size > 4) av.clear(); return 'place'; }
  }
  return null;
}

let failed = false;
// ================================================================ A. ひとりで遊ぶ
async function solo() {
  const page = await mkPage('solo');
  await page.goto(APP);
  await page.waitForSelector('text=ひとりで遊ぶ（AI）');
  check(!!(await page.$('button[aria-pressed="true"]:has-text("新ルール")')), 'タイトルで新ルールが選ばれている（標準）');
  await both(page, '00-title', 'タイトル');
  await page.click('text=ひとりで遊ぶ（AI）');
  await page.click('.kda-seg button:has-text("5年")').catch(() => {});
  await page.click('.kda-seg button:has-text("4人")');
  await both(page, '01-solo-setup', 'ひとりで遊ぶの設定');
  await page.click('button:has-text("冒険をはじめる")');
  await page.waitForSelector('.kd-root.kd2', { timeout: 15000 });
  const seen = new Set();
  const counts = {};
  const t0 = Date.now();
  let boardShot = false, inspShot = false;
  while ((await roundOf(page)) < 4) {
    if (Date.now() - t0 > 6 * 60_000) throw new Error('solo: 4ラウンドに届かない');
    if (!boardShot && (await roundOf(page)) >= 2 && await page.$('.kd-root.is-myturn') && !(await page.$('.kd-ovwrap'))) {
      await idle(page);
      if (await page.$('.kd-root.is-myturn') && !(await page.$('.kd-ovwrap'))) {
        boardShot = true;
        await both(page, '20-board', '盤面（あなたの番）');
        const pct = await page.textContent('.kd-tidechip').catch(() => '');
        check(/進み \d+%/.test(pct ?? ''), `進み具合が%で出る（${pct}）`);
        // タブ：拠点（仲間ごとの武器・防具の枠）
        const base = await page.$('[data-kd="tab:base"]');
        if (base) { await base.click(); await sleep(300); await both(page, '21-base', '拠点（装備の枠）'); check(!!(await page.$('.kd2-comp')), '仲間ごとの装備の枠が見える'); }
        const quests = await page.$('[data-kd="tab:quests"]');
        if (quests) { await quests.click(); await sleep(300); await shot(page, '22-quests.png'); }
        const board = await page.$('[data-kd="tab:board"]');
        if (board) { await board.click(); await sleep(200); }
      }
    }
    if (boardShot && !inspShot && !(await page.$('.kd-ovwrap'))) {
      // タップで詳しく：プレイヤーと行動マス
      const chip = await page.$('.kd-pchip:not(.is-me)');
      if (chip) {
        await chip.click(); await sleep(300);
        if (await page.$('.kd-insp')) { inspShot = true; await both(page, '23-inspect-player', '詳しく見る（プレイヤー）'); await page.keyboard.press('Escape'); await sleep(200); }
        const sp = await page.$('.kd-space:not(.is-can)');
        if (sp) { await sp.click({ force: true }); await sleep(300); if (await page.$('.kd-insp')) { await shot(page, '24-inspect-space.png'); await page.keyboard.press('Escape'); await sleep(200); } }
        inspShot = true;
      }
    }
    const r = await step(page, seen).catch((e) => { if (!/detached|not attached|intercepts pointer/.test(String(e))) errors.push(`solo step: ${String(e).split('\n')[0]}`); return null; });
    if (r) counts[r] = (counts[r] ?? 0) + 1; else await sleep(40);
  }
  log('solo counts', counts);
  check((counts.pick ?? 0) >= 4 && counts.ratio >= 1 && (counts.place ?? 0) > 3, `準備（カード・割合）と置き場所を答えた ${JSON.stringify(counts)}`);
  check(boardShot, '盤面の写真が撮れた');
  // ⚙ → タイトルへ →「途中の試合にもどる」：答えの記録から同じ場面に戻る
  for (let i = 0; i < 50 && await page.$('.kd-tray, .kd-sheet'); i++) { await step(page).catch(() => null); await sleep(100); }
  // 戦闘・冬の重なりが消えて、自分が置く番になるまで進める（メニューを押せるように）
  for (let i = 0; i < 400; i++) {
    if (await page.$('.kd-root.is-myturn') && !(await page.$('.kd-ovwrap, .kd-tray, .kd-sheet'))) break;
    await step(page).catch(() => null); await sleep(60);
  }
  // 自分の番の問いは演出より先に出るので、盤面の演出が追いつくまで待ってから比べる
  await page.waitForSelector('.kd-hud-ctl .kd-iconbtn[disabled]', { timeout: 120000 }).catch(() => {}); await sleep(300);
  try {
    const r0 = await roundOf(page);
    const fame0 = await page.$$eval('.kd-pchip b[data-kd^="fame:"]', (e) => e.map((x) => x.textContent));
    await page.click('.kd-hud-ctl .kd-cat-menu:not(.kd-hudmenu) summary');
    await page.click('button:has-text("タイトルへ")');
    await page.waitForSelector('[data-kd="resume-solo"]', { timeout: 10000 });
    check(true, 'タイトルに「途中の試合にもどる」（ひとり）が出る');
    await shot(page, '02-title-resume-solo.png');
    await page.click('[data-kd="resume-solo"]');
    await page.waitForSelector('.kd-root.kd2 .kd-pchip', { timeout: 20000 });
    await idle(page);
    const r1 = await roundOf(page);
    const fame1 = await page.$$eval('.kd-pchip b[data-kd^="fame:"]', (e) => e.map((x) => x.textContent));
    check(r1 === r0 && JSON.stringify(fame1) === JSON.stringify(fame0), `再開して同じ場面に戻る（ラウンド ${r0}→${r1}・名声 ${fame0.join(',')} → ${fame1.join(',')}）`);
  } catch (e) { check(false, `ひとりの途中再開：${String(e).split('\n')[0]}`); }
  // ⚙ → 自分の席もAIに任せる → 最後まで（開いているトレイ・シートは先に答える）
  for (let i = 0; i < 50 && await page.$('.kd-tray, .kd-sheet'); i++) { await step(page).catch(() => null); await sleep(100); }
  await page.click('.kd-hud-ctl .kd-cat-menu:not(.kd-hudmenu) summary');
  await page.click('button:has-text("自分の席もAIに任せる")');
  await page.click('.kd-hud-ctl .kd-cat-menu:not(.kd-hudmenu) summary').catch(() => {});
  const t1 = Date.now();
  while (!(await page.$('.kd-final'))) {
    if (Date.now() - t1 > 12 * 60_000) throw new Error('solo: 最後まで届かない');
    const sk = await page.$('.kd-hud-ctl .kd-iconbtn:not([disabled])');
    if (sk) await sk.click().catch(() => {});
    await sleep(150);
  }
  await idle(page); await sleep(1500);
  check(!(await page.evaluate(() => localStorage.getItem('kd2.solo'))), '終わった試合は「途中の試合」から消える');
  const tot = await page.$$eval('.kd-final .kd-ftotal', (els) => els.map((e) => e.textContent.trim()));
  check(tot.length === 4, `最終得点が4人分出る：${tot.join(',')}`);
  await both(page, '40-final', '最終得点');
  await page.click('.kd-final [role="tab"]:has-text("内訳")');
  await sleep(500);
  const brk = await page.$('.kd2-ftable');
  if (brk && await brk.isVisible()) { const rows = await page.$$eval('.kd2-ftable tbody tr', (e) => e.length); await both(page, '41-final-breakdown', '名声の内訳'); check(rows > 3, `名声の内訳表が出る（${rows}行）`); }
  else check(false, '名声の内訳表が見つからない');
}

// ================================================================ B. 友だちと遊ぶ
async function online() {
  const host = await mkPage('host');
  const guest = await mkPage('guest');
  await host.goto(APP);
  await host.click('text=友だちと遊ぶ');
  await host.fill('#kd-host-name', 'ホスト');
  await host.click('button:has-text("部屋をつくる")');
  await host.waitForSelector('text=招待を待っています', { timeout: 15000 });
  const invite = (await host.textContent('.kd-room-url')).trim();
  await guest.goto(invite.replace('#', '?speed=minimal#'));
  await guest.waitForSelector('#kd-nick');
  await guest.fill('#kd-nick', 'アオイ');
  await guest.click('button:has-text("参加を申し込む")');
  await host.waitForSelector('.kd-room-wait button:has-text("承認")', { timeout: 15000 });
  await host.click('.kd-room-wait button:has-text("承認")');
  await guest.waitForSelector('text=ホストが始めるのを待っています', { timeout: 15000 });
  await host.click('.kd-room-seg button:has-text("3人")');
  await sleep(400);
  const note = await guest.textContent('.kd-room-note').catch(() => '');
  check(/新ルール/.test(note ?? ''), `参加者の待合室にルールの版が出る（${note}）`);
  await both(host, '50-lobby-host', '待合室（ホスト）');
  await shot(guest, '50-lobby-guest.png');
  await host.click('.kd-room-start');
  log('online start');

  const MENU = '.kd-hud-ctl .kd-cat-menu:not(.kd-hudmenu) summary';
  const seen = new Set(['tray', 'sheet', 'ratio', ...Array.from({ length: 12 }, (_, i) => `pick:${i}`)]);
  let chatted = false, awayDone = false, guestShot = false, setupShot = false;
  const counts = {};
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    if (Date.now() - t0 > 12 * 60_000) throw new Error('online: 時間切れ');
    if (!setupShot && await guest.$('.kd2-setup .kd-confirm .kd-btn.is-primary')) { setupShot = true; await sleep(300); await shot(guest, '51-setup-guest.png'); }
    if (!guestShot && (await roundOf(guest)) >= 2 && await guest.$('.kd-root.is-myturn') && !(await guest.$('.kd-ovwrap'))) {
      await idle(guest);
      if (await guest.$('.kd-root.is-myturn')) { guestShot = true; await both(guest, '52-ingame-guest', '参加者の試合画面'); }
    }
    if (guestShot && !chatted) {
      chatted = true;
      try {
        await host.click(MENU); await host.click('.kd-chatbtn'); await host.waitForSelector('.kd-chat');
        await host.fill('.kd-chat-in input', 'こんにちは、新ルール！'); await host.click('.kd-chat-in .kd-btn');
        await host.waitForSelector('.kd-chatline.is-me:has-text("こんにちは、新ルール！")', { timeout: 8000 });
        await host.click('.kd-chat-x');
        await guest.waitForSelector('.kd-chatfloat-l:has-text("こんにちは、新ルール！")', { timeout: 8000 });
        check(true, '参加者の盤面にホストの発言が流れる');
        await shot(guest, '53-chat-float-guest.png');
        await guest.click(MENU); await guest.click('.kd-chatbtn'); await guest.waitForSelector('.kd-chatline:has-text("こんにちは、新ルール！")');
        await guest.click('.kd-chat-stamps button:has-text("ナイス！")');
        await guest.waitForSelector('.kd-chatline.is-me.is-stamp:has-text("ナイス！")', { timeout: 8000 });
        await sleep(300);
        await both(guest, '54-chat-sheet-guest', 'チャット');
        await guest.click('.kd-chat-x');
        await host.waitForSelector('.kd-chatfloat-l:has-text("ナイス！")', { timeout: 8000 });
        check(true, 'ホストの盤面に参加者のスタンプが流れる');
      } catch (e) { check(false, `チャット：${String(e).split('\n')[0]}`); }
    }
    if (chatted && !awayDone && (await roundOf(host)) >= 3) {
      awayDone = true;
      try {
        const before = await guest.textContent('.kd-pchip.is-me');
        await guest.click(MENU);
        await guest.click('button:has-text("いったん退室する")');
        await guest.waitForSelector('button:has-text("途中の試合にもどる")', { timeout: 10000 });
        await shot(guest, '55-title-resume-guest.png');
        await host.waitForSelector('.kd-netnote-away:has-text("アオイ")', { timeout: 30000 });
        check(true, 'ホストに「退室中（AIが代わりに動かします）」が出る');
        const r0 = await roundOf(host);
        const t1 = Date.now();
        while (Date.now() - t1 < 90_000 && (await roundOf(host)) < r0 + 1) { await step(host).catch(() => null); await sleep(40); }
        check((await roundOf(host)) > r0, `退室中もAIが代わりに動いて進む（ラウンド ${r0}→${await roundOf(host)}）`);
        await shot(host, '56-away-host.png');
        await guest.click('button:has-text("途中の試合にもどる")');
        await guest.waitForSelector('.kd-pchip.is-me', { timeout: 20000 });
        await host.waitForFunction(() => !document.querySelector('.kd-netnote-away'), null, { timeout: 20000 });
        const after = await guest.textContent('.kd-pchip.is-me');
        const nm = (x) => x.replace(/[0-9先]/g, '');
        check(nm(after) === nm(before), `タイトルから同じ席に戻る（${nm(after)}）`);
      } catch (e) { check(false, `途中退室：${String(e).split('\n')[0]}`); }
    }
    for (const page of [host, guest]) {
      const r = await step(page).catch((e) => { if (!/detached|not attached|Target closed|intercepts pointer/.test(String(e))) errors.push(`online step: ${String(e).split('\n')[0]}`); return null; });
      if (r) counts[r] = (counts[r] ?? 0) + 1;
    }
    const [rh, rg] = [await roundOf(host), await roundOf(guest)];
    if (awayDone && Math.min(rh, rg) >= 5) break;
    if (i % 40 === 0) log(`round host ${rh} guest ${rg}`, counts);
    await sleep(40);
  }
  check(counts.pick > 0 && counts.place > 0 && counts.ratio > 0, `準備と置き場所を両方の画面で答えた ${JSON.stringify(counts)}`);
  const [fh, fg] = [await host.$$eval('.kd-pchip b[data-kd^="fame:"]', (e) => e.map((x) => x.textContent)), await guest.$$eval('.kd-pchip b[data-kd^="fame:"]', (e) => e.map((x) => x.textContent))];
  log('fame host', fh, 'guest', fg);
  await host.click(MENU);
  await host.click('button:has-text("部屋を閉じてタイトルへ")');
  await guest.waitForSelector('text=部屋が閉じました', { timeout: 15000 });
  check(true, '参加者に「部屋が閉じました」が出る');
}

try {
  if (ONLY !== 'online') await solo();
  if (ONLY !== 'solo') await online();
} catch (e) {
  failed = true;
  console.error('ERROR', e);
}
const bad = checks.filter(([ok]) => !ok).length;
log(`checks ${checks.length - bad}/${checks.length}`, errors.length ? `errors: ${errors.slice(0, 8).join(' | ')}` : 'no page errors');
for (const b of browsers) await b.close();
web.srv.close(); psrv.close();
process.exit(failed || bad || errors.length ? 1 : 0);

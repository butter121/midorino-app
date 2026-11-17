// 霧谷の冒険者団：「1画面に収まるか」の確認。各画面×各画面サイズで
//   ・ページ全体がスクロールしない（document.scrollingElement の scrollHeight/scrollWidth が画面以下）
//   ・overflow:auto/scroll の要素の中身がはみ出していない（中でスクロールしない）
//   （オンライン対戦の入口・待合室・参加の画面・チャットも：friends / lobby / join / chat / chat-game。チャットの発言の一覧だけは中で動かしてよい）
//   ・画面の骨組みの箱（盤面・拠点など）が overflow:hidden で中身を切っていない
// を調べて表にする。使い方：
//   npm run build -w @midorino/app && npm run catalog:build -w @midorino/ui
//   node tools/kiridani/fit-check.mjs [--shots DIR] [--only board,draft] [--vp 390x844,844x390]
// 本番アプリ（packages/app/dist）とカタログ（packages/ui/dist-catalog、?at= で場面へ飛べる）を内蔵の小さなサーバーで配る。
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright'); }

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const SHOTS = opt('--shots');
const ONLY = opt('--only')?.split(',');
const PREFIX = opt('--prefix') ?? 'fit';
const N = Number(opt('--n') ?? 6);
const VPS = (opt('--vp') ?? '390x844,375x667,844x390,667x375,1280x800').split(',').map((s) => s.split('x').map(Number));
const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function serve(dir) {
  return new Promise((ok) => {
    const srv = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      try { const b = await readFile(join(dir, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
      catch { res.writeHead(404); res.end(); }
    });
    srv.listen(0, '127.0.0.1', () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(page, fn, ms = 20000, step = 150) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); }
}
const idle = (page) => until(page, () => page.$('.kd-hud-ctl .kd-iconbtn[disabled]'), 30000);
/** 自分の番（置く場所を選べる）で、演出が止まるまで待つ */
async function myTurn(page) {
  await until(page, async () => (await page.$('.kd-root.is-myturn')) && (await page.$('.kd-hud-ctl .kd-iconbtn[disabled]')), 40000);
  await sleep(250);
}
async function place(page, sel) {
  const el = await page.$(sel);
  if (!el) return false;
  await el.click();
  await sleep(120);
  const go = await page.$('.kd-mybar .kd-btn.is-primary:not([disabled])');
  if (!go) return false;
  await go.click();
  return true;
}

let CAT, APP;
/** 発言とスタンプをいくつか送る（10秒に5通までなので5通） */
async function chatSay(p) {
  for (const t of ['こんにちは', 'よろしくお願いします。今日は霧谷で魔物を倒しましょう！長めの発言も折り返して見えるか確かめます']) {
    await p.fill('.kd-chat-in input', t); await p.click('.kd-chat-in .kd-btn'); await sleep(150);
  }
  for (const b of ['ナイス！', 'ありがとう', 'ごめん']) { await p.click(`.kd-chat-stamps button:has-text("${b}")`); await sleep(150); }
  await sleep(500);
}
const cat = (q) => `${CAT}kiridani.html?n=${N}&seed=7&speed=minimal&${q}`;

/** 画面ごとの行き方（見つからなければ null を返す＝その場面は作れなかった） */
const SCENES = {
  title: async (p) => { await p.goto(APP); await p.waitForSelector('.kda-start'); await sleep(400); return true; },
  friends: async (p) => { await p.goto(APP); await p.click('text=友だちと遊ぶ'); await p.waitForSelector('#kd-host-name'); await sleep(300); return true; },
  lobby: async (p) => {
    await SCENES.friends(p); await p.fill('#kd-host-name', 'ホスト'); await p.click('button:has-text("部屋をつくる")');
    await p.waitForSelector('.kd-room-qr svg'); await sleep(400); return true;
  },
  // チャット（ホストひとりでも自分の発言は届く）：待合室と、AI だけを足して始めた試合の ⚙ から
  chat: async (p) => {
    await SCENES.lobby(p); await p.click('.kd-room-h .kd-chatbtn'); await p.waitForSelector('.kd-chat');
    await chatSay(p); return true;
  },
  'chat-game': async (p) => {
    await SCENES.lobby(p); await p.click('.kd-room-start'); await p.waitForSelector('.kd-offer .kd-card', { timeout: 20000 });
    await p.click('.kd-hud-ctl .kd-cat-menu:not(.kd-hudmenu) summary'); await p.click('.kd-chatbtn'); await p.waitForSelector('.kd-chat');
    await chatSay(p); return true;
  },
  join: async (p) => { await p.goto(`${APP}#join=${'ab'.repeat(16)}`); await p.waitForSelector('#kd-nick'); await sleep(300); return true; },
  draft: async (p) => { await p.goto(cat('at=draft')); await p.waitForSelector('.kd-offer .kd-card'); await idle(p); return true; },
  char: async (p) => { await p.goto(cat('at=char')); await p.waitForSelector('.kd-charcard'); await idle(p); return true; },
  board: async (p) => { await p.goto(cat('at=r9')); await myTurn(p); return true; },
  base: async (p) => { await SCENES.board(p); await p.click('[data-kd="tab:base"]'); await sleep(300); return true; },
  quests: async (p) => { await SCENES.board(p); await p.click('[data-kd="tab:quests"]'); await sleep(300); return true; },
  everyone: async (p) => { await SCENES.board(p); await p.click('[data-kd="tab:all"]'); await sleep(300); return true; },
  'fight-tray': async (p) => {
    await SCENES.board(p);
    const ok = await place(p, 'button.kd-nest.is-can:has(.kd-mon)') || await place(p, '[data-kd="space:lair"].is-can');
    return ok && !!(await until(p, () => p.$('.kd-tray'), 4000));
  },
  'market-tray': async (p) => {
    await SCENES.board(p);
    const ok = await place(p, '[data-kd="space:market"].is-can') || await place(p, '[data-kd="space:stall"].is-can');
    return ok && !!(await until(p, () => p.$('.kd-tray'), 4000));
  },
  'trade-tray': async (p) => {
    await SCENES.board(p);
    const b = await p.$('.kd-tradebtn:not([disabled])');
    if (!b) return false;
    await b.click();
    return !!(await until(p, () => p.$('.kd-tray'), 4000));
  },
  'choice-sheet': async (p) => {
    for (const r of ['r9', 'r5', 'r1']) {
      await p.goto(cat(`at=${r}`)); await myTurn(p);
      for (const sp of ['workshop', 'guild', 'forge']) {
        if (await place(p, `[data-kd="space:${sp}"].is-can`)) {
          if (await until(p, () => p.$('.kd-sheet'), 2500)) return true;
          await myTurn(p);
        }
      }
    }
    return false;
  },
  'inspect-player': async (p) => { await SCENES.board(p); await p.click('[data-inspect="seat:1"]'); return !!(await until(p, () => p.$('.kd-insp'), 3000)); },
  'inspect-card': async (p) => {
    await SCENES.board(p); await p.click('[data-kd="tab:base"]'); await sleep(200);
    const c = await p.$('.kd-base [data-inspect^="card:"]');
    if (!c) return false;
    await c.click(); return !!(await until(p, () => p.$('.kd-insp'), 3000));
  },
  'inspect-upkeep': async (p) => { await SCENES.board(p); const c = await p.$('.kd-upchip'); if (!c) return false; await c.click(); return !!(await until(p, () => p.$('.kd-insp'), 3000)); },
  combat: async (p) => {
    await p.goto(cat('at=combat').replace('speed=minimal', 'speed=normal'));
    return !!(await until(p, () => p.$('.kd-combat .kd-result, .kd-combat .kd-fatecard.is-open'), 30000, 100));
  },
  winter: async (p) => {
    await p.goto(cat('at=winter').replace('speed=minimal', 'speed=normal'));
    return !!(await until(p, () => p.$('.kd-winter .kd-raid, .kd-winter .kd-wrow.is-now'), 30000, 100));
  },
  final: async (p) => {
    await p.goto(cat('at=final'));
    await until(p, () => p.$('.kd-final'), 30000);
    await idle(p); await sleep(300);
    return !!(await p.$('.kd-final'));
  },
};

async function measure(page) {
  return page.evaluate(() => {
    const se = document.scrollingElement;
    const page = { h: se.scrollHeight, w: se.scrollWidth, vh: innerHeight, vw: innerWidth };
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
      if (el.clientHeight === 0 && el.clientWidth === 0) continue;
      // チャットの発言の一覧だけは中で動かしてよい（古い発言が上へ流れる）
      if (el.classList.contains('kd-chatlist')) continue;
      const dy = el.scrollHeight - el.clientHeight; const dx = el.scrollWidth - el.clientWidth;
      if (dy > 2 || dx > 2) bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${dy > 2 ? ` +${dy}px↓` : ''}${dx > 2 ? ` +${dx}px→` : ''}`);
    }
    // overflow:hidden で切れていないか（レイアウトの箱だけ。文の「…」省略はわざとなので見ない）
    const BOX = '.kd-room, .kd-room-mem, .kd-shell, .kd-main, .kd-rail, .kd-mybar, .kd-tabbody, .kd-screen, .kd-board, .kd-nests, .kd-spaces, .kd-base, .kd-base-grid, .kd-quests, .kd-everyone, .kd-offer, .kd-chars, .kd-final, .kd-hud';
    for (const el of document.querySelectorAll(BOX)) {
      const dy = el.scrollHeight - el.clientHeight; const dx = el.scrollWidth - el.clientWidth;
      if (dy > 2 || dx > 2) bad.push(`clip ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${dy > 2 ? ` +${dy}px↓` : ''}${dx > 2 ? ` +${dx}px→` : ''}`);
    }
    // チャットの欄は画面の中に収まり、入力欄が見えていること
    const chat = document.querySelector('.kd-chat');
    if (chat) {
      const r = chat.getBoundingClientRect(); const inp = document.querySelector('.kd-chat-in input')?.getBoundingClientRect();
      if (r.top < -1 || r.bottom > innerHeight + 1) bad.push(`chat ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      if (!inp || inp.bottom > innerHeight) bad.push('chat input hidden');
    }
    return { page, bad, pageOk: page.h <= page.vh && page.w <= page.vw };
  });
}

const main = async () => {
  const a = await serve(join(ROOT, 'packages/app/dist')); APP = a.url;
  const c = await serve(join(ROOT, 'packages/ui/dist-catalog')); CAT = c.url;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const browser = await pw.chromium.launch();
  const rows = [];
  const names = Object.keys(SCENES).filter((n) => !ONLY || ONLY.includes(n));
  for (const [w, h] of VPS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1, serviceWorkers: 'block', hasTouch: w < 1000, isMobile: w < 1000 });
    for (const name of names) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      let reached = false;
      try { reached = await SCENES[name](page); } catch (e) { errs.push(String(e).split('\n')[0]); }
      const m = reached ? await measure(page) : null;
      if (SHOTS && reached) await page.screenshot({ path: join(SHOTS, `${PREFIX}-${name}-${w}x${h}.png`) });
      const ok = !!m && m.pageOk && !m.bad.length;
      rows.push({ vp: `${w}x${h}`, name, ok, reached, m, errs });
      console.log(`${ok ? 'OK  ' : reached ? 'FAIL' : 'N/A '} ${`${w}x${h}`.padEnd(9)} ${name.padEnd(15)} ${m ? `page ${m.page.w}x${m.page.h}` : ''} ${m?.bad.join(' | ') ?? ''} ${errs.join(' ; ')}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close(); a.srv.close(); c.srv.close();
  // 表
  const vps = [...new Set(rows.map((r) => r.vp))];
  console.log(`\n| screen | ${vps.join(' | ')} |\n|---|${vps.map(() => '---').join('|')}|`);
  for (const n of names) console.log(`| ${n} | ${vps.map((v) => { const r = rows.find((x) => x.vp === v && x.name === n); return !r ? '' : !r.reached ? 'n/a' : r.ok ? 'ok' : 'FAIL'; }).join(' | ')} |`);
  const fails = rows.filter((r) => r.reached && !r.ok).length;
  process.exitCode = fails ? 1 : 0;
};
main();

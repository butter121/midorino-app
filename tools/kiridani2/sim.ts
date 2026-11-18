// 霧谷の冒険者団 v2 — AI どうしの対戦をたくさん回して SPEC §11 の値を出す。
//
//   npx vite-node tools/kiridani2/sim.ts                 （既定：各年数 200 局・4人・4並列）
//   SIM_N=50 SIM_YEARS=5 SIM_PLAYERS=3 SIM_JOBS=2 npx vite-node tools/kiridani2/sim.ts
//   SIM_JSON=out.json …                                   （集計を JSON でも書き出す）
//
// 測り方（SPEC.md「実装メモ」にも書いた）
// - 卓：「同じ腕前の卓」＝全員 strong。「腕前がばらばらの卓」＝席ごとに novice/normal/strong をくじ（同じ卓にそろわないよう2種以上）。
//   ほとんどの値は同じ腕前の卓から出し、運の割合だけ両方を使う。
// - 運の割合（v1 と同じ定義）＝ 同じ腕前の卓での「名声 − 卓の平均」の分散 ÷ ばらばらの卓での同じ分散。
//   参考に、同じ腕前の卓で「運命カードの平均（その人がめくった札）」で名声差がどれだけ説明できるか（R²）も出す。
// - 回しきれたラウンド：その人の目指す強い動き（AI が準備段階で決めた1つ目）の「一周」（ai.ts の LOOPS：手順の組をすべて満たす）を
//   そのラウンドにできた割合。その動きのタグを持つカードが2枚以上出たあとのラウンドだけ数える。
//   参考に「冬に全員を食べさせられた割合」と「広場（余り手）に置いた割合」も出す。
// - 同じ手順の繰り返し：前のラウンドと置いたマスの組（並びは問わない）がまったく同じだった割合。
// - 強い動きごとの名声：同じ腕前の卓では席ごとに目指す動きをくじで決め（bridge 以外の12種）、動きごとの「名声 − 卓の平均」の平均を出す。
// - 名声の内訳：勝者の名声（プラスの入り口の合計）に占める各入り口の割合と、どれかが4割を超えた勝者の割合。
// - カード：取ったカード（リーダー・ドラフト・補充・山から引いたもの）ごとの「名声 − 卓の平均」の平均（30局以上出たもの）。
import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { AI, CARD_SET, drive, Game, Rng, LOOPS, loopDone, scoreBreakdown, score, type EngineTag, type Level } from '../../packages/engine/src/kiridani2/index';

const FORCE_TAGS: EngineTag[] = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss'];
const env = (k: string, d: string) => process.env[k] ?? d;

interface PRec {
  seat: number; level: Level; target: string; targets: string[]; leader: string; score: number; rel: number; win: boolean;
  bd: Record<string, number>; picked: string[]; loopN: number; loopOk: number; repeats: number; rounds: number; fed: number; winters: number;
  plaza: number; places: number; fateMean: number; fates: number; comps: number; kills: number; bossTro: number; bossWins: number;
}
interface FRec { t: number; kind: string; str: number; base: number; total: number; win: boolean; addons: number; comps: number; sides: number; mode: string }
interface GRec { years: number; n: number; mixed: boolean; seed: number; players: PRec[]; ms: number; fights: FRec[] }

function playOne(years: number, n: number, seed: number, mixed: boolean): GRec {
  const lr = new Rng(seed * 7919 + 13);
  let levels: Level[] = Array(n).fill('strong');
  if (mixed) do { levels = Array.from({ length: n }, () => lr.choice(['novice', 'normal', 'strong'] as Level[])); } while (new Set(levels).size < 2);
  // 同じ腕前の卓では、席ごとに目指す動きをくじで決める（強い動きごとの名声を同じ数ずつ比べるため。SIM_NATURAL=1 で AI まかせ）
  const tags = lr.shuffle([...FORCE_TAGS]);
  const ais = levels.map((l, i) => new AI(l, { seed: seed * 31 + i, ...(!mixed && !process.env.SIM_NATURAL ? { target: tags[i % tags.length] } : {}) }));
  const g = new Game(n, ais, { seed, years, cards: CARD_SET });
  const t0 = Date.now();
  const scores = drive(g.play());
  const ms = Date.now() - t0;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const top = Math.max(...scores);
  const fates: Record<number, number[]> = {};
  for (const f of g.fateLog) (fates[f.pid] ??= []).push(f.v);
  const players: PRec[] = g.players.map((p, i) => {
    const t = (p.target[0] ?? 'hunt') as EngineTag;
    let loopN = 0, loopOk = 0, repeats = 0, plaza = 0, places = 0;
    p.history.forEach((acts, ri) => {
      const parts = (p.cardHist[ri] ?? []).filter((c) => g.card(c).engine.includes(t)).length;
      if (parts >= 2) { loopN++; if (loopDone(t, acts) === LOOPS[t].length) loopOk++; }
      const sp = acts.filter((a) => a.startsWith('sp:')).sort().join(',');
      places += acts.filter((a) => a.startsWith('sp:')).length;
      plaza += acts.filter((a) => a === 'sp:plaza').length;
      if (ri > 0) {
        const prev = p.history[ri - 1].filter((a) => a.startsWith('sp:')).sort().join(',');
        if (sp === prev) repeats++;
      }
    });
    const fv = fates[p.pid] ?? [];
    return {
      seat: i, level: levels[i], target: t, targets: p.target, leader: p.leader ?? '', score: scores[i], rel: scores[i] - mean, win: scores[i] === top,
      bd: scoreBreakdown(g, p), picked: [p.leader ?? '', ...p.picked].filter(Boolean), loopN, loopOk, repeats, rounds: p.history.length,
      fed: p.fed.filter(Boolean).length, winters: p.fed.length, plaza, places, fateMean: fv.length ? fv.reduce((a, b) => a + b, 0) / fv.length : 0.5, fates: fv.length, comps: p.comps.length, kills: p.kills,
      bossTro: g.fightLog.filter((f) => f.kind !== 'nest').reduce((a, f) => a + (f.tro[f.pids.indexOf(p.pid)] ?? 0), 0), bossWins: p.st.boss,
    };
  });
  if (g.errors.length) throw new Error(`errors in game ${seed}: ${g.errors.join(';')}`);
  for (const [i, p] of g.players.entries()) if (score(g, p) !== scores[i]) throw new Error('score mismatch');
  const fights = g.fightLog.map(({ t, kind, str, base, total, win, addons, comps, sides, mode }) => ({ t, kind, str, base, total, win, addons, comps, sides, mode }));
  return { years, n, mixed, seed, players, ms, fights };
}

// ------------------------------------------------------------ 並列
interface Task { years: number; n: number; mixed: boolean; seeds: number[] }
function runWorker() {
  const task = JSON.parse(process.env.SIM_TASK!) as Task;
  const out: GRec[] = task.seeds.map((s) => playOne(task.years, task.n, s, task.mixed));
  process.stdout.write('@@JSON@@' + JSON.stringify(out));
}

/** 子プロセスで回すために、このファイルを1つの .mjs にまとめる（vite-node より速い） */
async function bundle(): Promise<string> {
  const esbuild = await import('esbuild');
  const out = join(tmpdir(), `kiridani2-sim-${process.pid}.mjs`);
  await esbuild.build({ entryPoints: [fileURLToPath(import.meta.url)], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'warning' });
  return out;
}

let workerFile = '';
function runTask(t: Task): Promise<GRec[]> {
  return new Promise((res, rej) => {
    const ch = spawn(process.execPath, [workerFile], { env: { ...process.env, SIM_WORKER: '1', SIM_TASK: JSON.stringify(t) }, stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    ch.stdout.on('data', (d) => { buf += d; });
    ch.on('close', (code) => {
      const i = buf.indexOf('@@JSON@@');
      if (code !== 0 || i < 0) return rej(new Error(`worker failed (${code})`));
      res(JSON.parse(buf.slice(i + 8)));
    });
  });
}

async function runAll(tasks: Task[], jobs: number): Promise<GRec[]> {
  const out: GRec[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (next < tasks.length) { const t = tasks[next++]; out.push(...(await runTask(t))); }
  }));
  return out;
}

// ------------------------------------------------------------ 集計
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const vari = (xs: number[]) => { const m = avg(xs); return avg(xs.map((x) => (x - m) ** 2)); };
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');

const SRC: Record<string, (bd: Record<string, number>) => number> = {
  trophy: (b) => b.trophy + Math.max(0, b.dragon),
  quest: (b) => b.quest + b.secret,
  donate: (b) => b.donate,
  ancient: (b) => b.ancient,
  cards: (b) => b.card + Math.max(0, b.effect),
  table: (b) => Object.entries(b).filter(([k]) => k.startsWith('table_')).reduce((a, [, v]) => a + Math.max(0, v), 0),
  comps: (b) => b.comps,
  gold: (b) => b.gold,
};

function summarize(years: number, eq: GRec[], mx: GRec[]) {
  const P = eq.flatMap((g) => g.players);
  const PM = mx.flatMap((g) => g.players);
  const res: Record<string, unknown> = { years, games: eq.length, mixedGames: mx.length };
  // 運の割合
  const vEq = vari(P.map((p) => p.rel)), vMx = vari(PM.map((p) => p.rel));
  res.luck = vEq / vMx;
  // 参考：運命カードの平均で名声差を説明できる割合（同じ腕前の卓）
  const xs = P.map((p) => p.fateMean), ys = P.map((p) => p.rel);
  const mx_ = avg(xs), my = avg(ys);
  const cov = avg(xs.map((x, i) => (x - mx_) * (ys[i] - my)));
  res.fateR2 = cov * cov / (vari(xs) * vari(ys));
  res.levelMean = Object.fromEntries((['novice', 'normal', 'strong'] as Level[]).map((l) => [l, avg(PM.filter((p) => p.level === l).map((p) => p.rel))]));
  // 回しきれたラウンド
  res.loop = P.reduce((a, p) => a + p.loopOk, 0) / Math.max(1, P.reduce((a, p) => a + p.loopN, 0));
  res.loopRounds = P.reduce((a, p) => a + p.loopN, 0) / P.length;
  res.loopBy = Object.fromEntries([...new Set(P.map((p) => p.target))].sort().map((t) => {
    const q = P.filter((p) => p.target === t);
    return [t, q.reduce((a, p) => a + p.loopOk, 0) / Math.max(1, q.reduce((a, p) => a + p.loopN, 0))];
  }));
  res.fed = P.reduce((a, p) => a + p.fed, 0) / Math.max(1, P.reduce((a, p) => a + p.winters, 0));
  res.plaza = P.reduce((a, p) => a + p.plaza, 0) / Math.max(1, P.reduce((a, p) => a + p.places, 0));
  res.repeat = P.reduce((a, p) => a + p.repeats, 0) / Math.max(1, P.reduce((a, p) => a + p.rounds - 1, 0));
  // 強い動きごと
  res.engine = Object.fromEntries([...new Set(P.map((p) => p.target))].sort().map((t) => {
    const q = P.filter((p) => p.target === t);
    return [t, { n: q.length, rel: avg(q.map((p) => p.rel)), fame: avg(q.map((p) => p.score)), win: avg(q.map((p) => (p.win ? 1 : 0))), comps: avg(q.map((p) => p.comps)), kills: avg(q.map((p) => p.kills)), bossTro: avg(q.map((p) => p.bossTro)), bossWins: avg(q.map((p) => p.bossWins)), src: Object.fromEntries(Object.entries(SRC).map(([k, f]) => [k, avg(q.map((p) => f(p.bd)))])), neg: avg(q.map((p) => p.bd.discontent + p.bd.raid + Math.min(0, p.bd.dragon))), negParts: [avg(q.map((p) => p.bd.discontent)), avg(q.map((p) => p.bd.raid)), avg(q.map((p) => Math.min(0, p.bd.dragon)))] }];
  }));
  // 名声の内訳（勝者）
  const W = P.filter((p) => p.win);
  const shares = W.map((p) => {
    const v = Object.fromEntries(Object.entries(SRC).map(([k, f]) => [k, Math.max(0, f(p.bd))]));
    const tot = Object.values(v).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x / tot]));
  });
  res.source = Object.fromEntries(Object.keys(SRC).map((k) => [k, avg(shares.map((s) => s[k]))]));
  res.over40 = avg(shares.map((s) => (Math.max(...Object.values(s)) > 0.4 ? 1 : 0)));
  res.meanScore = avg(P.map((p) => p.score));
  res.winScore = avg(W.map((p) => p.score));
  // カード
  const byCard: Record<string, number[]> = {};
  for (const p of P) for (const c of new Set(p.picked)) (byCard[c] ??= []).push(p.rel);
  const cards = Object.entries(byCard).filter(([, v]) => v.length >= 30).map(([c, v]) => ({ c, n: v.length, d: avg(v) })).sort((a, b) => b.d - a.d);
  res.cards = cards;
  res.cardsOut = cards.filter((x) => Math.abs(x.d) > 3).length;
  res.ms = avg(eq.map((g) => g.ms));
  // 戦闘（同じ腕前の卓）：種類 × 時期（t＜1/3 序盤、＜2/3 中盤、それ以降 終盤）
  const F = eq.flatMap((g) => g.fights);
  const phase = (t: number) => (t < 1 / 3 ? 'early' : t < 2 / 3 ? 'mid' : 'late');
  const fstat = (q: FRec[]) => {
    const f = q.filter((x) => x.mode !== 'skip');
    return { n: f.length / eq.length, skip: q.length ? 1 - f.length / q.length : NaN, win: avg(f.map((x) => (x.win ? 1 : 0))), margin: avg(f.map((x) => x.base - x.str)), addons: avg(f.map((x) => x.addons)), comps: avg(f.map((x) => x.comps)), str: avg(f.map((x) => x.str)) };
  };
  res.fights = Object.fromEntries([
    ...['early', 'mid', 'late'].map((ph) => [`nest/${ph}`, fstat(F.filter((x) => x.kind === 'nest' && phase(x.t) === ph))]),
    ['nest/all', fstat(F.filter((x) => x.kind === 'nest'))],
    ...['early', 'mid', 'late'].map((ph) => [`boss/${ph}`, fstat(F.filter((x) => x.kind === 'boss' && phase(x.t) === ph))]),
    ['boss/all', fstat(F.filter((x) => x.kind === 'boss'))],
    ['dragon', fstat(F.filter((x) => x.kind === 'dragon'))],
  ]);
  return res;
}

function print(all: Record<string, any>[]) {
  const L = (label: string, f: (r: Record<string, any>) => string) => console.log(label.padEnd(34) + all.map((r) => f(r).padStart(14)).join(''));
  console.log('\n=== 霧谷 v2 シミュレーション（同じ腕前＝全員 strong）===');
  L('年数', (r) => `${r.years}年`);
  L('局数（同じ腕前／ばらばら）', (r) => `${r.games}/${r.mixedGames}`);
  L('平均名声／勝者の名声', (r) => `${f1(r.meanScore)}/${f1(r.winScore)}`);
  L('運の割合（目標0.40前後）', (r) => f2(r.luck));
  L('  参考：運命カードの R²', (r) => f2(r.fateR2));
  L('  腕前ごとの名声差 n/m/s', (r) => `${f1(r.levelMean.novice)}/${f1(r.levelMean.normal)}/${f1(r.levelMean.strong)}`);
  L('回しきれたラウンド（目標7割）', (r) => pct(r.loop));
  L('  数えたラウンド/人', (r) => f1(r.loopRounds));
  L('  冬に食べさせられた', (r) => pct(r.fed));
  L('  広場（余り手）', (r) => pct(r.plaza));
  L('同じ手順の繰り返し（目標3割以下）', (r) => pct(r.repeat));
  L('どれかの入り口が4割超の勝者', (r) => pct(r.over40));
  L('カード：±3名声を超える枚数', (r) => `${r.cardsOut}/${r.cards.length}`);
  L('1局の時間(ms)', (r) => f1(r.ms));
  console.log('\n--- 戦闘（同じ腕前の卓）：勝率 / 戦力−強さ（運命の前） / 後押しの数 / 送った仲間 / 1局の回数 [主・古竜は挑まなかった割合]');
  for (const k of Object.keys(all[0].fights)) L(`  ${k}`, (r) => { const s = r.fights[k]; return `${pct(s.win)} ${f1(s.margin)} ${f1(s.addons)}`; });
  if (process.env.SIM_DETAIL) for (const k of Object.keys(all[0].fights)) L(`  ${k} 仲間/回数/強さ/skip`, (r) => { const s = r.fights[k]; return `${f1(s.comps)}/${f1(s.n)}/${f1(s.str)}/${k.startsWith('nest') ? '-' : pct(s.skip)}`; });
  console.log('\n--- 名声の内訳（勝者の平均。目標：どれも4割以下）');
  for (const k of Object.keys(SRC)) L(`  ${k}`, (r) => pct(r.source[k]));
  console.log('\n--- 強い動きごとの「名声 − 卓の平均」（目標±3以内）[人数]');
  const tags = [...new Set(all.flatMap((r) => Object.keys(r.engine)))].sort();
  for (const t of tags) L(`  ${t}`, (r) => (r.engine[t] ? `${f1(r.engine[t].rel)} [${r.engine[t].n}]` : '-'));
  console.log('\n--- 同じ値を5年換算（÷ 年数/5。長い試合は名声の桁が大きいので、±3 はこの値で見る）');
  for (const t of tags) L(`  ${t}`, (r) => (r.engine[t] ? f1(r.engine[t].rel / (r.years / 5)) : '-'));
  console.log('\n--- 強い動きごとの終わりの仲間の数／倒した数／主・古竜を倒した数／その証');
  for (const t of tags) L(`  ${t}`, (r) => (r.engine[t] ? `${f1(r.engine[t].comps)}/${f1(r.engine[t].kills)}/${f1(r.engine[t].bossWins)}/${f1(r.engine[t].bossTro)}` : '-'));
  if (process.env.SIM_DETAIL) for (const r of all) {
    console.log(`\n--- 強い動きごとの名声の入り口（${r.years}年、平均）: ${[...Object.keys(SRC), 'neg'].join(' / ')}`);
    for (const t of tags) if (r.engine[t]) console.log(`  ${t.padEnd(8)} ${[...Object.keys(SRC).map((k) => f1(r.engine[t].src[k])), f1(r.engine[t].neg)].join(' / ')}  (不満/襲撃/古竜 ${r.engine[t].negParts.map(f1).join('/')})`);
  }
  console.log('\n--- 強い動きごとの「一周」の割合');
  for (const t of tags) L(`  ${t}`, (r) => (r.loopBy[t] !== undefined ? pct(r.loopBy[t]) : '-'));
  for (const r of all) {
    console.log(`\n--- カードの勝ちへの効き（${r.years}年、30局以上、名声 − 卓の平均）上位・下位5枚`);
    const cs = r.cards as { c: string; n: number; d: number }[];
    for (const x of cs.length <= 10 ? cs : [...cs.slice(0, 5), ...cs.slice(-5)]) console.log(`  ${x.c.padEnd(18)} ${f1(x.d).padStart(6)}  (${x.n})`);
  }
}

async function main() {
  const N = Number(env('SIM_N', '200'));
  const years = env('SIM_YEARS', '5,10,15').split(',').map(Number);
  const n = Number(env('SIM_PLAYERS', '4'));
  const jobs = Number(env('SIM_JOBS', '4'));
  const mixedN = Number(env('SIM_MIXED', String(Math.max(20, Math.round(N / 2)))));
  const chunk = Number(env('SIM_CHUNK', '10'));
  const tasks: Task[] = [];
  for (const y of years) {
    for (let s = 0; s < N; s += chunk) tasks.push({ years: y, n, mixed: false, seeds: Array.from({ length: Math.min(chunk, N - s) }, (_, i) => 1000 * y + s + i + 1) });
    for (let s = 0; s < mixedN; s += chunk) tasks.push({ years: y, n, mixed: true, seeds: Array.from({ length: Math.min(chunk, mixedN - s) }, (_, i) => 500000 + 1000 * y + s + i + 1) });
  }
  const t0 = Date.now();
  workerFile = await bundle();
  const recs = await runAll(tasks, jobs);
  rmSync(workerFile, { force: true });
  const all = years.map((y) => summarize(y, recs.filter((g) => g.years === y && !g.mixed), recs.filter((g) => g.years === y && g.mixed)));
  print(all);
  // カードの勝ちへの効きを年数をまたいでまとめる（5年換算の「名声 − 卓の平均」。カードが多いので1つの年数では30局に届かないものがある）
  const byCard: Record<string, number[]> = {};
  for (const g of recs) if (!g.mixed) for (const p of g.players) for (const c of new Set(p.picked)) (byCard[c] ??= []).push(p.rel / (g.years / 5));
  const cardsAll = Object.entries(byCard).filter(([, v]) => v.length >= 30).map(([c, v]) => ({ c, n: v.length, d: avg(v) })).sort((a, b) => b.d - a.d);
  const out = cardsAll.filter((x) => Math.abs(x.d) > 3);
  console.log(`\n--- カードの勝ちへの効き（全年数、5年換算、30局以上）: ±3 を超える ${out.length}/${cardsAll.length} 枚（${Object.keys(byCard).length} 枚が出た）`);
  for (const x of out) console.log(`  ${x.c.padEnd(20)} ${f1(x.d).padStart(6)}  (${x.n})`);
  if (process.env.SIM_CARDS) for (const x of cardsAll) console.log(`  ~ ${x.c.padEnd(20)} ${f1(x.d).padStart(6)}  (${x.n})`);
  console.log(`\n(${n}人、${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
  if (process.env.SIM_CARDS_JSON) writeFileSync(process.env.SIM_CARDS_JSON, JSON.stringify(cardsAll));
  if (process.env.SIM_JSON) writeFileSync(process.env.SIM_JSON, JSON.stringify(all, null, 1));
}

if (process.env.SIM_WORKER) runWorker(); else main().catch((e) => { console.error(e); process.exit(1); });

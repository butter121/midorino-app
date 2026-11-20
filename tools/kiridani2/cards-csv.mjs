// 霧谷の冒険者団 v2 — カード一覧を CSV に書き出す（ローカル LLM の清書用）と、強い動きの入り口の数を表示する。
// 使い方: node tools/kiridani2/cards-csv.mjs [出力先] [--new-only]  （既定 /mnt/project-files/kiridani/engine2/cards-for-llm.csv）
//   --new-only: cards/flavor.ts にフレーバー文がまだ無いカードだけを書き出す（追加分だけ清書してもらうとき）
// 点検そのものは packages/engine/test/kiridani2-cards.test.ts（vitest）。
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const newOnly = args.includes('--new-only');
const out = args.find((a) => !a.startsWith('--')) ?? '/mnt/project-files/kiridani/engine2/cards-for-llm.csv';

const load = async (file) => {
  const res = await build({ entryPoints: [resolve(root, file)], bundle: true, format: 'esm', platform: 'node', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'));
};
const mod = await load('packages/engine/src/kiridani2/cards/index.ts');
const flavor = newOnly ? (await load('packages/engine/src/kiridani2/cards/flavor.ts')).FLAVOR : {};
const keep = (id) => !newOnly || !(id in flavor);

const q = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const rows = [['id', 'kind', 'name', 'engine', 'effect_dsl_json', 'draft_text']];
const cardDsl = (c) => {
  const o = {};
  for (const k of ['cost', 'prereq', 'fame', 'slot', 'two_hand', 'leader_only', 'power', 'guard', 'tome', 'weight', 'place', 'count', 'stage', 'cap', 'accum', 'mods'])
    if (c[k] !== undefined && c[k] !== null && c[k] !== false) o[k] = c[k];
  o.effects = c.effects;
  return o;
};
for (const list of ['LEADERS', 'OCCUPATIONS', 'WEAPONS', 'ARMORS', 'TOOLS', 'SPELLS', 'PETS', 'GEAR', 'STAGES'])
  for (const c of mod[list]) if (keep(c.id)) rows.push([c.id, c.kind, c.name, c.engine.join('|'), JSON.stringify(cardDsl(c)), c.text]);
for (const c of mod.QUESTS) if (keep(c.id)) rows.push([c.id, c.secret ? 'secret_quest' : 'quest', c.name, '', JSON.stringify({ need: c.need, fame: c.fame }), c.text]);
for (const c of mod.ANCIENT) if (keep(c.id)) rows.push([c.id, 'ancient', c.name, 'ruins', JSON.stringify({ group: c.group, copies: c.copies ?? 1 }), c.text]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n');
console.log(`wrote ${rows.length - 1} rows -> ${out}`);

const moves = ['hunt', 'gather', 'trade', 'fort', 'smith', 'family', 'arcane', 'beast', 'quest', 'ally', 'ruins', 'boss'];
const playable = ['LEADERS', 'OCCUPATIONS', 'WEAPONS', 'ARMORS', 'TOOLS', 'SPELLS'].flatMap((k) => mod[k]);
for (const m of moves) {
  const cs = playable.filter((c) => c.engine.includes(m));
  const by = {};
  for (const c of cs) by[c.kind] = (by[c.kind] ?? 0) + 1;
  const st = mod.STAGES.filter((s) => s.engine.includes(m)).length;
  console.log(m.padEnd(7), String(cs.length).padStart(2), JSON.stringify(by), `stages:${st}`);
}

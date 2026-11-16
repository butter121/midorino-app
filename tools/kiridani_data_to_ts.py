"""霧谷の冒険者団：Python 版 data.py を packages/ui/src/kiridani/data.ts に写す。
使い方: python3 tools/kiridani_data_to_ts.py <data.py> packages/ui/src/kiridani/data.ts
(data.py の数値をエンジン側で調整したら、これで TS 側を作り直す)"""
import json, runpy, sys
d = runpy.run_path(sys.argv[1])
def j(x):
    def conv(o):
        if isinstance(o, set): return sorted(o)
        if isinstance(o, dict): return {str(k): conv(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)): return [conv(v) for v in o]
        return o
    return json.dumps(conv(x), ensure_ascii=False)
def arr(lst):
    return '[\n' + ''.join('  ' + j(x) + ',\n' for x in lst) + ']'
out = []
w = out.append
w('''// 霧谷の冒険者団 — ゲームデータ（Python 版 data.py の写し。数値は v0.1 の仮値で、エンジン側の調整に合わせて更新する）
// data.py から機械的に写したもの（tools/kiridani_data_to_ts.py）。id は data.py と完全に同じ（エンジン・絵の差し替えとも id で対応づける）。
/* eslint-disable */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Element = 'fire' | 'ice' | 'thunder' | 'light' | 'dark';
export type Res = 'wood' | 'iron' | 'herb' | 'mana' | 'food' | 'gold' | 'mat';
export type Race = 'beast' | 'spirit' | 'undead' | 'humanoid' | 'dragon';
export type Cost = Partial<Record<Res, number>>;

export interface ActionSpaceDef { id: string; name: string; accum?: Cost; give?: Cost; unlimited?: boolean; from_round?: number; min_p?: number }
export interface MonsterDef { id: string; name: string; year: number; str: number; counter: number; weak: Element | null; race: Race; loot: Cost; trophy: number; raid: number }
export interface CharacterDef { id: string; name: string; role: string; tags: string[] }
export interface OccupationDef { id: string; name: string; kind: 'occ'; tags: string[]; text: string; chars: string[]; quirk: boolean }
export type ItemKind = 'weapon' | 'tool' | 'spell';
export interface ItemDef { id: string; name: string; kind: ItemKind; tags: string[]; cost: Cost; fame: number; text: string; chars: string[]; quirk: boolean; power?: number; el?: Element; defense?: number; ironw?: boolean }
export type CardDef = OccupationDef | ItemDef;

''')
for k in ['NUM_ROUNDS','START_COMPANIONS','MAX_COMPANIONS','START_BEDS','BASE_PLOTS','START_FOOD','START_GOLD','UPKEEP','DISCONTENT','HIRE_FOOD','POWER_PER','MAX_SKILL','WEAKNESS_BONUS','TIDE_BONUS','NEST_CAP','FAME_PER_COMPANION','HERO_BONUS','GOLD_PER_FAME','MARKET_SPAN','MARKET_QTY','DRAGON_FAIL']:
    w(f'export const {k} = {j(d[k])};\n')
w(f"export const SEASONS: Season[] = {j(d['SEASONS'])};\n")
w(f"export const SEASON_JP: Record<Season, string> = {j(d['SEASON_JP'])};\n")
w(f"export const TIDE: Record<Season, Element> = {j(d['TIDE'])};\n")
w(f"export const ELEMENTS: Element[] = {j(d['ELEMENTS'])};\n")
w(f"export const EL_JP: Record<Element, string> = {j(d['EL_JP'])};\n")
w(f"export const RES: Res[] = {j(d['RES'])};\n")
w(f"export const RES_JP: Record<Res, string> = {j(d['RES_JP'])};\n")
w(f"export const SEAT_FOOD: Record<number, number[]> = {j(d['SEAT_FOOD'])};\n")
w(f"export const BED_COST: Cost = {j(d['BED_COST'])};\n")
w(f"export const WALL_COST: Cost = {j(d['WALL_COST'])};\n")
w(f"export const FATE_DECK: number[] = {j(d['FATE_DECK'])};\n")
w(f"export const MARKET_BASE: Cost = {j(d['MARKET_BASE'])};\n")
w(f"export const FIXED_BUY: Cost = {j(d['FIXED_BUY'])};\n")
w("\n// ---- アクションスペース ----\n")
w(f"export const ACTIONS: ActionSpaceDef[] = {arr(d['ACTIONS'])};\n")
w("export const ACT: Record<string, ActionSpaceDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));\n")
w(f"export const MARKETS = new Set({j(sorted(d['MARKETS']))});\n")
w(f"export const NESTS: Record<number, string[]> = {j(d['NESTS'])};\n")
w(f"export const NEST_JP: Record<string, string> = {j(d['NEST_JP'])};\n")
w("\n// ---- 魔物（各年10種） ----\n")
w(f"export const MONSTERS: MonsterDef[] = {arr(d['MONSTERS'])};\n")
w("export const MON: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));\n")
w("\n// ---- 主（ラウンド4・8は2候補から1体、12は古竜） ----\n")
w("export const BOSSES: Record<number, MonsterDef[]> = {\n" + ''.join(f"  {r}: {arr(v).replace(chr(10), chr(10)+'  ')},\n" for r, v in d['BOSSES'].items()) + "};\n")
w("export const BOSS: Record<string, MonsterDef> = Object.fromEntries(Object.values(BOSSES).flat().map((m) => [m.id, m]));\n")
w("\n// ---- 天候（各季節6枚） ----\n")
w(f"export const WEATHER: Record<Season, string[]> = {j(d['WEATHER'])};\n")
w(f"export const WEATHER_JP: Record<string, string> = {j(d['WEATHER_JP'])};\n")
w(f"export const WEATHER_EL: Record<string, [Element, number]> = {j(d['WEATHER_EL'])};\n")
w("\n// ---- キャラクター12人 ----\n")
chars = [dict(id=k, **v) for k, v in d['CHARACTERS'].items()]
w(f"export const CHARACTERS: CharacterDef[] = {arr(chars)};\n")
w("export const CHAR: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));\n")
w("\n// ---- 職能カード30種 ----\n")
w(f"export const OCCUPATIONS: OccupationDef[] = {arr(d['OCCUPATIONS'])};\n")
w("\n// ---- 品物カード30種（武具・道具・秘術） ----\n")
w(f"export const ITEMS: ItemDef[] = {arr(d['ITEMS'])};\n")
w("export const CARDS: Record<string, CardDef> = Object.fromEntries([...OCCUPATIONS, ...ITEMS].map((c) => [c.id, c]));\n")
w("export const OCC_IDS = OCCUPATIONS.map((c) => c.id);\nexport const ITEM_IDS = ITEMS.map((c) => c.id);\n")
w("\n// ---- 共通の依頼（15種から3枚） ----\n")
w(f"export const QUESTS: Record<string, string> = {j(d['QUESTS'])};\n")
w(f"export const QUEST_FAME: number[] = {j(d['QUEST_FAME'])};\n")
w('''
// ---- 表示用の補助 ----
export const RACE_JP: Record<Race, string> = { beast: '獣', spirit: '精霊', undead: '亡者', humanoid: '人型', dragon: '竜' };
export const KIND_JP: Record<'occ' | ItemKind, string> = { occ: '職能', weapon: '武具', tool: '道具', spell: '秘術' };
/** 1年＝4ラウンド（春夏秋冬が1ラウンドずつ）。3年で12ラウンド */\nexport const seasonOf = (round: number): Season => SEASONS[(round - 1) % 4];
export const yearOf = (round: number): number => Math.floor((round - 1) / 4) + 1;
/** 主の出るラウンド（各年の冬の終わり） */
export const BOSS_ROUNDS = Object.keys(BOSSES).map(Number);
''')
open(sys.argv[2], 'w').write(''.join(out))

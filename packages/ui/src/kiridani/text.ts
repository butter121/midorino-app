// 画面に出す説明文（設計書の表から）。data.py に無い表示専用の文言だけを置く
import type { Element } from './data';

export const CHAR_TEXT: Record<string, string> = {
  toma: '木材を取るたび+1。木材1を「矢」として使うと戦力+1（1戦闘2本まで）',
  mina: '魔石の泉から取るたび魔石+1。秘術の魔石コスト-1（各ラウンド1回）',
  gan: '開始時に鉄2。武具の費用を合計2少なく払える',
  leo: '市場で売値＝相場、買値＝相場-1。魔物素材を売ると金貨+1',
  haru: '獣の魔物を倒す代わりに「使い魔」にできる（食料3、以後戦力+2、最大2体）',
  sana: '薬草を取るたび+1。薬草1でいつでも負傷を回復、薬草2でポーション（戦力+2）',
  yuki: '天候と魔物を2ラウンド先まで見る。運命カードを2枚めくって選べる（各年2回）',
  goro: '防御+2。防壁の木材が1少なくて済む。自分の拠点への襲撃-1',
  aya: '取引の提案を2回まで。取引成立ごと金貨+1。共闘相手の戦力にも+1',
  momo: '冬の維持費-1。食料1で士気+1を1戦闘2回まで（ふつうは1回）',
  riku: '同じラウンドに2回目の戦闘をすると戦力+2。倒した魔物の素材+1',
  nana: '最初の募集は寝床不要。仲間を雇うたび食料+1。光属性で攻めると+1',
};

export const TAG_JP: Record<string, string> = {
  fire: '炎', ice: '氷', thunder: '雷', light: '光', dark: '闇', front: '前衛', rear: '後衛', support: '支援',
  wood: '木', iron: '鉄', herb: '草', mana: '魔', food: '食', gold: '金', mat: '素材', trade: '交易', fate: '運命',
  weather: '天候', wall: '防壁', trap: '罠', chain: '連戦', companion: '仲間', coop: '共闘', convert: '素材変換',
  beast: '獣', morale: '士気', dragon: '竜',
};

export const SPACE_TEXT: Record<string, string> = {
  board: '金貨2', guild: '職能を1枚出す', forge: '武具を1枚出す', workshop: '道具を出す／寝床・防壁', market: '相場で売買',
  plaza: '食料1（何人でも）', tavern: '仲間を1人雇う', training: '熟練+1', ruins: '品物2枚から1枚', market2: '相場で売買',
  peddler: '金貨1・食料1', outpost: '食料1・金貨1',
};

export const ELEMENT_ORDER: Element[] = ['fire', 'ice', 'thunder', 'light', 'dark'];

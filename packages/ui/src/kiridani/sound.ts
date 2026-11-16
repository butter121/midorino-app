// 効果音（SE）と BGM の再生口。音のファイルはまだ無いので、見つからなければ黙って何もしない。
// ファイルを置く場所：<base>/se/<cue>.mp3 と <base>/bgm/<cue>.mp3（base の既定は './sounds'）。
// 候補の無料素材とライセンスは src/kiridani/README.md を参照。
import type { GameEvent, Seat } from './types';
import type { Element } from './data';

export const SE_CUES = [
  'ui_tap', 'ui_queue', 'card_deal', 'card_pick', 'card_flip', 'card_play', 'char_pick',
  'place', 'gather', 'coin', 'pay', 'forge', 'build', 'hire', 'train', 'market', 'spell',
  'combat_start', 'power_up', 'weakness', 'fate_flip', 'fate_gold', 'fate_crack',
  'slash', 'fire', 'ice', 'thunder', 'light', 'dark', 'miss', 'counter', 'injury', 'heal',
  'loot', 'trophy', 'monster_spawn', 'refill', 'produce', 'raid', 'wall_block', 'upkeep', 'discontent',
  'weather', 'season', 'boss_roar', 'quest', 'fame', 'first_pass', 'score_tick', 'rank', 'victory',
] as const;
export const BGM_CUES = ['title', 'draft', 'spring', 'summer', 'autumn', 'winter', 'boss', 'final'] as const;
export type SeCue = (typeof SE_CUES)[number];
export type BgmCue = (typeof BGM_CUES)[number];

const EL_CUE: Record<Element, SeCue> = { fire: 'fire', ice: 'ice', thunder: 'thunder', light: 'light', dark: 'dark' };

/** 出来事ごとの効果音（自分以外の細かい音は鳴らさない） */
export function cuesFor(ev: GameEvent, me: Seat): SeCue[] {
  const mine = !('seat' in ev) || ev.seat === me || me < 0;
  switch (ev.t) {
    case 'draft_offer': case 'char_offer': return ['card_deal'];
    case 'draft_pick': return mine ? ['card_pick'] : [];
    case 'char_pick': return mine ? ['char_pick'] : [];
    case 'round_start': return ['season'];
    case 'weather': return ['weather'];
    case 'monster_spawn': return ['monster_spawn'];
    case 'refill': return ['refill'];
    case 'place': return ['place'];
    case 'gather': return mine ? ['gather'] : [];
    case 'pay': return mine ? ['pay'] : [];
    case 'play_card': return ['card_play'];
    case 'spell': return ['spell'];
    case 'build': return ['build'];
    case 'hire': return ['hire'];
    case 'train': return ['train'];
    case 'market': return ['market', 'coin'];
    case 'draw': return ['card_flip'];
    case 'combat_start': return ev.boss ? ['boss_roar'] : ['combat_start'];
    case 'power': return ev.parts.some((x) => x.kind === 'weakness') ? ['power_up', 'weakness'] : ['power_up'];
    case 'fate_flip': return [ev.value >= 2 ? 'fate_gold' : ev.value < 0 ? 'fate_crack' : 'fate_flip'];
    case 'clash': return ev.result === 'win' ? [ev.el ? EL_CUE[ev.el] : 'slash'] : ['miss'];
    case 'hit': return ['slash'];
    case 'counter': return ['counter'];
    case 'injury': return ['injury'];
    case 'heal': case 'recover': return mine ? ['heal'] : [];
    case 'loot': return ['loot'];
    case 'trophy': return ['trophy'];
    case 'grant': return mine ? ['gather'] : [];
    case 'produce': return mine ? ['produce'] : [];
    case 'upkeep': return ev.discontent ? ['discontent'] : mine ? ['upkeep'] : [];
    case 'raid': return [ev.damage > 0 ? 'raid' : 'wall_block'];
    case 'boss_appear': return ['boss_roar'];
    case 'quest_done': return ['quest'];
    case 'fame': return mine ? ['fame'] : [];
    case 'first_pass': return ['first_pass'];
    case 'score': return ['score_tick'];
    case 'game_end': return ['victory'];
    case 'familiar': return ['loot'];
    case 'trap': return ['build'];
    case 'trade': return ['coin'];
    case 'discard': return ['card_flip'];
    case 'recall': return mine ? ['heal'] : [];
    case 'weather_set': return ['weather'];
    case 'wait': return ['place'];
    default: return [];
  }
}

/** 出来事で BGM を替える（undefined なら今のまま） */
export function bgmFor(ev: GameEvent): BgmCue | undefined {
  switch (ev.t) {
    case 'game_start': return 'title';
    case 'draft_offer': return 'draft';
    case 'round_start': return ev.season;
    case 'boss_appear': return 'boss';
    case 'score': return 'final';
    default: return undefined;
  }
}

export interface SoundOptions { base?: string; ext?: string; se?: number; bgm?: number; muted?: boolean }

/** 名前で鳴らす。ファイルが無い・自動再生が止められた等はすべて無音で続ける */
export class SoundPlayer {
  base: string; ext: string;
  seVolume: number; bgmVolume: number; muted: boolean;
  private missing = new Set<string>();
  private cache = new Map<string, HTMLAudioElement>();
  private bgmEl: HTMLAudioElement | null = null;
  private bgmCue: BgmCue | null = null;
  /** 鳴らそうとした記録（デバッグ・カタログ表示用） */
  readonly history: string[] = [];
  onCue?: (cue: string) => void;

  constructor(o: SoundOptions = {}) {
    this.base = o.base ?? './sounds'; this.ext = o.ext ?? 'mp3';
    this.seVolume = o.se ?? 0.8; this.bgmVolume = o.bgm ?? 0.4; this.muted = o.muted ?? false;
  }

  private get canPlay() { return typeof Audio !== 'undefined'; }

  private load(kind: 'se' | 'bgm', cue: string): HTMLAudioElement | null {
    const key = `${kind}/${cue}`;
    if (this.missing.has(key) || !this.canPlay) return null;
    let a = this.cache.get(key);
    if (!a) {
      a = new Audio(`${this.base}/${key}.${this.ext}`);
      a.preload = 'auto';
      a.addEventListener('error', () => { this.missing.add(key); this.cache.delete(key); }, { once: true });
      this.cache.set(key, a);
    }
    return a;
  }

  play(cue: SeCue) {
    this.history.push(cue); if (this.history.length > 50) this.history.shift();
    this.onCue?.(cue);
    if (this.muted) return;
    const a = this.load('se', cue);
    if (!a) return;
    try {
      const n = a.cloneNode(true) as HTMLAudioElement;
      n.volume = this.seVolume;
      n.play().catch(() => {});
    } catch { /* 無音で続ける */ }
  }

  bgm(cue: BgmCue | null) {
    if (cue === this.bgmCue) return;
    this.bgmCue = cue;
    if (this.bgmEl) { try { this.bgmEl.pause(); } catch { /* */ } this.bgmEl = null; }
    if (!cue || this.muted) return;
    const a = this.load('bgm', cue);
    if (!a) return;
    a.loop = true; a.volume = this.bgmVolume;
    this.bgmEl = a;
    a.play().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m && this.bgmEl) { try { this.bgmEl.pause(); } catch { /* */ } }
    else if (!m) { const c = this.bgmCue; this.bgmCue = null; this.bgm(c); }
  }

  /** 出来事に合わせて鳴らす */
  event(ev: GameEvent, me: Seat) {
    const b = bgmFor(ev);
    if (b) this.bgm(b);
    for (const c of cuesFor(ev, me)) this.play(c);
  }
}

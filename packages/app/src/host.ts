// 1台で遊ぶときの「ホスト」。審判の状態を持ち、端末に保存する。
// オンライン版では、同じ役割をホスト端末が担い、各席への view を通信で送る。
import { createMatch, handle, viewFor, type Command, type MatchState, type MatchView, type Result, type Seat } from '@midorino/engine';

const KEY = 'midorino.local.match';

export class LocalHost {
  m: MatchState;
  constructor(m: MatchState) { this.m = m; }
  static create(seats: Seat[]) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const h = new LocalHost(createMatch(seats, buf[0]));
    h.save();
    return h;
  }
  static load(): LocalHost | null {
    try {
      const s = localStorage.getItem(KEY);
      return s ? new LocalHost(JSON.parse(s)) : null;
    } catch { return null; }
  }
  static clear() { try { localStorage.removeItem(KEY); } catch { /* 保存できない環境 */ } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.m)); } catch { /* 保存できない環境 */ } }
  send(pid: number, cmd: Command): Result {
    const r = handle(this.m, pid, cmd);
    if (r.ok) this.save();
    return r;
  }
  view(pid: number): MatchView { return viewFor(this.m, pid); }
}

"""AIプレイヤー：ヒューリスティック評価＋1手先読み（貪欲）。腕前はノイズ量で表す。
巣の手は k∈{1,2} × 方針(safe/gamble/chip/wait) を列挙し、残りの運命カードで期待値を取る。"""
import math
import random
from data import *
from engine import (score, Game, MON, is_beast, is_dark, can_pay, RES_VAL, WEAPON_POWER, BASIC)

DEFAULT_W = dict(
    act=1.3,        # 将来の1アクション
    wood=0.35, iron=0.5, herb=0.4, mana=0.65, food=0.4, gold=0.18, mat=0.5,
    short=2.2,      # 冬の食料不足1あたり
    perm=0.30,      # 永続戦力1あたり（残りラウンド/4 倍）
    defn=0.12,      # 防御1あたり（同上）
    bed=0.45,       # 空き寝床（×(仲間の価値)）
    wall=0.9,       # 襲撃軽減1 × 残りの冬
    hand=0.45,      # 手札のカード評価
    played=5.0,     # 出したカードの評価 × 残り比率
    inj=0.8,        # 負傷者
    ready=0.45,     # 見えている魔物を倒せる見込み
    threat=0.25,    # 残っている魔物の襲撃値
    quest=0.6,      # 依頼の進捗
    wait=0.3,       # 待ち伏せの加点
    join=0.3,       # 共闘に加わる加点
    pet=0.6,        # 使い魔（戦力とは別の加点）
    tag={},         # ドラフトでの得意キーワード加点
)

ARCHETYPES = {
    'melee': dict(perm=0.36, iron=0.58, defn=0.15, tag={'front': 0.6, 'iron': 0.4, 'chain': 0.4}),
    'magic': dict(mana=0.78, tag={'mana': 0.6, 'fire': 0.3, 'ice': 0.3, 'thunder': 0.3, 'dark': 0.2, 'light': 0.2}),
    'beast': dict(food=0.55, pet=1.4, tag={'beast': 0.9, 'food': 0.3}),
    'fortress': dict(wall=1.15, wood=0.42, tag={'wall': 0.8, 'wood': 0.3, 'herb': 0.2}),
    'trader': dict(gold=0.2, mat=0.5, tag={'trade': 0.5, 'gold': 0.4}),
    'coop': dict(wait=0.6, join=0.6, tag={'coop': 0.9, 'support': 0.5}),
}
ARCH_CHARS = {'melee': {'gan', 'riku', 'goro'}, 'magic': {'mina', 'yuki'}, 'beast': {'haru', 'momo'},
              'fortress': {'goro', 'toma'}, 'trader': {'leo', 'aya'}, 'coop': {'aya', 'nana', 'sana'}}

from data import CHAR_RATING


def rating(c):
    return RATING.get(c, 1.0)


def winters_left(g, inclusive=True):
    return sum(1 for w in WINTER_ROUNDS if (w >= g.round if inclusive else w > g.round))


def perm_power(g, p):
    pw = sum(sorted(p.skills, reverse=True)[:2]) + sum(WEAPON_POWER.get(w, 0) for w in p.weapons)
    pw += p.pets * (3 if 'o07' in p.occs else 2) + (p.pets if 'i08' in p.weapons else 0)
    o = p.occs
    pw += 3 * ('o11' in o) + 5 * ('o26' in o) + 4 * ('o28' in o and p.comps <= 3) + 1 * ('i13' in p.tools)
    pw += 1.5 * ('o17' in o) + 1.5 * ('o22' in o) + 0.8 * ('o30' in o) + 0.5 * ('o16' in o)
    return pw


def boost_potential(g, p):
    tot = 0
    els = set()
    used = {}
    for nm, pw, c, el, card in g.boost_list(p, MON['rat'], False):
        t = dict(used)
        for r, n in c.items():
            t[r] = t.get(r, 0) + n
        if can_pay(p, t):
            used = t
            tot += pw
            if el:
                els.add(el)
    return tot, els


def evaluate(g, p, W):
    r = g.round
    rl = NUM_ROUNDS - r
    prog = r / NUM_ROUNDS
    dec = min(1.0, (rl + 1) / 4.0)
    v = score(p)
    res = p.res
    # 英雄ボーナスの見込み
    others = max(q.trophies for q in g.players if q is not p) if g.n > 1 else 0
    lead = p.trophies - others
    v += HERO_BONUS * (1 / (1 + math.exp(-lead / 2.0))) * (0.2 + 0.8 * prog)
    v += (res['gold'] % GOLD_PER_FAME) * 0.2 * (1 - dec) + W['gold'] * res['gold'] * dec
    for k in ('wood', 'iron', 'herb', 'mana', 'mat'):
        v += W[k] * min(res[k], 8) * dec + 0.1 * max(0, res[k] - 8) * dec
    # 将来アクション
    v += W['act'] * (p.avail() + rl * (p.comps - 0.3 * len(p.injured)))
    v -= W['inj'] * len(p.injured)
    # 食料
    wl = winters_left(g, inclusive=True)
    if wl:
        nxt_w0 = min(w for w in WINTER_ROUNDS if w >= r)
        ww = g.weather[nxt_w0 - 1] if nxt_w0 - r < g.forecast(p) + 1 else 'calm'
        up = g.upkeep(p, ww)
        need_all = up * wl
        f = res['food'] + (res['herb'] // 2 * 3 if 'o08' in p.occs else 0)
        nxt_w = min(w for w in WINTER_ROUNDS if w >= r)
        urg = min(2.0, max(0.4, 2.0 / (1 + nxt_w - r)))
        short_next = max(0, up - f)
        v -= W['short'] * short_next * urg
        v -= 0.25 * W['short'] * max(0, need_all - f - short_next)
        v += 0.15 * min(max(0, f - need_all), 4)
    # 戦力
    v += W['perm'] * perm_power(g, p) * rl / 4.0
    v += W['defn'] * g.defense(p, 2) * rl / 4.0
    v += W['pet'] * p.pets * rl / 12.0
    if 'i27' in p.tools and p.egg < 3:
        v += 1.5 * (p.egg + 1) - (0 if res['food'] >= 2 else 1.0)
    if p.comps < MAX_COMPANIONS and rl >= 2 and (p.comps < p.bed_cap() or (NANA_FREE_BED and p.char == 'nana' and 'nana_bed' not in p.st)):
        v += W['bed'] * (FAME_PER_COMPANION + W['act'] * (rl - 1) - UPKEEP * winters_left(g, False) * 0.4)
    elif p.comps < MAX_COMPANIONS and rl >= 3:
        v += 0.3 * W['bed'] * min(1.0, p.res['wood'] / 3) * (FAME_PER_COMPANION + W['act'] * (rl - 2))
    # 防壁
    wl_after = winters_left(g, inclusive=False) + (1 if r in WINTER_ROUNDS else 0)
    if wl_after:
        red = 6 - g.raid_damage(p, 6) + (0.5 if p.walls % RAID_WALLS and 'o13' not in p.occs else 0)
        v += W['wall'] * min(red, 4) * wl_after
    # カード
    tw = W['tag']
    v += W['hand'] * sum(rating(c) + sum(tw.get(t, 0) for t in CARDS[c]['tags']) * 0.5 for c in p.hand) * min(1.0, rl / 6)
    v += W['played'] * sum(rating(c) + sum(tw.get(t, 0) for t in CARDS[c]['tags']) * 0.5 for c in p.occs + p.tools + p.weapons) * rl / 12
    # 魔物への備え
    if rl >= 0:
        base2 = 2 * POWER_PER + perm_power(g, p)
        bp, bels = boost_potential(g, p)
        best = []
        mons = [nd['mon'] for nd in g.nests.values() if nd['mon']] + g.visible_spawns(p)[:3]
        for mid in mons:
            m = MON[mid]
            els = bels | {e for e in (g.weapon_els(p))}
            margin = base2 + bp + g.elem_bonus(p, m, els) - m['str']
            best.append(m['trophy'] * min(1.0, max(0.0, (margin + 3) / 5.0)))
        best.sort(reverse=True)
        v += W['ready'] * sum(best[:2]) * min(1.0, rl / 2 + 0.5)
        threat = sum(MON[nd['mon']]['raid'] for nd in g.nests.values() if nd['mon']) + 2 * RAID_FROM_DECK
        v -= W['threat'] * max(0, g.raid_damage(p, threat)) * (1 if wl else 0)
    # 依頼
    for q in g.quests:
        d = g.quest_done[q]
        if p.pid in d or len(d) >= 3:
            continue
        v += W['quest'] * QUEST_FAME[len(d)] * quest_prog(g, p, q) * 0.5
    return v


def quest_prog(g, p, q):
    s = p.st
    f = {
        'q_kill4': s['kills'] / 4, 'q_beast2': s['beast'] / 2, 'q_undead2': s['undead'] / 2, 'q_boss': 0,
        'q_comp4': (p.comps - 2) / 2, 'q_fac3': len(p.tools) / 3, 'q_wall3': p.walls / 3, 'q_weap3': len(p.weapons) / 3,
        'q_occ3': len(p.occs) / 3, 'q_spell2': s['spells'] / 2, 'q_weak3': s['weak'] / 3,
        'q_gold10': p.res['gold'] / 10, 'q_coop2': s['coop'] / 2, 'q_mat6': p.res['mat'] / 6, 'q_skill3': sum(p.skills) / 3,
    }[q]
    return min(1.0, max(0.0, f)) ** 2


def _weapon_els(self, p):
    from engine import WEAPON_EL
    return {WEAPON_EL[w] for w in p.weapons if w in WEAPON_EL}


Game.weapon_els = _weapon_els


class AI:
    def __init__(self, level='mid', W=None, seed=None, trade=True, arch=None):
        self.level = level
        self.W = dict(DEFAULT_W)
        self.arch = arch
        if arch:
            self.W.update(ARCHETYPES[arch])
        if W:
            self.W.update(W)
        self.rng = random.Random(seed)
        self.noise = dict(random=None, novice=1.5, mid=0.6, expert=0.1)[level]
        self.trade_on = trade and level != 'random'
        self.close = 0
        self.nd = 0

    # ---------------------------------------------------------- 1手の価値
    def option_value(self, g, p, sid, opt):
        W = self.W
        if sid.startswith('nest'):
            return self.nest_value(g, p, sid, opt)
        g2 = g.clone_for(p.pid)
        p2 = g2.players[p.pid]
        if sid == 'lair':
            g2.apply(p2, sid, opt)
            return evaluate(g2, p2, W) + self.lair_bonus(g, p, g2, p2)
        g2.apply(p2, sid, opt)
        g2.check_quests(p2)
        return evaluate(g2, p2, W)

    def nest_value(self, g, p, nid, opt):
        k, mode, how = opt
        nd = g.nests[nid]
        extra = (nd['wait']['pid'],) if nd.get('wait') else ()
        if nd.get('trapper') is not None:
            extra = extra + (nd['trapper'],)
        dist = g.fate_dist(p)
        vals = sorted(dist)
        # まず最小値で試し、勝敗の境目を調べる
        out = 0.0
        g2 = g.clone_for(p.pid, extra)
        p2 = g2.players[p.pid]
        if mode == 'wait':
            g2.apply(p2, nid, opt)
            w = g2.nests[nid]['wait']
            g2.nests[nid]['wait'] = None
            base_g = g2
            def run(fv):
                g3 = base_g.clone_for(p.pid, extra)
                p3 = g3.players[p.pid]
                g3.resolve(p3, nid, w['plan'], None, fv)
                g3.check_quests(p3)
                return evaluate(g3, p3, self.W), g3.last_need
            bonus = self.W['wait']
        else:
            def run(fv):
                g3 = g.clone_for(p.pid, extra)
                p3 = g3.players[p.pid]
                g3.apply(p3, nid, opt, fate=fv)
                g3.check_quests(p3)
                return evaluate(g3, p3, self.W), g3.last_need
            bonus = self.W['join'] if extra else 0.0
        v_lo, need = run(vals[0])
        win_vals = [x for x in vals if x >= need]
        pw = sum(dist[x] for x in win_vals)
        if vals[0] >= need:
            return v_lo + bonus
        if not win_vals:
            return v_lo + bonus
        v_hi, _ = run(win_vals[0])
        return pw * v_hi + (1 - pw) * v_lo + bonus

    def lair_bonus(self, g, p, g2, p2):
        m = g.bosses[g.round]
        pool = sum(e['plan']['power'] for e in g.lair)
        mine = g2.lair[-1]['plan']['power']
        joined = {e['pid'] for e in g.lair} | {p.pid}
        exp_more = 0.0
        for q in g.players:
            if q.pid in joined:
                continue
            if q.avail() > 0:
                exp_more += min(q.avail(), 2) / 2 * 0.75 * (2 * POWER_PER + perm_power(g, q)) * (1.0 if g.round == 12 else 0.6)
        n_part = len(joined)
        def pwin(pw, n):
            mu = pw + 0.5 * n
            sd = math.sqrt(0.9 * max(1, n)) + 1.5
            z = (mu - m['str'] + 0.5) / sd
            return 0.5 * (1 + math.erf(z / math.sqrt(2)))
        others_n = n_part - 1 + (exp_more > 0) * 1
        p_with = pwin(pool + mine + exp_more, n_part + (1 if exp_more else 0))
        p_wo = pwin(pool + exp_more, others_n)
        if g.round == 12:
            vwin = DRAGON_JOIN_FAME + (8 if 'o26' in p.occs else 0) + (O17_DRAGON_FAME if 'o17' in p.occs else 0) / max(p_with, 0.1) * 0
            v = p_with * vwin + (p_with - p_wo) * DRAGON_FAIL + (O17_DRAGON_FAME if 'o17' in p.occs else 0)
        else:
            share = m['trophy'] if mine >= max([e['plan']['power'] for e in g.lair] + [0]) else m['trophy'] * BOSS_SHARE
            vwin = share + 1.2 + (I26_BOSS_FAME if 'i26' in p.weapons else 0)
            v = p_with * vwin + (p_with - p_wo) * 0.5 * g.raid_damage(p, m['raid'])
        return v

    # ---------------------------------------------------------- 手の選択
    def choose(self, g, p, opts):
        if self.level == 'random':
            return self.rng.choice(opts)
        vals = []
        for sid, opt in opts:
            vals.append(self.option_value(g, p, sid, opt))
        if len(vals) >= 2:
            s = sorted(vals, reverse=True)
            g.close_calls += (s[0] - s[1] < 0.5)
        best, bv = None, -1e9
        for o, v in zip(opts, vals):
            v2 = v + self.rng.gauss(0, self.noise)
            if v2 > bv:
                best, bv = o, v2
        return best

    # ---------------------------------------------------------- 小さな判断
    def want_tame(self, g, p, m):
        return g.round <= 10

    def sana_heal(self, g, p):
        return True

    def tan_hide(self, g, p):
        return True

    def use_hourglass(self, g, p):
        return True

    def want_storm(self, g, p, nr):
        return True

    def weather_choice(self, g, p):
        nr = g.round + 1
        s = g.season(nr)
        els = g.weapon_els(p) | {'fire' if 'i19' in p.hand or 'o01' in p.occs else None, 'dark' if 'o19' in p.occs else None}
        for wid, (el, _) in WEATHER_EL.items():
            if el in els and wid in WEATHER[s] and g.weather[g.round] != wid:
                return wid
        return None

    # ---------------------------------------------------------- ドラフト
    def card_score(self, g, p, c, chars=None):
        card = CARDS[c]
        chars = chars if chars is not None else ([p.char] if p.char else p.char_opts)
        s = rating(c)
        tw = self.W['tag']
        s += sum(tw.get(t, 0) for t in card['tags'])
        syn = 0
        for ch in chars:
            sy = (0.8 if ch in card['chars'] else 0) + 0.15 * len(card['tags'] & CHARACTERS[ch]['tags'])
            syn = max(syn, sy)
        s += syn
        # 手札との相性（キーワードの重なり）
        hand_tags = {}
        for h in p.hand:
            for t in CARDS[h]['tags']:
                hand_tags[t] = hand_tags.get(t, 0) + 1
        s += 0.08 * sum(hand_tags.get(t, 0) for t in card['tags'])
        return s

    def draft_pick(self, g, p, cards, kind, ingame=False):
        if self.level == 'random':
            return self.rng.choice(cards)
        noise = self.noise * 0.6
        return max(cards, key=lambda c: self.card_score(g, p, c) + self.rng.gauss(0, noise))

    def pick_character(self, g, p, options):
        if len(options) == 1 or self.level == 'random':
            return self.rng.choice(options)
        def cs(ch):
            s = CHAR_RATING.get(ch, 0.0)
            for c in p.hand:
                card = CARDS[c]
                s += (0.8 if ch in card['chars'] else 0) + 0.15 * len(card['tags'] & CHARACTERS[ch]['tags'])
            if self.arch and ch in ARCH_CHARS[self.arch]:
                s += 1.0
            return s + self.rng.gauss(0, self.noise)
        return max(options, key=cs)

    # ---------------------------------------------------------- 取引
    def marginals(self, g, p):
        base = evaluate(g, p, self.W)
        mp, mm = {}, {}
        for r in BASIC:
            p.res[r] += 1
            mp[r] = evaluate(g, p, self.W) - base
            p.res[r] -= 1
            if p.res[r] > 0:
                p.res[r] -= 1
                mm[r] = base - evaluate(g, p, self.W)
                p.res[r] += 1
        return mp, mm

    def trade_gain(self, g, p, give, get):
        g2 = g.clone_for(p.pid)
        q = g2.players[p.pid]
        base = evaluate(g, p, self.W)
        for r, n in give.items():
            q.res[r] -= n
        for r, n in get.items():
            q.res[r] += n
        if any(v < 0 for v in q.res.values()):
            return -99
        return evaluate(g2, q, self.W) - base

    def accept(self, g, p, give, get):
        if not self.trade_on:
            return False
        thr = 0.3 if self.level == 'expert' else 0.0
        return self.trade_gain(g, p, give, get) + self.rng.gauss(0, (self.noise or 0) * 0.3) > thr

    def trade_phase(self, g, p):
        if not self.trade_on or p.used or p.extra < 0:
            return
        if ('traded', g.round) in p.once:
            return
        p.once.add(('traded', g.round))
        tries = 1 + (1 if p.char == 'aya' else 0) + (1 if 'i15' in p.tools else 0)
        mp, mm = self.marginals(g, p)
        cand = []
        for o in g.players:
            if o is p or not hasattr(o.ai, 'marginals'):
                continue
            omp, omm = o.ai.marginals(g, o)
            for x in mm:
                for y in omm:
                    if x == y:
                        continue
                    for nx, ny in ((1, 1), (2, 1), (1, 2)):
                        if p.res[x] < nx or o.res[y] < ny:
                            continue
                        mine = ny * mp[y] - nx * mm[x]
                        theirs = nx * omp[x] - ny * omm[y]
                        if mine > 0.4 and theirs > 0.2:
                            cand.append((mine, o, {x: nx}, {y: ny}))
        cand.sort(key=lambda c: -c[0])
        done = 0
        for mine, o, give, get in cand[:4]:
            if done >= tries:
                break
            (x, nx), = give.items()
            (y, ny), = get.items()
            if p.res[x] < nx or o.res[y] < ny:
                continue
            if self.trade_gain(g, p, give, get) <= 0.3:
                continue
            if o.ai.accept(g, o, get, give):
                g.trade(p, o, give, get)
                done += 1

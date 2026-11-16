"""霧谷の冒険者団 - ルールエンジン（UIなし。アプリへ移植する前提の素のPython）"""
import random
from data import *

BASIC = ('wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat')
RES_VAL = dict(wood=0.4, iron=0.6, herb=0.45, mana=0.9, food=0.55, gold=0.3, mat=0.6)  # 支払い比較用
WEAPON_POWER = {c['id']: c.get('power', 0) for c in ITEMS if c['kind'] == 'weapon'}
WEAPON_EL = {c['id']: c.get('el') for c in ITEMS if c['kind'] == 'weapon' and c.get('el')}
WEAPON_DEF = {c['id']: c.get('defense', 0) for c in ITEMS if c['kind'] == 'weapon'}
REAR_CARDS = {'o01', 'o02', 'o14', 'o30', 'i01'}
ALL_NESTS = ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount', 'nest_fog']


def is_dark(m):
    return m['race'] == 'undead' or m['weak'] == 'light'


def is_beast(m):
    return m['race'] == 'beast'


class Player:
    __slots__ = ('pid', 'char', 'ai', 'res', 'skills', 'used', 'rest', 'injured', 'extra', 'beds', 'walls',
                 'tools', 'weapons', 'occs', 'hand', 'pets', 'trophies', 'quest_fame', 'card_fame',
                 'discontent', 'unpaid', 'st', 'yearly', 'once', 'fate', 'fights', 'egg', 'stats',
                 'char_opts', 'mana_round', 'kills_log', 'drafted')

    def __init__(self, pid, ai):
        self.pid, self.ai, self.char = pid, ai, None
        self.res = {r: 0 for r in BASIC}
        self.skills = [0] * START_COMPANIONS
        self.used, self.rest, self.injured = set(), set(), set()
        self.extra = 0
        self.beds, self.walls = START_BEDS, 0
        self.tools, self.weapons, self.occs, self.hand = [], [], [], []
        self.pets = 0
        self.trophies = self.quest_fame = self.card_fame = 0
        self.discontent = self.unpaid = 0
        self.st = dict(kills=0, beast=0, undead=0, boss=0, spells=0, weak=0, coop=0, hires=0)
        self.yearly, self.once = set(), set()
        self.fate = list(FATE_DECK)
        self.fights = 0
        self.egg = 0
        self.stats = {}
        self.char_opts = []
        self.mana_round = 0
        self.kills_log = []
        self.drafted = []

    def clone(self):
        q = Player.__new__(Player)
        for s in Player.__slots__:
            setattr(q, s, getattr(self, s))
        q.res = dict(self.res)
        q.skills = list(self.skills)
        q.used, q.rest, q.injured = set(self.used), set(self.rest), set(self.injured)
        q.tools, q.weapons, q.occs, q.hand = list(self.tools), list(self.weapons), list(self.occs), list(self.hand)
        q.st = dict(self.st)
        q.yearly, q.once = set(self.yearly), set(self.once)
        q.fate = list(self.fate)
        return q

    # ---- 便利関数 ----
    def has(self, c):
        return c in self.occs or c in self.tools or c in self.weapons

    @property
    def comps(self):
        return len(self.skills)

    def free_idx(self):
        return [i for i in range(len(self.skills)) if i not in self.used and i not in self.rest]

    def avail(self):
        return len(self.free_idx()) + self.extra

    def bed_cap(self):
        return self.beds + (2 if 'i17' in self.tools else 0)

    def plots_used(self):
        return self.beds + self.walls + len(self.tools)

    def skill_cap(self):
        return MAX_SKILL + (1 if 'o22' in self.occs else 0)


# ------------------------------------------------------------ 支払い（o15 の代替払いを含む）
def can_pay(p, cost):
    return pay_plan(p, cost) is not None


def pay_plan(p, cost):
    need = {r: n for r, n in cost.items() if n > 0}
    have = dict(p.res)
    out = {}
    for r, n in need.items():
        out[r] = out.get(r, 0) + n
    o15 = 'o15' in p.occs
    # 不足分の代替: 魔石←素材、薬草←魔石(1で2)
    if o15:
        short_h = max(0, out.get('herb', 0) - have['herb'])
        if short_h:
            m = (short_h + 1) // 2
            out['herb'] -= short_h
            out['mana'] = out.get('mana', 0) + m
        short_m = max(0, out.get('mana', 0) - have['mana'])
        if short_m:
            out['mana'] -= short_m
            out['mat'] = out.get('mat', 0) + short_m
    for r, n in out.items():
        if have[r] < n:
            return None
    return out


def pay(p, cost):
    plan = pay_plan(p, cost)
    if plan is None:
        raise ValueError(f'cannot pay {cost} {p.res}')
    for r, n in plan.items():
        p.res[r] -= n


def cost_value(cost):
    return sum(RES_VAL[r] * n for r, n in cost.items())


def add(p, d, mult=1):
    for r, n in d.items():
        p.res[r] += n * mult


# ------------------------------------------------------------ 得点
def score(p, g=None, breakdown=False):
    b = dict(
        trophies=p.trophies,
        quests=p.quest_fame,
        companions=p.comps * FAME_PER_COMPANION,
        cards=p.card_fame + card_end_fame(p, g),
        gold=p.res['gold'] // GOLD_PER_FAME,
        discontent=-DISCONTENT * p.discontent,
        raid=-p.unpaid,
        hero=0,
    )
    if g is not None and g.over:
        b['hero'] = HERO_BONUS if p.trophies > 0 and p.trophies == max(q.trophies for q in g.players) else 0
    t = sum(b.values())
    return (t, b) if breakdown else t


def card_end_fame(p, g):
    f = 0
    if 'o09' in p.occs and p.comps >= 4:
        f += 3
    if 'i17' in p.tools:
        f += p.comps
    if p.egg >= 3:
        f += 6
    return f


class Game:
    def __init__(self, n, ais, seed=None, log=False, weather_seed=None, chars=None):
        self.rng = random.Random(seed)
        self.n = n
        self.players = [Player(i, ais[i]) for i in range(n)]
        self.spaces = [a['id'] for a in ACTIONS if a.get('min_p', 0) <= n]
        self.accum = {s: {} for s in self.spaces if 'accum' in ACT[s]}
        self.occ = {s: 0 for s in self.spaces}
        self.nest_ids = list(NESTS[n])
        self.nests = {}
        self.prices = dict(MARKET_BASE)
        wr = random.Random(weather_seed if weather_seed is not None else self.rng.random())
        decks = {s: wr.sample(WEATHER[s], len(WEATHER[s])) for s in SEASONS}
        self.weather = [decks[SEASONS[r % 4]][r // 4] for r in range(NUM_ROUNDS)]
        self.mdeck = {y: self.rng.sample([m['id'] for m in MONSTERS if m['year'] == y], 10) for y in (1, 2, 3)}
        self.bosses = {r: self.rng.choice(BOSSES[r]) for r in BOSS_ROUNDS}
        self.quests = self.rng.sample(sorted(QUESTS), 3)
        self.quest_done = {q: [] for q in self.quests}
        self.lair = []            # [(pid, power, k, idxs)]
        self.first = 0
        self.round = 0
        self.decisions = 0
        self.close_calls = 0
        self.trades = 0
        self.log_on = log
        self.logs = []
        self.errors = []
        self.over = False
        self.storm_set = set()
        self.history = []        # ラウンドごとの得点
        self.occ_pool = list(OCC_IDS)
        self.item_pool = list(ITEM_IDS)
        self.forced_chars = chars
        self.kills = 0
        self.fights = 0
        self.dragon = None

    def log(self, *a):
        if self.log_on:
            self.logs.append(' '.join(str(x) for x in a))

    # ------------------------------------------------------------ clone (AI用)
    def clone_for(self, pid, extra=()):
        g = Game.__new__(Game)
        g.__dict__.update(self.__dict__)
        g.accum = {k: dict(v) for k, v in self.accum.items()}
        g.occ = dict(self.occ)
        g.nests = {k: dict(v) for k, v in self.nests.items()}
        g.prices = dict(self.prices)
        g.weather = list(self.weather)
        g.lair = list(self.lair)
        g.quest_done = {k: list(v) for k, v in self.quest_done.items()}
        g.players = list(self.players)
        for i in {pid, *extra}:
            g.players[i] = self.players[i].clone()
        g.item_pool = list(self.item_pool)
        g.mdeck = {k: list(v) for k, v in self.mdeck.items()}
        g.log_on = False
        g.rng = random.Random(0)
        g.storm_set = set(self.storm_set)
        return g

    # ------------------------------------------------------------ 情報
    def season(self, r=None):
        return SEASONS[((r or self.round) - 1) % 4]

    def year(self, r=None):
        return ((r or self.round) - 1) // 4 + 1

    def cur_weather(self):
        return self.weather[self.round - 1]

    def tide(self):
        return 'dark' if self.cur_weather() == 'newmoon' else TIDE[self.season()]

    def active(self, sid):
        return ACT[sid].get('from_round', 1) <= self.round

    def forecast(self, p):
        f = FORECAST
        if p.char == 'yuki' or 'o05' in p.occs:
            f = max(f, 2)
        if 'i14' in p.tools:
            f = max(f, 3)
        return f

    def visible_spawns(self, p):
        """これから巣に出る魔物のうち p に見えているもの"""
        k = self.forecast(p) * len(self.nest_ids)
        return self.mdeck[self.year()][:k] if self.round else []

    # ------------------------------------------------------------ セットアップ（ドラフト）
    def setup(self):
        rng = self.rng
        chars = list(CHARACTERS)
        rng.shuffle(chars)
        for i, p in enumerate(self.players):
            p.char_opts = chars[2 * i:2 * i + 2]
            if self.forced_chars:
                p.char_opts = [self.forced_chars[i]]
        for kind, pool in (('occ', self.occ_pool), ('item', self.item_pool)):
            for lap in range(3):
                rng.shuffle(pool)
                shown = {}
                for i, p in enumerate(self.players):
                    shown[i] = pool[DRAFT_SHOW * i:DRAFT_SHOW * i + DRAFT_SHOW]
                for i, p in enumerate(self.players):
                    c = p.ai.draft_pick(self, p, shown[i], kind)
                    p.hand.append(c)
                    p.drafted.append(c)
                    pool.remove(c)
        for i, p in enumerate(self.players):
            p.char = p.ai.pick_character(self, p, p.char_opts)
            p.res['food'] = START_FOOD + SEAT_FOOD[self.n][i]
            p.res['gold'] = START_GOLD
            add(p, START_BONUS.get(p.char, {}))
            if p.char == 'haru':
                p.pets = HARU_START_PETS
            if 'o12' in p.hand:
                pass   # 出したときに -1 を取り除く

    # ------------------------------------------------------------ 進行
    def play(self):
        self.setup()
        for r in range(1, NUM_ROUNDS + 1):
            self.round = r
            self.start_round()
            self.work_phase()
            self.end_round()
            self.history.append([score(p, self) for p in self.players])
        self.over = True
        return [score(p, self) for p in self.players]

    def start_round(self):
        r, w = self.round, self.cur_weather()
        self.log(f'=== R{r} {SEASON_JP[self.season()]} 天候:{WEATHER_JP[w]}')
        if self.season() == 'spring':
            for p in self.players:
                p.yearly = set()
                p.fate = list(FATE_DECK)
                if 'o12' in p.occs:
                    p.fate.remove(min(p.fate)); p.fate.append(1)
        # 積み増し
        for s in self.accum:
            if self.active(s):
                for res, n in ACT[s]['accum'].items():
                    self.accum[s][res] = self.accum[s].get(res, 0) + n
        bonus = dict(sprout={'forest': ('wood', 1), 'meadow': ('herb', 1)}, thaw={'hunt': ('food', 1), 'mine': ('iron', 1)},
                     harvestmoon={'hunt': ('food', 3)}, surge={'spring': ('mana', 1)}).get(w, {})
        for s, (res, n) in bonus.items():
            if s in self.accum:
                self.accum[s][res] = self.accum[s].get(res, 0) + n
        if w == 'drought' and 'hunt' in self.accum:
            self.accum['hunt']['food'] = max(0, self.accum['hunt'].get('food', 0) - 2)
        if w == 'surge':
            self.prices['mana'] = max(1, self.prices['mana'] - 1)
        for s in self.occ:
            self.occ[s] = 0
        # 巣に魔物
        y = self.year()
        nests = list(self.nest_ids) + (['nest_fog'] if w == 'fog' else [])
        spawn_left = len(self.nest_ids) - 1 + SPAWN_EXTRA + (1 if w == 'fog' else 0)
        for nid in nests:
            nd = self.nests.get(nid)
            if nd is None or nd['mon'] is None:
                if self.mdeck[y] and spawn_left > 0:
                    spawn_left -= 1
                    self.nests[nid] = dict(mon=self.mdeck[y].pop(0), dmg=0, trap=self.nests.get(nid, {}).get('trap', 0), slots=0, wait=None, trapper=self.nests.get(nid, {}).get('trapper'))
                else:
                    self.nests[nid] = dict(mon=None, dmg=0, trap=0, slots=0, wait=None, trapper=None)
            else:
                nd['slots'] = 0
                nd['wait'] = None
        self.lair = []
        for p in self.players:
            p.used = set()
            # 負傷の回復（薬草1）。払えなければ休み
            p.rest = set()
            for i in sorted(p.injured):
                if p.res['herb'] >= 1:
                    p.res['herb'] -= 1
                elif 'o15' in p.occs and p.res['mana'] >= 1:
                    p.res['mana'] -= 1
                else:
                    p.rest.add(i)
            p.injured = set()
            p.once = set()
            p.extra = 0
            p.fights = 0
            p.mana_round = 0
            if 'i11' in p.tools and p.st.get('furnace', 0) < 6:
                p.res['mana'] += 1
                p.st['furnace'] = p.st.get('furnace', 0) + 1
            if 'o05' in p.occs:
                if p.res['gold'] >= 1:
                    p.res['gold'] -= 1
            if 'o26' in p.occs:
                if p.res['herb'] >= 1:
                    p.res['herb'] -= 1
                elif p.res['food'] >= 1:
                    p.res['food'] -= 1
                else:
                    fi = p.free_idx()
                    if fi:
                        p.rest.add(fi[0])
            if 'i16' in p.tools and 'i16' not in p.yearly:
                idx = self.train_target(p)
                if idx is not None:
                    p.skills[idx] += 1
                    p.yearly.add('i16')
            # 罠師：木材4以上なら自動で罠
            if 'o18' in p.occs and p.res['wood'] >= 4:
                cand = [nid for nid, nd in self.nests.items() if nd['mon'] and not nd['trap']]
                if cand:
                    nid = max(cand, key=lambda x: MON[self.nests[x]['mon']]['str'] - self.nests[x]['dmg'])
                    p.res['wood'] -= 2
                    self.nests[nid]['trap'] = 2
                    self.nests[nid]['trapper'] = p.pid
            # 時渡りの砂時計
            if 'i20' in p.hand and r >= 2:
                c = self.spell_cost(p, {'mana': 3})
                if can_pay(p, c) and p.ai.use_hourglass(self, p):
                    pay(p, c)
                    self.spell_used(p, 'i20')
                    p.extra += 1

    def work_phase(self):
        order = [(self.first + i) % self.n for i in range(self.n)]
        guard = 0
        while any(self.players[i].avail() > 0 for i in order):
            guard += 1
            if guard > 50:
                self.errors.append('work loop guard')
                break
            for i in order:
                p = self.players[i]
                if p.avail() <= 0:
                    continue
                if hasattr(p.ai, 'trade_phase'):
                    p.ai.trade_phase(self, p)
                opts = self.legal(p)
                sid, opt = p.ai.choose(self, p, opts)
                self.apply(p, sid, opt)
                self.decisions += 1
                p.stats[sid if not sid.startswith('nest') else 'nest'] = p.stats.get(sid if not sid.startswith('nest') else 'nest', 0) + 1
                self.check_quests(p)
        # 待ち伏せのまま誰も来なかった巣は単独で戦う
        for nid, nd in self.nests.items():
            if nd.get('wait'):
                w = nd['wait']
                nd['wait'] = None
                p = self.players[w['pid']]
                self.resolve(p, nid, w['plan'], None)
                self.check_quests(p)
        if self.round in BOSS_ROUNDS:
            self.resolve_lair()

    def end_round(self):
        s, w, r = self.season(), self.cur_weather(), self.round
        if s in ('spring', 'summer', 'autumn'):
            for p in self.players:
                if 'i12' in p.tools:
                    p.res['herb'] += 2
        # 霧の巣の魔物は霧とともに消える
        if 'nest_fog' in self.nests:
            del self.nests['nest_fog']
        if s == 'winter':
            self.winter(w)
        for g in self.prices:
            b = MARKET_BASE[g]
            self.prices[g] += (b > self.prices[g]) - (b < self.prices[g])
        for p in self.players:
            if 'o25' in p.occs and p.res['mat'] >= 3 and p.ai.tan_hide(self, p):
                p.res['mat'] -= 3
                p.card_fame += 2
            # 天候の鈴
            if 'i21' in p.hand and r < NUM_ROUNDS:
                c = self.spell_cost(p, {'mana': 2})
                if can_pay(p, c):
                    nw = p.ai.weather_choice(self, p)
                    if nw:
                        pay(p, c)
                        self.spell_used(p, 'i21')
                        self.weather[r] = nw
            # 嵐呼びの巫女：年1回、次の天候を嵐に（冬の前、得になる時）
            if 'o16' in p.occs and r < NUM_ROUNDS and self.year(r + 1) == self.year() and ('o16', self.year()) not in self.storm_set:
                if p.ai.want_storm(self, p, r + 1):
                    self.weather[r] = 'storm'
                    self.storm_set.add(('o16', self.year()))
            self.check_quests(p)
        self.first = (self.first + 1) % self.n
        for p in self.players:
            for k, v in p.res.items():
                if v < 0:
                    self.errors.append(f'R{r} P{p.pid}: {k} 負 ({v})')
            if p.plots_used() > BASE_PLOTS:
                self.errors.append(f'R{r} P{p.pid}: 区画オーバー')

    def winter(self, w):
        y = self.year()
        for p in self.players:
            need = self.upkeep(p, w)
            if 'o08' in p.occs:
                while p.res['food'] < need and p.res['herb'] >= 2:
                    p.res['herb'] -= 2
                    p.res['food'] += O08_FOOD
            if p.res['food'] >= need:
                p.res['food'] -= need
            else:
                p.discontent += need - p.res['food']
                self.log(f'  P{p.pid} 食料不足 {need - p.res["food"]}')
                p.res['food'] = 0
            if 'i27' in p.tools and p.egg < 3:
                if p.res['food'] >= 1:
                    p.res['food'] -= 1
                    p.egg += 1
                else:
                    p.tools.remove('i27')
                    p.egg = 0
        # 襲撃（残った魔物と主）
        raid = sum(MON[nd['mon']]['raid'] for nd in self.nests.values() if nd['mon'])
        raid += sum(MON[mid]['raid'] for mid in self.mdeck[y][:RAID_FROM_DECK])
        if self.dragon is not None:
            raid += self.dragon['raid']
        self.dragon = None
        for p in self.players:
            d = self.raid_damage(p, raid, w)
            if d > 0 and RAID_PAYABLE:
                for res in ('food', 'gold', 'wood', 'herb'):
                    t = min(d, p.res[res])
                    p.res[res] -= t
                    d -= t
            p.unpaid += max(0, d)
        for nid in self.nests:
            self.nests[nid] = dict(mon=None, dmg=0, trap=0, slots=0, wait=None, trapper=None)

    def raid_damage(self, p, raid, w=None):
        if raid <= 0:
            return 0
        if 'o30' in p.occs and w == 'blizzard':
            return 0
        red = p.walls * 2 if 'o13' in p.occs else p.walls // RAID_WALLS
        red += (1 if p.char == 'goro' else 0) + (1 if 'i14' in p.tools else 0) + (3 if 'o23' in p.occs else 0)
        return max(0, raid - red)

    def upkeep(self, p, w):
        need = UPKEEP * p.comps
        if 'i13' in p.tools:
            need -= 1
        if p.char == 'momo':
            need -= 1
        if 'o20' in p.occs:
            need -= 2 * UPKEEP
        if w == 'blizzard':
            need += 1
        if w == 'cold':
            need += 2
        if w == 'mild':
            need -= 1
        return max(0, need)

    # ------------------------------------------------------------ 依頼
    def quest_ok(self, p, q):
        s = p.st
        return {
            'q_kill4': s['kills'] >= 4, 'q_beast2': s['beast'] >= 2, 'q_undead2': s['undead'] >= 2,
            'q_boss': s['boss'] >= 1, 'q_comp4': p.comps >= 4, 'q_fac3': len(p.tools) >= 3,
            'q_wall3': p.walls >= 3, 'q_weap3': len(p.weapons) >= 3, 'q_occ3': len(p.occs) >= 3,
            'q_spell2': s['spells'] >= 2, 'q_weak3': s['weak'] >= 3, 'q_gold10': p.res['gold'] >= 10,
            'q_coop2': s['coop'] >= 2, 'q_mat6': p.res['mat'] >= 6, 'q_skill3': sum(p.skills) >= 3,
        }[q]

    def check_quests(self, p):
        for q in self.quests:
            d = self.quest_done[q]
            if p.pid not in d and len(d) < 3 and self.quest_ok(p, q):
                p.quest_fame += QUEST_FAME[len(d)]
                d.append(p.pid)

    # ------------------------------------------------------------ 合法手
    def spell_cost(self, p, cost):
        c = dict(cost)
        if p.char == 'mina' and (p.mana_round == 0 or MINA_DISCOUNT_ALWAYS) and c.get('mana', 0) > 0:
            c['mana'] -= 1
        return c

    def spell_used(self, p, cid):
        p.hand.remove(cid)
        p.st['spells'] += 1
        p.st.setdefault('spell_ids', [])
        p.st['spell_ids'] = p.st['spell_ids'] + [cid]
        if p.char == 'mina' and 'mana' in dict(ITEMS_BY[cid]['cost']):
            p.mana_round = 1

    def weapon_cost(self, p, cid):
        c = dict(CARDS[cid]['cost'])
        if p.char == 'gan':
            for _ in range(2):
                mats = [r for r in c if c[r] > 0 and r != 'gold']
                if mats:
                    r = max(mats, key=lambda r: (c[r], RES_VAL[r]))
                    c[r] -= 1
        return c

    def wall_cost(self, p):
        c = dict(WALL_COST)
        if p.char == 'goro':
            c['wood'] -= 1
        return c

    def occ_cost(self, p):
        return {'food': OCC_FOOD[0] if not p.occs else OCC_FOOD[1]}

    def train_target(self, p):
        cand = [i for i in range(p.comps) if p.skills[i] < p.skill_cap()]
        if not cand:
            return None
        return max(cand, key=lambda i: p.skills[i])  # 上位の仲間を鍛える（戦闘で先に出る）

    def market_opts(self, p):
        qty = MARKET_QTY + (2 if 'i15' in p.tools else 0)
        out = []
        for g in ('mana', 'mat'):
            n = min(qty, p.res[g])
            for q in (sorted({1, n}) if n >= 1 else ()):
                if q >= 1:
                    out.append(('sell', g, q))
        for g in ('mana', 'mat', 'wood', 'iron', 'herb', 'food'):
            pr = self.buy_price(p, g)
            for q in range(1, qty + 1):
                if pr * q > p.res['gold']:
                    break
                if q in (1, 2, qty) or q == p.res['gold'] // pr:
                    out.append(('buy', g, q))
        return out

    def sell_price(self, p, g):
        pr = self.prices[g] - SELL_SPREAD + (1 if p.char == 'leo' else 0)
        if self.cur_weather() == 'fair':
            pr += 1
        if p.char == 'leo' and g == 'mat':
            pr += 1
        return max(1, pr)

    def buy_price(self, p, g):
        if g in self.prices:
            return max(1, self.prices[g] - (1 if p.char == 'leo' else 0))
        return FIXED_BUY[g]

    def nest_open(self, p, nid):
        nd = self.nests.get(nid)
        if not nd or nd['mon'] is None:
            return None
        if nd['slots'] < NEST_CAP:
            return 'ok'
        if 'o14' in p.occs and ('o14' not in p.yearly):
            return 'o14'
        if 'i23' in p.hand:
            return 'i23'
        return None

    def legal(self, p):
        out = []
        av = p.avail()
        r = self.round
        for s in self.spaces:
            a = ACT[s]
            if not self.active(s):
                continue
            if not a.get('unlimited') and self.occ[s] > 0:
                continue
            if s == 'guild':
                c = self.occ_cost(p)
                if can_pay(p, c):
                    for cid in p.hand:
                        if cid.startswith('o') and not ('o28' == cid and p.comps >= 4):
                            out.append((s, cid))
            elif s == 'forge':
                for cid in p.hand:
                    if CARDS[cid]['kind'] == 'weapon' and can_pay(p, self.weapon_cost(p, cid)):
                        out.append((s, cid))
            elif s == 'workshop':
                free = BASE_PLOTS - p.plots_used()
                if free > 0:
                    for cid in p.hand:
                        if CARDS[cid]['kind'] == 'tool' and can_pay(p, CARDS[cid]['cost']):
                            out.append((s, ('tool', cid)))
                    if can_pay(p, BED_COST) and p.bed_cap() < MAX_COMPANIONS:
                        out.append((s, ('bed',)))
                    wc = self.wall_cost(p)
                    if can_pay(p, wc):
                        out.append((s, ('wall', 1)))
                        if free >= 2 and can_pay(p, {k: 2 * v for k, v in wc.items()}):
                            out.append((s, ('wall', 2)))
            elif s in MARKETS:
                for o in self.market_opts(p):
                    out.append((s, o))
            elif s == 'tavern':
                fc = 0 if 'o09' in p.occs else HIRE_FOOD
                nana_free = p.char == 'nana' and 'nana_bed' not in p.st
                bed_ok = p.comps < p.bed_cap() or (NANA_FREE_BED and nana_free)
                if nana_free and NANA_FIRST_FREE_FOOD:
                    fc = 0
                if p.comps < MAX_COMPANIONS and bed_ok and p.res['food'] >= fc and r < NUM_ROUNDS:
                    out.append((s, None))
            elif s == 'training':
                if self.train_target(p) is not None:
                    out.append((s, None))
            elif s == 'ruins':
                if self.item_pool:
                    out.append((s, None))
            else:
                out.append((s, None))
        # 巣
        for nid in list(self.nests):
            how = self.nest_open(p, nid)
            if not how:
                continue
            nd = self.nests[nid]
            if nd.get('wait') and nd['wait']['pid'] == p.pid:
                continue
            for k in (1, 2):
                if k > av:
                    continue
                if nd.get('wait'):
                    for mode in ('safe', 'gamble'):
                        out.append((nid, (k, mode, how)))
                else:
                    for mode in ('safe', 'gamble', 'chip', 'wait'):
                        if mode == 'wait' and how != 'ok':
                            continue
                        out.append((nid, (k, mode, how)))
        if r in BOSS_ROUNDS and all(e['pid'] != p.pid for e in self.lair):
            for k in (1, 2):
                if k <= av:
                    out.append(('lair', (k, 'safe', 'ok')))
                    out.append(('lair', (k, 'chip', 'ok')))
        if not out:
            out.append(('plaza', None))
        return out

    # ------------------------------------------------------------ 実行
    def take_worker(self, p, k=1, best=False):
        fi = p.free_idx()
        fi.sort(key=lambda i: p.skills[i], reverse=best)
        got = fi[:k]
        for i in got:
            p.used.add(i)
        short = k - len(got)
        if short > 0:
            p.extra -= short
        return got

    def gain_take(self, p, sid):
        got = dict(self.accum.get(sid, {}))
        if sid in self.accum:
            self.accum[sid] = {}
        for res, n in ACT[sid].get('give', {}).items():
            got[res] = got.get(res, 0) + n
        if sid == 'plaza' and self.cur_weather() == 'festival':
            got['gold'] = got.get('gold', 0) + 1
        if got.get('wood') and p.char == 'toma':
            got['wood'] += 1
        if got.get('herb') and p.char == 'sana':
            got['herb'] += 1
        if got.get('herb') and 'o08' in p.occs:
            got['herb'] += 1
        if got.get('iron') and 'o10' in p.occs:
            got['iron'] += 1
        if sid == 'spring' and p.char == 'mina':
            got['mana'] = got.get('mana', 0) + MINA_SPRING
        add(p, got)

    def apply(self, p, sid, opt, fate=None):
        if sid.startswith('nest'):
            return self.apply_nest(p, sid, opt, fate)
        if sid == 'lair':
            k, mode, _ = opt
            idxs = self.take_worker(p, k, best=True)
            m = self.bosses[self.round]
            plan = self.make_plan(p, m, idxs, mode, boss=True)
            self.pay_plan_boosts(p, plan)
            self.lair.append(dict(pid=p.pid, plan=plan, idxs=idxs))
            return
        if sid != 'plaza':
            self.occ[sid] += 1
        self.take_worker(p, 1)
        if sid in self.accum or 'give' in ACT[sid]:
            self.gain_take(p, sid)
        if sid == 'guild':
            pay(p, self.occ_cost(p))
            p.hand.remove(opt)
            p.occs.append(opt)
            if opt == 'o12' and min(FATE_DECK) in p.fate:
                p.fate.remove(min(FATE_DECK)); p.fate.append(1)
        elif sid == 'forge':
            pay(p, self.weapon_cost(p, opt))
            p.hand.remove(opt)
            p.weapons.append(opt)
            p.card_fame += CARDS[opt]['fame']
            if 'i18' in p.tools:
                p.res['iron'] += 1
            if 'o10' in p.occs and CARDS[opt].get('ironw'):
                p.card_fame += 1
        elif sid == 'workshop':
            if opt[0] == 'tool':
                cid = opt[1]
                pay(p, CARDS[cid]['cost'])
                p.hand.remove(cid)
                p.tools.append(cid)
                p.card_fame += CARDS[cid]['fame']
            elif opt[0] == 'bed':
                pay(p, BED_COST)
                p.beds += 1
            else:
                for _ in range(opt[1]):
                    pay(p, self.wall_cost(p))
                    p.walls += 1
                    if 'o13' in p.occs:
                        p.card_fame += 1
        elif sid in MARKETS:
            kind, g, q = opt
            if kind == 'sell':
                pr = self.sell_price(p, g)
                p.res[g] -= q
                p.res['gold'] += pr * q
                self.prices[g] = max(1, self.prices[g] - 1)
            else:
                pr = self.buy_price(p, g)
                p.res['gold'] -= pr * q
                p.res[g] += q
                if g in self.prices:
                    self.prices[g] = min(MARKET_BASE[g] + MARKET_SPAN, self.prices[g] + 1)
        elif sid == 'tavern':
            fc = 0 if 'o09' in p.occs else HIRE_FOOD
            if p.char == 'nana' and 'nana_bed' not in p.st:
                if not NANA_FREE_BED:
                    fc = 0 if NANA_FIRST_FREE_FOOD else fc
                    p.st['nana_bed'] = 1
                elif p.comps >= p.bed_cap():
                    p.st['nana_bed'] = 1
            p.res['food'] -= fc
            p.skills.append(0)
            p.rest.add(p.comps - 1)
            p.st['hires'] += 1
            if p.char == 'nana':
                p.res['food'] += NANA_HIRE_FOOD
            if 'o28' in p.occs and p.comps >= 4:
                p.occs.remove('o28')
        elif sid == 'training':
            i = self.train_target(p)
            p.skills[i] += 1
        elif sid == 'ruins':
            look = 3 if 'o21' in p.occs else 2
            take = 2 if 'o29' in p.occs else 1
            self.reward_cards(p, look, take)

    def reward_cards(self, p, look, take):
        if not self.item_pool:
            return
        shown = self.rng.sample(self.item_pool, min(look, len(self.item_pool)))
        for _ in range(take):
            if not shown:
                break
            c = p.ai.draft_pick(self, p, shown, 'item', ingame=True)
            shown.remove(c)
            self.item_pool.remove(c)
            p.hand.append(c)

    # ------------------------------------------------------------ 戦闘
    def eff_str(self, p, m, nd=None, boss=False):
        s = m['str'] - (nd['dmg'] + nd['trap'] if nd else 0)
        if self.cur_weather() == 'newmoon' and m['race'] == 'undead':
            s += 2
        if is_beast(m) and 'i09' in p.weapons:
            s -= 2
        return s

    def counter(self, p, m, plan):
        c = m['counter'] + (1 if self.cur_weather() == 'gale' else 0)
        if 'i04' in p.weapons:
            c -= 1
        if plan['arrows'] and 'o02' in p.occs:
            c -= 1
        return c

    def defense(self, p, k):
        d = DEF_PER * k
        if p.char == 'goro':
            d += GORO_DEF
        if 'o06' in p.occs:
            d += 2
        for w in p.weapons:
            d += WEAPON_DEF.get(w, 0)
        if any(c in REAR_CARDS for c in p.occs + p.weapons):
            d += REAR_DEF
        return d

    def boost_list(self, p, m, boss):
        """(名前, 戦力, 費用, 属性, 消費カード) の候補"""
        b = []
        w = self.cur_weather()
        if p.char == 'toma':
            n = 2 + (1 if 'i01' in p.weapons else 0)
            for i in range(n):
                pw = 1
                if w == 'storm' and i == 0:
                    pw = 0
                if w == 'gale' and i == 0:
                    pw = 0
                b.append(('arrow', pw, {'wood': 1}, 'ice' if 'o02' in p.occs else None, None))
        npot = 2 if p.char == 'sana' else 1
        for i in range(npot):
            b.append(('potion', 2 if p.char == 'sana' else POTION[1], dict(POTION[0]), None, None))
        for i in range(2 if p.char == 'momo' else 1):
            b.append(('morale', MORALE[1], dict(MORALE[0]), None, None))
        if 'o01' in p.occs:
            b.append(('o01', 2, {'mana': 1}, 'fire', None))
        if 'o03' in p.occs:
            b.append(('o03', 3, {'gold': 1 if self.season() == 'spring' else 2}, 'thunder', None))
        if 'o19' in p.occs:
            b.append(('o19', 4, {'mana': 1 if w == 'newmoon' else 2}, 'dark', None))
        if 'i29' in p.tools:
            b.append(('i29', 2, {'iron': 1}, None, None))
        sc = lambda c: self.spell_cost(p, c)
        if 'i19' in p.hand:
            b.append(('i19', 4, sc({'mana': 2}), 'fire', 'i19'))
        if 'i23' in p.hand:
            b.append(('i23', 2, sc({'mana': 2}), 'dark', 'i23'))
        if 'i24' in p.hand and boss:
            b.append(('i24', 6, sc({'mana': 2, 'herb': 2}), None, 'i24'))
        if 'i30' in p.hand and (is_dark(m) or boss and m['race'] == 'undead'):
            b.append(('i30', 3, sc({'herb': 1, 'mana': 1}), None, 'i30'))
        if 'i28' in p.hand and p.res['gold'] >= 4:
            x = min(4, p.res['gold'] // 2)
            b.append(('i28', x, dict(sc({'mana': 1}), gold=2 * x), None, 'i28'))
        return b

    def base_power(self, p, m, idxs, coop=False, boss=False):
        k = len(idxs)
        pw = POWER_PER * k + sum(p.skills[i] for i in idxs)
        w, s = self.cur_weather(), self.season()
        els = set()
        for wid in p.weapons:
            pw += WEAPON_POWER.get(wid, 0)
            if wid in WEAPON_EL:
                els.add(WEAPON_EL[wid])
        if 'i03' in p.weapons and s == 'summer':
            pw += 1
        if 'i05' in p.weapons and w == 'storm':
            pw += 2
        if 'i08' in p.weapons:
            pw += p.pets
        pw += p.pets * (3 if 'o07' in p.occs else 2)
        o = p.occs
        if 'o11' in o: pw += 3
        if 'o26' in o: pw += 5
        if 'o28' in o and p.comps <= 3: pw += O28_POWER
        if 'o16' in o and w == 'storm': pw += 2
        if 'o17' in o and (is_dark(m) or m['race'] == 'undead'): pw += 2
        if p.fights >= 1:
            if 'o22' in o: pw += O22_POWER
            if p.char == 'riku': pw += RIKU_CHAIN
        if 'o23' in o and len(p.tools) >= 3: pw += 1
        if 'o30' in o and s == 'winter': pw += 3
        if 'i13' in p.tools: pw += 1
        if coop and 'i10' in p.weapons: pw += 2
        if boss and m['id'] == 'b_ancient' and p.egg >= 2 and 'i27' in p.tools: pw += 6
        return pw, els

    def elem_bonus(self, p, m, els):
        b = 0
        if m['weak'] and m['weak'] in els:
            b += WEAKNESS_BONUS
        if self.tide() in els:
            b += TIDE_BONUS
        we = WEATHER_EL.get(self.cur_weather())
        if we and we[0] in els:
            b += we[1]
        if p.char == 'nana' and 'light' in els:
            b += 1
        return b

    def make_plan(self, p, m, idxs, mode, nd=None, partner=0, coop=False, boss=False):
        base, els = self.base_power(p, m, idxs, coop, boss)
        es = self.eff_str(p, m, nd, boss)
        plan = dict(idxs=idxs, k=len(idxs), boosts=[], cost={}, els=set(els), arrows=0, base=base)
        cur = base + self.elem_bonus(p, m, els) + partner
        if mode in ('safe', 'wait'):
            target = es - self.fate_min(p)
        elif mode == 'gamble':
            target = es - 1
        else:
            target = -99
        if mode == 'wait':
            target -= 2   # 共闘相手を当てにして少し控えめ
        cands = self.boost_list(p, m, boss)
        used_cost = {}
        while cur < target and cands:
            best = None
            for j, (nm, pw, c, el, card) in enumerate(cands):
                tot = dict(used_cost)
                for r_, n_ in c.items():
                    tot[r_] = tot.get(r_, 0) + n_
                if not can_pay(p, tot):
                    continue
                gain = pw
                if el and el not in plan['els']:
                    gain += self.elem_bonus(p, m, plan['els'] | {el}) - self.elem_bonus(p, m, plan['els'])
                if gain <= 0:
                    continue
                v = (cost_value(c) + (0.8 if card else 0)) / gain
                if best is None or v < best[0]:
                    best = (v, j, gain, tot)
            if best is None:
                break
            _, j, gain, tot = best
            nm, pw, c, el, card = cands.pop(j)
            used_cost = tot
            plan['boosts'].append((nm, pw, card))
            if el:
                plan['els'].add(el)
            if nm == 'arrow':
                plan['arrows'] += 1
            cur += gain
        plan['cost'] = used_cost
        plan['power'] = cur - partner
        return plan

    def pay_plan_boosts(self, p, plan):
        if plan['cost']:
            pay(p, plan['cost'])
        for nm, pw, card in plan['boosts']:
            if card:
                self.spell_used(p, card)

    def fate_min(self, p):
        d = p.fate or list(FATE_DECK)
        if 'o27' in p.occs and len(d) >= 2:
            s = sorted(d)
            return s[0] + s[1]
        if p.char == 'yuki' and p.st.get('yuki_y', (0, 0)) != (self.year(), 2) and len(d) >= 2:
            return sorted(d)[1]
        return min(d)

    def fate_dist(self, p):
        """{値: 確率}"""
        d = p.fate if p.fate else list(FATE_DECK)
        out = {}
        if 'o27' in p.occs and len(d) >= 2:
            n = len(d)
            tot = n * (n - 1) / 2
            for i in range(n):
                for j in range(i + 1, n):
                    out[d[i] + d[j]] = out.get(d[i] + d[j], 0) + 1 / tot
            return out
        if p.char == 'yuki' and self.yuki_left(p) > 0 and len(d) >= 2:
            n = len(d)
            tot = n * (n - 1) / 2
            for i in range(n):
                for j in range(i + 1, n):
                    v = max(d[i], d[j])
                    out[v] = out.get(v, 0) + 1 / tot
            return out
        for x in d:
            out[x] = out.get(x, 0) + 1 / len(d)
        return out

    def yuki_left(self, p):
        y, used = p.st.get('yuki_y', (0, 0))
        return YUKI_PER_YEAR - (used if y == self.year() else 0)

    def draw_fate(self, p, need=None):
        if not p.fate:
            p.fate = list(FATE_DECK)
            if 'o12' in p.occs:
                p.fate.remove(min(p.fate)); p.fate.append(1)
        if 'o27' in p.occs:
            if len(p.fate) < 2 or ('o27' not in p.yearly and sum(p.fate) / len(p.fate) < 0.4):
                p.fate = list(FATE_DECK)
                if 'o12' in p.occs:
                    p.fate.remove(min(p.fate)); p.fate.append(1)
                p.yearly.add('o27')
            a = p.fate.pop(self.rng.randrange(len(p.fate)))
            b = p.fate.pop(self.rng.randrange(len(p.fate))) if p.fate else 0
            return a + b
        if p.char == 'yuki' and len(p.fate) >= 2 and self.yuki_left(p) > 0:
            i, j = self.rng.sample(range(len(p.fate)), 2)
            a, b = p.fate[i], p.fate[j]
            if need is None or a < need:   # 1枚目で足りなければ2枚目を見る
                y, used = p.st.get('yuki_y', (0, 0))
                p.st['yuki_y'] = (self.year(), (used if y == self.year() else 0) + 1)
                v = max(a, b)
                p.fate.remove(v)
                return v
            p.fate.remove(a)
            return a
        return p.fate.pop(self.rng.randrange(len(p.fate)))

    def remove_fate(self, p, v):
        if not p.fate:
            p.fate = list(FATE_DECK)
        if 'o27' in p.occs:
            for x in list(p.fate):
                if len(p.fate) >= 2:
                    p.fate.remove(x)
                    break
            if p.fate:
                p.fate.pop()
            return
        if v in p.fate:
            p.fate.remove(v)
        elif p.fate:
            p.fate.pop()

    def apply_nest(self, p, nid, opt, fate=None):
        k, mode, how = opt
        nd = self.nests[nid]
        m = MON[nd['mon']]
        if how == 'o14':
            p.yearly.add('o14')
        idxs = self.take_worker(p, k, best=True)
        nd['slots'] += 1
        if nd.get('wait'):
            w = nd['wait']
            q = self.players[w['pid']]
            partner = w['plan']['power'] + (2 if 'i10' in q.weapons else 0) + (AYA_COOP if p.char == 'aya' else 0)
            plan = self.make_plan(p, m, idxs, mode, nd, partner=partner, coop=True)
            if q.char == 'aya':
                plan['power'] += AYA_COOP
            if 'i10' in p.weapons:
                plan['power'] += 0   # make_plan で計上済み
            self.pay_plan_boosts(p, plan)
            nd['wait'] = None
            self.resolve(p, nid, plan, (q, w['plan'], partner), fate)
            return
        plan = self.make_plan(p, m, idxs, mode, nd)
        if how == 'i23' and not any(b[0] == 'i23' for b in plan['boosts']):
            c = self.spell_cost(p, {'mana': 2})
            tot = dict(plan['cost'])
            for r_, n_ in c.items():
                tot[r_] = tot.get(r_, 0) + n_
            if can_pay(p, tot):
                plan['cost'] = tot
                plan['boosts'].append(('i23', 2, 'i23'))
                plan['els'].add('dark')
                plan['power'] = plan['base'] + 2 + sum(b[1] for b in plan['boosts'][:-1]) + self.elem_bonus(p, m, plan['els'])
        self.pay_plan_boosts(p, plan)
        if mode == 'wait':
            nd['wait'] = dict(pid=p.pid, plan=plan)
            return
        self.resolve(p, nid, plan, None, fate)

    def resolve(self, p, nid, plan, coop, fate=None):
        """coop = (待っていた人, その人の plan, その人の戦力) """
        nd = self.nests[nid]
        m = MON[nd['mon']]
        es = self.eff_str(p, m, nd)
        partner = coop[2] if coop else 0
        power = plan['power'] + partner
        need = es - power
        self.last_need = need
        f = fate if fate is not None else self.draw_fate(p, need)
        if fate is not None:
            self.remove_fate(p, f)
        total = power + f
        win = total >= es
        self.fights += 1
        parts = [(p, plan)] + ([(coop[0], coop[1])] if coop else [])
        for q, pl in parts:
            q.fights += 1
            self.injure(q, m, pl, win, partner_bonus=(1 if coop and 'o06' in (coop[0].occs if q is p else p.occs) else 0))
        tname = f'{m["name"]}({es})'
        if win:
            self.kills += 1
            self.log(f'  P{p.pid}{"+P"+str(coop[0].pid) if coop else ""} {NEST_JP.get(nid, nid)} {tname} 撃破 {power}+{f}')
            nd['mon'] = None
            nd['dmg'] = 0
            if nd.get('trap'):
                tp = nd.get('trapper')
                if tp is not None:
                    self.players[tp].res['gold'] += 1
                nd['trap'] = 0
                nd['trapper'] = None
            if coop:
                q = coop[0]
                full = 'o24' in p.occs or 'o24' in q.occs
                both_trophy = full or 'i25' in p.hand and p.res['gold'] >= 2
                if both_trophy and not full and 'i25' in p.hand:
                    p.res['gold'] -= 2
                    self.spell_used(p, 'i25')
                lead = p if plan['power'] >= coop[1]['power'] else q
                for who in (p, q):
                    tro = (who is lead) or both_trophy
                    self.win_reward(who, m, plan if who is p else coop[1], full=full or None, trophy=tro, half=(not full), lead=(who is lead))
                    who.st['coop'] += 1
            else:
                self.win_reward(p, m, plan, full=True, trophy=True)
        else:
            dmg = max(1, power // 2)
            nd['dmg'] += dmg
            if nd.get('trap'):
                nd['trap'] = 0
            self.log(f'  P{p.pid} {NEST_JP.get(nid, nid)} {tname} 敗北 {power}+{f} 傷{dmg}')
            if 'i28' in [b[0] for b in plan['boosts']]:
                pass  # 金貨は既に支払い済み（失う）
            for q, pl in parts:
                if 'i22' in q.hand:
                    c = self.spell_cost(q, {'mana': 1})
                    if can_pay(q, c):
                        pay(q, c)
                        self.spell_used(q, 'i22')
                        for i in pl['idxs']:
                            q.injured.discard(i)
                            q.used.discard(i)

    def injure(self, q, m, pl, win, partner_bonus=0):
        over = self.counter(q, m, pl) - self.defense(q, pl['k']) - partner_bonus
        inj = 0 if over <= 0 else (2 if over >= 3 else 1)
        if 'o11' in q.occs or 'i26' in q.weapons:
            inj = max(inj, 1)
        inj = min(inj, len(pl['idxs']))
        hurt = sorted(pl['idxs'], key=lambda i: q.skills[i])[:inj]
        if hurt and 'o04' in q.occs and 'o04' not in q.once:
            q.once.add('o04')
            hurt = hurt[1:]
        if q.char == 'sana':
            while hurt and q.res['herb'] >= 1 and q.ai.sana_heal(self, q):
                q.res['herb'] -= 1
                hurt = hurt[1:]
        for i in hurt:
            q.injured.add(i)

    def win_reward(self, p, m, plan, full=True, trophy=True, half=False, lead=False):
        loot = dict(m['loot'])
        if p.char == 'riku':
            loot['mat'] = loot.get('mat', 0) + 1
        if 'i07' in p.weapons:
            loot['mat'] = loot.get('mat', 0) + 1
        if 'o25' in p.occs and is_beast(m):
            loot['mat'] = loot.get('mat', 0) + 2
        if half:
            loot = {r: (n + (1 if lead else 0)) // 2 for r, n in loot.items()}
        tamed = False
        if is_beast(m) and (p.char == 'haru' or 'o07' in p.occs or 'i09' in p.weapons):
            cap = (2 if p.char == 'haru' or 'i09' in p.weapons else 1) + (1 if 'o07' in p.occs else 0)
            fc = 3 - (1 if 'i09' in p.weapons else 0)
            if p.pets < cap and p.res['food'] >= fc and p.ai.want_tame(self, p, m):
                p.res['food'] -= fc
                p.pets += 1
                tamed = True
        if not tamed:
            add(p, loot)
        if trophy and (not tamed or TAME_KEEPS_TROPHY):
            p.trophies += m['trophy']
        elif half and not trophy:
            p.trophies += int(m['trophy'] * COOP_SUPPORT_SHARE + 0.5)
        p.st['kills'] += 1
        if is_beast(m): p.st['beast'] += 1
        if m['race'] == 'undead': p.st['undead'] += 1
        if m['weak'] and m['weak'] in plan['els']:
            p.st['weak'] += 1
            if m['weak'] == 'fire' and 'o01' in p.occs and any(b[0] == 'o01' for b in plan['boosts']):
                p.res['mana'] += 1
        for nm, pw, card in plan['boosts']:
            if nm == 'i28':
                p.res['gold'] += 4 * pw
        p.kills_log.append((self.round, m['id']))

    def resolve_lair(self):
        m = self.bosses[self.round]
        if not self.lair:
            if self.round == 12:
                for p in self.players:
                    p.card_fame -= DRAGON_FAIL
                self.log('  古竜に誰も挑まず 全員 -3')
            else:
                self.dragon = m
            return
        power = 0
        fates = 0
        for e in self.lair:
            p = self.players[e['pid']]
            power += e['plan']['power']
        for e in self.lair:
            p = self.players[e['pid']]
            fates += self.draw_fate(p, None)
        win = power + fates >= m['str']
        self.log(f'  主の巣 {m["name"]}({m["str"]}) 戦力{power}+{fates} {"撃破" if win else "敗北"} 参加{[e["pid"] for e in self.lair]}')
        top = max(self.lair, key=lambda e: e['plan']['power'])['pid']
        for e in self.lair:
            p = self.players[e['pid']]
            p.fights += 1
            self.injure(p, m, e['plan'], win)
            if self.round == 12 and 'o17' in p.occs:
                p.card_fame += O17_DRAGON_FAME
        if win:
            self.kills += 1
            for e in self.lair:
                p = self.players[e['pid']]
                p.st['boss'] += 1
                if self.round == 12:
                    p.trophies += DRAGON_JOIN_FAME
                    if 'o26' in p.occs:
                        p.card_fame += 8
                else:
                    if p.pid == top:
                        p.trophies += m['trophy']
                        add(p, m['loot'])
                    else:
                        p.trophies += int(m['trophy'] * BOSS_SHARE)
                    self.reward_cards(p, 4 if 'o29' in p.occs else 3, 1)
                if 'i26' in p.weapons:
                    p.card_fame += I26_BOSS_FAME
        else:
            if self.round == 12:
                for p in self.players:
                    p.card_fame -= DRAGON_FAIL
            else:
                self.dragon = m

    # ------------------------------------------------------------ 取引
    def trade(self, a, b, give, get):
        for r, n in give.items():
            a.res[r] -= n
            b.res[r] += n
        for r, n in get.items():
            b.res[r] -= n
            a.res[r] += n
        for x in (a, b):
            if x.char == 'aya':
                x.res['gold'] += AYA_TRADE_GOLD
        self.trades += 1


ITEMS_BY = {c['id']: c for c in ITEMS}

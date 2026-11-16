"""Python版エンジン（正）を自動対戦させ、TypeScript版の一致テスト用に全手順と状態を記録する。
使い方: python3 trace_golden.py <engineフォルダ> <出力.json> <ゲーム数>
"""
import sys, json, random
sys.path.insert(0, sys.argv[1])
import engine as E
from data import CHARACTERS
from ai import AI, evaluate, DEFAULT_W

OUT, NGAMES = sys.argv[2], int(sys.argv[3])


def pstate(p):
    return dict(pid=p.pid, char=p.char, res=dict(p.res), rooms=p.rooms, house=p.house,
                fields=[list(f) for f in p.fields], pastures=p.pastures, family=p.family,
                born_year=p.born_year, avail=p.avail, imps=sorted(p.imps), begging=p.begging,
                shield=p.shield, ido_left=p.ido_left, nana_used=p.nana_used,
                trade_coin=p.trade_coin, once=sorted(p.once), yearly=sorted(p.yearly))


def gstate(g):
    return dict(round=g.round, first=g.first, accum={k: dict(v) for k, v in g.accum.items()},
                occ=dict(g.occ), closed=sorted(g.closed), prices=dict(g.prices),
                display=list(g.display), deck=list(g.deck), stock=dict(g.stock),
                players=[pstate(p) for p in g.players],
                evals=[round(evaluate(g, p, DEFAULT_W), 6) for p in g.players])


def jopt(o):
    return json.loads(json.dumps(o))


MAIN = [None]
EVENTS = [None]
orig_legal, orig_apply, orig_trade = E.Game.legal, E.Game.apply, E.Game.trade
orig_start, orig_end = E.Game.start_round, E.Game.end_round


def legal(self, p):
    r = orig_legal(self, p)
    if self is MAIN[0]:
        self._last_legal = (p.pid, r)
    return r


def apply(self, p, sid, opt):
    if self is MAIN[0]:
        pid, lg = self._last_legal
        assert pid == p.pid
        orig_apply(self, p, sid, opt)
        EVENTS[0].append(dict(t='move', pid=p.pid, legal=jopt(lg), sid=sid, opt=jopt(opt),
                              after=pstate(p), prices=dict(self.prices),
                              display=list(self.display), stock=dict(self.stock)))
    else:
        orig_apply(self, p, sid, opt)


def trade(self, a, b, give, get):
    orig_trade(self, a, b, give, get)
    if self is MAIN[0]:
        EVENTS[0].append(dict(t='trade', a=a.pid, b=b.pid, give=dict(give), get=dict(get),
                              pa=pstate(a), pb=pstate(b)))


def start_round(self):
    orig_start(self)
    if self is MAIN[0]:
        EVENTS[0].append(dict(t='start', state=gstate(self)))


def end_round(self):
    orig_end(self)
    if self is MAIN[0]:
        EVENTS[0].append(dict(t='end', state=gstate(self)))


E.Game.legal, E.Game.apply, E.Game.trade = legal, apply, trade
E.Game.start_round, E.Game.end_round = start_round, end_round

games = []
levels_pool = ['random', 'novice', 'mid', 'expert']
for gi in range(NGAMES):
    rng = random.Random(1000 + gi)
    n = 3 + gi % 4
    chars = rng.sample(list(CHARACTERS), n)
    levels = [rng.choice(levels_pool) for _ in range(n)]
    ais = [AI(levels[i], seed=gi * 100 + i, trade=True) for i in range(n)]
    g = E.Game(n, chars, ais, seed=gi)
    setup = dict(n=n, chars=chars, weather=list(g.weather), deck=list(g.deck),
                 display=list(g.display), init=gstate(g))
    MAIN[0] = g
    EVENTS[0] = []
    g.play()
    final = [dict(zip(('total', 'breakdown'), E.score(p, True))) for p in g.players]
    games.append(dict(setup=setup, events=EVENTS[0], final=final, errors=g.errors))
    print(gi, n, 'events', len(EVENTS[0]), 'trades', g.trades, file=sys.stderr)

with open(OUT, 'w') as f:
    json.dump(games, f, ensure_ascii=False)

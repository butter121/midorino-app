"""霧谷の冒険者団：Python 版エンジン（正）で決まった種の AI 対戦を流し、全手順と得点を JSON に書き出す。
TypeScript 版（packages/engine/src/kiridani）が同じ種で同じ結果になるかを vitest で確かめるための記録。

使い方: python3 tools/kiridani/trace.py [エンジンのフォルダ] [出力.json]
  既定: tools/kiridani/py（engine.py・ai.py・data.py の写し） → packages/engine/test/kiridani-golden.json

乱数は random.Random を mulberry32（prng.py）に差し替えて、TypeScript 側と同じ列にする。
engine.py・ai.py・data.py そのものには手を入れない。"""
import hashlib, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'py')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'packages/engine/test/kiridani-golden.json')

sys.path.insert(0, HERE)
from prng import MRandom
random.Random = MRandom
sys.path.insert(0, src)
import engine as E
from ai import AI
from data import NUM_ROUNDS

GAMES = [
    (3, ['mid'] * 3, 1), (4, ['mid'] * 4, 2), (4, ['expert', 'mid', 'novice', 'mid'], 3), (5, ['novice'] * 5, 4),
    (6, ['expert'] * 6, 5), (4, ['expert'] * 4, 6), (3, ['expert', 'novice', 'mid'], 7), (6, ['mid'] * 6, 8),
    (5, ['mid'] * 5, 9), (4, ['novice'] * 4, 10), (3, ['novice'] * 3, 11), (5, ['expert'] * 5, 12),
    (4, ['mid'] * 4, 13), (6, ['novice', 'mid', 'expert'] * 2, 14), (3, ['mid'] * 3, 15), (5, ['mid', 'expert'] * 2 + ['novice'], 16),
    (4, ['expert'] * 4, 17), (6, ['mid'] * 6, 18), (4, ['mid'] * 4, 19), (5, ['novice'] * 5, 20),
]

REAL = [None]
LOG = []


def j(o):
    if isinstance(o, (set, frozenset)):
        return sorted(o)
    if isinstance(o, tuple):
        return [j(x) for x in o]
    if isinstance(o, list):
        return [j(x) for x in o]
    if isinstance(o, dict):
        return {str(k): j(v) for k, v in o.items()}
    return o


class TAI(AI):
    def draft_pick(self, g, p, cards, kind, ingame=False):
        c = super().draft_pick(g, p, cards, kind, ingame)
        if g is REAL[0]:
            LOG.append(['pick' if ingame else 'draft', p.pid, c])
        return c

    def pick_character(self, g, p, options):
        c = super().pick_character(g, p, options)
        LOG.append(['char', p.pid, c])
        return c

    def choose(self, g, p, opts):
        o = super().choose(g, p, opts)
        if g is REAL[0]:
            LOG.append(['choose', g.round, p.pid, o[0], j(o[1]), len(opts)])
        return o


_trade = E.Game.trade


def trade(self, a, b, give, get):
    if self is REAL[0]:
        LOG.append(['trade', self.round, a.pid, b.pid, give, get])
    return _trade(self, a, b, give, get)


E.Game.trade = trade


def pstate(p):
    return dict(res=dict(p.res), skills=list(p.skills), trophies=p.trophies, card_fame=p.card_fame, quest_fame=p.quest_fame,
                discontent=p.discontent, unpaid=p.unpaid, occs=list(p.occs), weapons=list(p.weapons), tools=list(p.tools),
                hand=list(p.hand), pets=p.pets, walls=p.walls, beds=p.beds, fate=list(p.fate), injured=sorted(p.injured), egg=p.egg)


def run(n, levels, seed):
    LOG.clear()
    ais = [TAI(levels[i], seed=seed * 100 + i) for i in range(n)]
    g = E.Game(n, ais, seed=seed)
    REAL[0] = g
    g.setup()
    rounds = []
    for r in range(1, NUM_ROUNDS + 1):
        g.round = r
        g.start_round()
        g.work_phase()
        g.end_round()
        rounds.append(dict(r=r, scores=[E.score(p, g) for p in g.players], weather=g.weather[r - 1],
                           nests={k: j(v) for k, v in g.nests.items()}, prices=dict(g.prices),
                           players=[pstate(p) for p in g.players]))
    g.over = True
    final = [E.score(p, g, True) for p in g.players]
    return dict(n=n, levels=levels, seed=seed, chars=[p.char for p in g.players], quests=g.quests,
                bosses={str(k): v['id'] for k, v in g.bosses.items()}, weather=g.weather,
                log=j(list(LOG)), rounds=rounds, scores=[t for t, _ in final], breakdown=[b for _, b in final],
                errors=g.errors, fights=g.fights, kills=g.kills, trades=g.trades)


if __name__ == '__main__':
    md5 = {f: hashlib.md5(open(os.path.join(src, f), 'rb').read()).hexdigest() for f in ('engine.py', 'ai.py', 'data.py')}
    games = [run(*x) for x in GAMES]
    json.dump(dict(source=md5, games=games), open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    for x in games:
        print(x['n'], x['seed'], x['chars'], x['scores'], 'errors', x['errors'][:2])
    print('wrote', out, os.path.getsize(out), 'bytes')

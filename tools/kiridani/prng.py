"""Python と TypeScript で同じ乱数列を出すための小さな乱数（mulberry32）。
random.Random の代わりに差し込んで使う（tools/kiridani/trace.py が random.Random を置き換える）。
TypeScript 側は packages/engine/src/kiridani/rng.ts。両方とも同じ手順で shuffle・sample・choice・gauss を作る。"""
import math

M32 = 0xFFFFFFFF


def _imul(a, b):
    return (a * b) & M32


class MRandom:
    def __init__(self, seed=None):
        self.seed(seed)

    def seed(self, seed=None):
        if seed is None:
            seed = 0
        if isinstance(seed, float):
            seed = int(seed * 4294967296)
        self.a = int(seed) & M32
        self.gauss_next = None

    def random(self):
        self.a = (self.a + 0x6D2B79F5) & M32
        t = self.a
        t = _imul(t ^ (t >> 15), t | 1)
        t ^= (t + _imul(t ^ (t >> 7), t | 61)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296

    def _randbelow(self, n):
        return int(self.random() * n)

    def randrange(self, n):
        return self._randbelow(n)

    def choice(self, seq):
        return seq[self._randbelow(len(seq))]

    def shuffle(self, x):
        for i in reversed(range(1, len(x))):
            j = self._randbelow(i + 1)
            x[i], x[j] = x[j], x[i]

    def sample(self, population, k):
        pool = list(population)
        n = len(pool)
        if k > n:
            raise ValueError('sample larger than population')
        res = []
        for i in range(k):
            j = self._randbelow(n - i)
            res.append(pool[j])
            pool[j] = pool[n - i - 1]
        return res

    def gauss(self, mu=0.0, sigma=1.0):
        z = self.gauss_next
        self.gauss_next = None
        if z is None:
            x2pi = self.random() * 2 * math.pi
            g2rad = math.sqrt(-2.0 * math.log(1.0 - self.random()))
            z = math.cos(x2pi) * g2rad
            self.gauss_next = math.sin(x2pi) * g2rad
        return mu + z * sigma

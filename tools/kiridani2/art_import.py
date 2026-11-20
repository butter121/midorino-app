"""霧谷の冒険者団 v2 — 生成したカードの絵をアプリに取り込む（第3弾：作り直しのカード）。

使い方（リポジトリの一番上で。Python 3 と Pillow が要る： pip install pillow）
  python tools/kiridani2/art_import.py <生成した絵のフォルダ>          取り込む
  python tools/kiridani2/art_import.py <生成した絵のフォルダ> --check  何が足りないかだけ見る

- フォルダの中の <id>.png / .jpg / .webp を読む（id はカードの id。order-3.csv の1列目）。
- 縦長 3:4 に切りそろえて、480×640（<id>.webp）と 192×256（<id>-s.webp）を packages/app/public/cards/ に書く。
- packages/app/public/cards/index.json の ids に足し、v を今の日時にする（古い絵が取り直される）。
- order-3.csv にあって、まだ絵が無い id を最後に表示する。
"""
import csv
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / 'packages' / 'app' / 'public' / 'cards'
ORDER = Path(__file__).resolve().parent / 'art' / 'order-3.csv'
BIG, SMALL = (480, 640), (192, 256)


def crop34(im):
    """真ん中を縦長 3:4 に切る（人物は上寄りに描かれている前提で、縦が余るときは上から取る）"""
    w, h = im.size
    if w * 4 > h * 3:  # 横が余る → 左右を切る
        nw = h * 3 // 4
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = w * 4 // 3
    return im.crop((0, 0, w, nh))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    check = '--check' in sys.argv
    order = [r['id'] for r in csv.DictReader(ORDER.open(encoding='utf-8-sig'))]
    files = {p.stem: p for p in src.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp') and not p.stem.endswith('-s')}
    found = [i for i in order if i in files]
    missing = [i for i in order if i not in files]
    extra = sorted(set(files) - set(order))
    print(f'注文 {len(order)} 枚のうち、絵がある {len(found)} 枚・まだ無い {len(missing)} 枚')
    if extra:
        print(f'注文に無いファイル（カードの id か確かめてください。取り込みはします）: {", ".join(extra[:20])}{" …" if len(extra) > 20 else ""}')
    if check:
        if missing:
            print('まだ無い id:', ' '.join(missing))
        return
    from PIL import Image
    idx_path = CARDS / 'index.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8'))
    ids = set(idx.get('ids', []))
    done = 0
    for i, p in sorted(files.items()):
        im = crop34(Image.open(p).convert('RGB'))
        im.resize(BIG, Image.LANCZOS).save(CARDS / f'{i}.webp', 'WEBP', quality=80, method=6)
        im.resize(SMALL, Image.LANCZOS).save(CARDS / f'{i}-s.webp', 'WEBP', quality=75, method=6)
        ids.add(i)
        done += 1
    idx['ids'] = sorted(ids)
    idx['v'] = time.strftime('%Y%m%d%H%M')
    idx_path.write_text(json.dumps(idx, ensure_ascii=False), encoding='utf-8')
    print(f'{done} 枚を取り込み、index.json を更新しました（v={idx["v"]}）')
    if missing:
        print('まだ無い id:', ' '.join(missing))
    print('次は packages/app で npm run build（または main に push）')


if __name__ == '__main__':
    main()

# カードの絵・第3弾（作り直しのカード）

作り直しで増えた・中身が変わったカード **448 枚** の絵の注文です。生成は手元の Stable Diffusion（ComfyUI + Animagine XL 4.0）で行い、このフォルダの一覧と `tools/kiridani2/art_import.py` で取り込みます。

## 何を描くか

| 種類 | 枚数 | 備考 |
| --- | --- | --- |
| リーダー | 41 | 新しい 34 人＋中身が変わった 7 人（アカネ・ユキ・クロ・ガイ・ジン・ミナ・テツ） |
| 職能 | 60 | 新しい 59 枚＋中身が変わった賞金稼ぎ |
| 武器 | 64 | |
| 防具 | 76 | 竜鱗の鎧（盾→鎧に変わった）を含む |
| 道具 | 72 | |
| 秘術 | 76 | 使い切り 46・秘術書 30 |
| 使い魔 | 48 | 魔物を仲間にした姿（首輪・ハーネス付き、落ち着いた姿） |
| その他 | 11 | 段階カード「弟子入り」、依頼 2 枚、遺物 8 枚 |

- 名前が少し変わっただけのカード（32 枚。例：武器職人→武器鍛冶、獣舎→厩舎）は今の絵をそのまま使います。
- 使わなくなった旧カードの絵（201 枚分）はアプリから消しました。

## ファイル

- `order-3.csv`：注文の一覧。列は id・種類・名前・frame（person＝人物／object＝もの）・redo（作り直し）・subject（絵の題材。英語）。
- `subjects-3.json`：`{ "id": "題材" }`。今までの `subjects.json` に足して使えます。

## 生成のめやす（今までと同じ絵柄にそろえる）

- 大きさ：縦長 3:4（例 896×1152 または 768×1024）。
- 共通の前置き（例）：`masterpiece, best quality, anime style fantasy trading card illustration, soft lighting, muted colors,` ＋ subject
- 共通のネガティブ（例）：`text, letters, logo, watermark, signature, frame, border, card frame, lowres, bad anatomy, extra fingers, blurry`
- 決まりごと：文字・枠は描かない。大事なもの（顔・品物）は真ん中の正方形に収める（画面は正方形に切り抜く。人物は上寄り）。四隅に大事なものを置かない。エフェクトは控えめ。実在の作品のキャラや絵柄は使わない。

## 取り込み

1. 生成した絵を1つのフォルダに `<id>.png`（または .jpg・.webp）の名前で置く。
2. リポジトリの一番上で：
   - 足りないものを見る：`python tools/kiridani2/art_import.py <フォルダ> --check`
   - 取り込む：`python tools/kiridani2/art_import.py <フォルダ>`（Pillow が要る：`pip install pillow`）
3. 3:4 に切りそろえて 480×640 と 192×256 の webp を `packages/app/public/cards/` に書き、`index.json` に id を足して `v` を更新します。途中まででも取り込めます（無いカードは仮の絵のまま）。
4. `packages/app` で `npm run build`、またはコミットして PR に足す。

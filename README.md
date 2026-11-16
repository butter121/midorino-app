# ミドリノ谷の四季（オンライン版）

3〜6人で、それぞれのスマホから遊ぶ農場ワーカープレイスメントゲームのアプリです。
ホストの端末が審判（ルールエンジン）になり、スマホ同士が直接つながって遊びます（専用サーバーなし）。

## 構成

| フォルダ | 中身 |
|---|---|
| `packages/app` | スマホ画面（Vite + React、横向き） |
| `packages/engine` | ルールエンジン（Python版 engine.py / data.py / ai.py の TypeScript 移植） |
| `tools/trace_golden.py` | Python版を自動対戦させ、一致テスト用の記録を作るスクリプト |
| `golden/` | 一致テスト用の記録（大きいのでGitには入れない。下の手順で作る） |

## ルールエンジンの一致テスト

Python版（バランステスト済み）と TypeScript 版が、合法手・各手の結果・ラウンドごとの状態・評価値・最終得点まで
完全に一致することを確かめます。

```bash
npm install
python3 tools/trace_golden.py <Python版engineフォルダ> golden/golden.json 120
npm test
```

ルールを変えるときは、まず Python 版を変えてバランスを確認し、同じ変更を TypeScript 版に入れてからこのテストを通します。

## 画面を動かす

```bash
npm install
npm run dev -w @midorino/app      # 開発用サーバー（同じWi-Fiのスマホからも開ける）
npm run build -w @midorino/app    # 公開用ファイルを packages/app/dist に作る
```

main に push すると GitHub Actions がテストと公開（GitHub Pages）を行います。

## オンライン対戦の仕組み

- ホストが「友だちと遊ぶ（部屋を作る）」を押すと、推測できない部屋ID（128ビット）の招待リンクとQRコードができます。
- 参加者はリンクを開いてニックネームを入れ、ホストが承認すると席に着きます。再接続用の合言葉は各端末に自動で保存されます。
- スマホ同士は WebRTC（PeerJS）で直接つながります。最初に相手を見つけるときだけ PeerJS の無料公開サーバーを使います。
- 審判はホストの端末（`packages/app/src/net/hostRoom.ts`）。参加者には `viewFor` で作った「その席から見てよい情報」だけを送ります。
- ホストの端末には毎手、部屋とゲームの状態が保存され、開き直すと「再開」できます。

## オンライン対戦のテスト

```bash
node tools/peer-server.cjs &                       # テスト用の PeerJS サーバー（127.0.0.1:9000）
VITE_PEER_HOST=127.0.0.1 VITE_PEER_PORT=9000 VITE_PEER_SECURE=false \
  npm run build -w @midorino/app
npx vite preview --port 4174 packages/app &
node tools/e2e-online.cjs
```

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

# @midorino/ui — 画面部品とグラフィック

ミドリノ谷の四季の見た目（アイコン・イラスト・画面部品）です。すべてオリジナルの絵で、SVG で描いています。

- **表示専用**：状態は props で受け取り、操作は `onXxx` で返します。審判・通信は `packages/app` 側。
- **横向きが基本**：`GameLayout` は横向きで「状況バー／プレイヤー列／村のボード／自分のパネル＋操作」、縦向きでは1列に並べ、横向きの案内を出します。
- **アクセシビリティ**：文字12px以上・押せる所44px以上・コントラスト4.5:1以上。プレイヤーは色（色覚の違いに配慮した配色）＋印（●▲■★◆✚）＋名前で区別。悪天候や不足は色と文字の両方で示します。スペースは「選ぶ→決定」の2段階で誤タップを防ぎます。

## 使い方

```tsx
import '@midorino/ui/src/styles/ui.css';
import { IconSprite, GameLayout, StatusBar, PlayerStrip, ActionBoard, MyPanel, ActionBar } from '@midorino/ui';

<IconSprite />   {/* 一番外側に1回 */}
<GameLayout status={<StatusBar .../>} players={<PlayerStrip .../>} board={<ActionBoard spaces={...} .../>}
  side={<MyPanel player={...} />} action={<ActionBar .../>} />
```

`ActionBoard` には `SpaceView { id, accum, by: 席番号[], available, reason?, bonus? }` の配列を渡します（`MatchView.placements` と `legalSpaces` から作る）。

## 部品

| 部品 | 内容 |
|---|---|
| `StatusBar` / `SeasonTrack` | 年・季節・ラウンド、12ラウンドの道のり（収穫・冬越しの印）、今日と次の天気、注意（冬越しの食料など） |
| `PlayerStrip` | 全員の点数・残りコマ・手番・先手 |
| `ActionBoard` / `ActionSpace` | 目的別5グループ（資材／食料・お金／畑・家畜／家・家族／市場・設備）。たまっている量・置いた人・置けない理由 |
| `MyPanel` / `FarmBoard` / `ResourceBar` / `FamilyRow` | 自分のキャラ・4×4農場・持ち物・家族・設備・いまの得点 |
| `PlayersOverview` | 「みんな」タブ：全員の農場の比較表 |
| `MarketPanel` | 8品目の相場（基準との差・売値） |
| `CharacterCard` / `ImprovementCard` / `WeatherCard` | カード（キャラ12・設備29・天候21種） |
| `Tabs` / `ActionBar` / `Button` / `Tag` / `Icon` / `Worker` | 基本部品 |

## カタログ（見た目の確認）

AI同士で途中まで進めた本物の局面で部品を並べます。

```bash
npm run catalog -w @midorino/ui        # 開発サーバー
# ?s=人数,ラウンド,置いた数,自分の席(-1=手番の人)  例: ?s=6,10,9,-1
# #cards でカード全種
```

## 霧谷の冒険者団（新しい画面）

新しいゲーム「霧谷の冒険者団」の画面・演出・音・仮の絵は `src/kiridani/` にあります（農場版の部品とは独立）。
詳しくは [src/kiridani/README.md](src/kiridani/README.md)。カタログは `kiridani.html`（`npm run catalog -w @midorino/ui` のあと `/kiridani.html`）。

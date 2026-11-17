# 霧谷の冒険者団 — 画面・演出・音（packages/ui/src/kiridani）

農場版（ミドリノ谷の四季）の部品には手を付けず、新しいゲームの画面をここに作っています。
画面は **出来事の列（GameEvent）** を受け取って動く作りで、出来事はエンジン（`packages/engine/src/kiridani`、Python 版の写し）が出します。

## エンジン（packages/engine/src/kiridani）

- `engine.ts`・`ai.ts`：engine.py・ai.py を1行ずつ写したもの。乱数は `rng.ts` の mulberry32。
- `data.ts`：数値の置き場はここ1つ（画面の `data.ts` は読み直すだけ）。`npm run kiridani:sync` で
  Python 版の写し（tools/kiridani/py）を取り直し、data.ts と一致テストの記録を作り直す。
- 一致テスト：`tools/kiridani/trace.py` が Python 版を同じ乱数で 20 試合流して手順・状態・得点を記録し、
  `packages/engine/test/kiridani-golden.test.ts` が TypeScript 版で同じになるのを確かめる。
- `session.ts`：`KiridaniSession`（人間の席＋AI。ひとり遊びは人間1席）。`start()`／`answer(x)` が次に人間が選ぶ場面まで進めて出来事を返す。
- 画面側は `play.tsx` の `KiridaniEngineGame`：ドラフト・キャラ・置き場所は既存の画面、
  それ以外（何人で・どの方針で戦うか、共闘に加わるか、遺跡のカード、使い魔・天候の鈴などのはい/いいえ）は `ui/choice.tsx` のシート。
  巣・主の巣と市場は `ui/tray.tsx` の「トレイ」：使うもの（仲間の数・矢・ポーション・士気・秘術・武具の力・待ち伏せ）や売り買いする資源をタップでオン・オフし、
  戦力と強さ・勝つ見込み・反撃・費用がその場で変わる。エンジンは `session.fight()`／`session.market()` で受け取り、置けるか・払えるかを確かめる（AI の道筋は使わない）。
  あなたの番には「⇄ 取引」で AI と資源を交換できる（`session.judgeTrade()` が相手の AI の取引の評価で受ける／断るを決める。乱数は使わない）。
  オンライン対戦（友だちと遊ぶ）はミドリノと同じ仕組み：ホストの端末が審判（`net.ts` の `KiridaniReferee`、人間の席が複数の `KiridaniSession`）で、
  参加者には席ごとに隠した出来事（他の席の手札・ドラフトの手は伏せる）と「いま選ぶこと」（`Prompt`：選択肢と、その席から見た盤面の写し）だけを送る。
  参加者の画面（`online.tsx` の `KiridaniOnlineGame`）は写しから組み立てた `ShadowSession` で同じトレイ・シートを出し、答え（`Action`）だけを返す。
  ドラフトとキャラ選びは全員同時（先に届いた答えは審判が預かる）。AI との取引の受ける／断るはホストに問い合わせる。人どうしの取引は申し込み制：自分の番に取引のトレイで人を選んで「申し込む」→ 審判が確かめて相手にだけ届け（`OfferView`）、相手は受ける／断る（`ui/tray.tsx` の `OfferIncoming`。演出のあとに、ほかのシートの上に出る）。申し込んだ人は返事を待ち（`OfferWait`、取り下げ可）、60 秒で自動的に断ったことになる。受けたときにもう一度確かめてから交換し、取引の出来事が全員に流れる。断られた・流れた申し込みは回数に数えず、中身は当事者以外に届かない。
  通信は `packages/app/src/net/kiridaniHost.ts`・`kiridaniGuest.ts`（PeerJS は `peerNet.ts`、テストは同じ JS の中の `memoryNet`）。
  チャット：⚙ のメニューの「チャット」（待合室では見出しの 💬）で `ui/chat.tsx` の `ChatSheet` を開く。新しい発言が下に入り、古いものは上へ流れる。閉じているあいだに届いた発言は `ChatFloat` が下の欄の上から流して消し、⚙ と「チャット」に未読のしるし。ホストが受け取り、整えて（制御文字を除き100文字まで・10秒に5通まで）全員に配り、最後の100件を残してつなぎ直した人に送る（`packages/app/src/net/chat.ts`）。ゲームの状態・審判の記録には入らない。
  通しテスト：`node tools/kiridani/online-smoke.mjs`（手元の PeerJS サーバーとブラウザ2つで、招待→承認→最後まで→再読み込み→ホスト退出）。
  カード・キャラ・魔物・巣・行動スペース・天候・冬の食料は、タップで `ui/inspect.tsx` の詳しいシートが開く（要素に `data-inspect="card:i19"` などの印を付けるだけ）。

## しくみ

```
エンジン ──GameEvent[]──▶ useTable(me).push(events)
                              │  AnimQueue：1つずつ順に再生（速さ3段階・1ラウンド約1分半の予算・操作の予約）
                              ▼
                   applyEvent(view, ev) → GameView（表示用の状態。ルールは計算しない）
                              ▼
          <KiridaniTable t={t} ask={...} onAnswer={...} />  ＋ 飛ぶ演出（runFx）・効果音（SoundPlayer）
```

| ファイル | 内容 |
|---|---|
| `data.ts` | data.py の写し（行動スペース20・巣・魔物30・主・天候・キャラ12・職能30・品物30・依頼15）。`python3 tools/kiridani_data_to_ts.py <data.py> packages/ui/src/kiridani/data.ts` で作り直せる |
| `types.ts` | `GameView`（画面の状態）と `GameEvent`（出来事 50種ほど）。エンジンはこの形で流す |
| `reduce.ts` | `applyEvent(view, ev)`：出来事を状態に当てる純粋関数。自分以外の手札は `'?'` になる |
| `anim/timing.ts` | 出来事ごとの標準の長さ（設計書の表）、速さ（標準・速い・最小）、他人の手番は 0.7 倍、予算で縮める計算 |
| `anim/queue.ts` | `AnimQueue`：順番に再生、`submit()` で演出中の操作を預かり終わったら即実行、`skip()`、1ラウンドの合計が 60 秒を超えそうなら残りを自動で縮める（最小でも 0.2 秒は残す） |
| `sound.ts` | `SoundPlayer`：名前つきの SE/BGM。ファイルが無ければ無音で続ける。`cuesFor(ev)` が出来事→音の対応 |
| `art-registry.tsx` | **絵の差し替え口**。画面は全部ここから絵を引く |
| `placeholder/` | 仮の絵（シルエットとアイコン、すべてインライン SVG） |
| `ui/useTable.ts` | React フック：キュー・状態・音をまとめる |
| `ui/table.tsx` | ゲーム画面全体（状況バー・プレイヤー列・タブ・自分の持ち物・重ねる演出）と、出来事ごとの飛ぶ演出 `runFx` |
| `ui/screens.tsx` | ドラフト・キャラ選択・盤面・拠点・依頼・みんな・戦闘・冬・最終集計 |
| `ui/fx.tsx` | 飛ぶ・浮かぶ・弾ける演出の層（Web Animations API。外部ライブラリなし） |
| `sample/sim.ts` | 見本の試合の台本（`?sample=1` のときだけ使う。ルールは大まか） |
| `play.tsx`・`ui/choice.tsx` | 本物のエンジンで遊ぶ画面と、選択のシート |

### エンジンとつなぐとき

1. エンジンは各操作の結果を `GameEvent[]` で返す（数値はすべてイベントに載せる：得た資源・払った量・戦力の内訳 `power.parts`・運命の札など）。
2. アプリは `t.push(events)`。自分の選択が必要なら `ask={{ kind: 'draft' | 'char' | 'place', options }}` を渡し、`onAnswer` で受けた答えを `t.submit(() => send(answer))` で送る（演出中なら終わってから送られる）。
3. 途中から参加・再接続は `t.load(これまでの出来事)` で演出なしに追いつく。

### 演出の時間

- 速さ：標準は設計書の目安の 1.5 倍（集計は 9 秒まで）／速い はその 2/3（＝目安どおり）／最小は各 0.2 秒（集計 2.5 秒・主の登場 0.7 秒）。
- 他の人の手番は 0.7 倍。自分が関わる戦闘・襲撃・全体の出来事は速めない。
- 1ラウンドの予算 90 秒：残りの出来事の長さを足して超えるなら、下限を残して縮める。テスト（`packages/ui/test/kiridani.test.ts`）で 6 人・3 段階すべてが 90 秒以内なのを確かめている。
- 「視差効果を減らす」設定：飛ばさずに行き先で光るだけ、揺れ・ズーム・降るものは止める。

## 絵の差し替え

`art-registry.tsx` の `import * as A from './placeholder'` を `'./art'` に替えるだけ（`src/kiridani/art/index.ts` に下の名前をまとめて export しておく）。

| 部品 | props | id |
|---|---|---|
| `HeroArt` `JobArt` `ItemArt` `MonsterArt` `BossArt` | `{ id, size, label?, frame? }` | data.py の id（toma, o01, i01, rat, b_bear…） |
| `KIcon` | `{ name, size, label? }` | wood iron herb mana food gold mat / fire ice thunder light dark / beast undead spirit dragon humanoid / fame power defense injury companion bed wall trophy fate skill quest upkeep discontent raid familiar |
| `WeatherScene` | `{ id, season?, width }` | 天候16種 |
| `NestScene` | `{ id, width }` | nest_forest nest_cave nest_swamp nest_mount lair |
| `EffectArt` | `{ id, size }` | 下の一覧 |
| `WeatherArt` `TerrainArt` `CardBackArt` | `{ id, size }` | 本番の絵がまだ無い部品（小さな天候アイコン・行動スペース20種の地形・カード裏 occ/item）|

演出の絵（`EffectArt`）の id：
slash fire ice thunder light dark heal shield injury fate-flip loot-drop trophy raid upkeep weather-change season-change
（画面が足した分：hit weakness counter spark coin discontent quest-stamp fame wall-block place-ring boss-aura card-glow。
本番の絵に無い id は自動で仮の絵になる）

## 効果音・BGM

音のファイルはまだ入っていません。`<base>/se/<名前>.mp3`・`<base>/bgm/<名前>.mp3`（base の既定は `./sounds`、`useTable(me, { soundBase })` で変更）に置くと鳴ります。無い間は無音で、画面は止まりません。

- **SE（効果音）**：ui_tap ui_queue card_deal card_pick card_flip card_play char_pick place gather coin pay forge build hire train market spell combat_start power_up weakness fate_flip fate_gold fate_crack slash fire ice thunder light dark miss counter injury heal loot trophy monster_spawn refill produce raid wall_block upkeep discontent weather season boss_roar quest fame first_pass score_tick rank victory
- **BGM**：title draft spring summer autumn winter boss final

### 無料素材の候補（ライセンスは必ず配布元で最新の規約を確認してください）

| 配布元 | 向いている音 | ライセンス（2026年11月時点の概要） | クレジット |
|---|---|---|---|
| Kenney（kenney.nl）「RPG Audio」「Impact Sounds」「Interface Sounds」 | 斬撃・コイン・カード・UI | CC0（パブリックドメイン相当） | 不要 |
| OpenGameArt.org | 魔法・モンスター・ファンタジーBGM | 素材ごとに CC0／CC-BY／CC-BY-SA／GPL など | CC-BY 系は必要。CC-BY-SA・GPL はアプリ側の条件に注意。素材ごとに確認 |
| Freesound.org | 天候（雨・雷・吹雪）・咆哮 | 音ごとに CC0／CC-BY／CC-BY-NC | CC-BY は必要。**CC-BY-NC は商用不可なので避ける** |
| Pixabay（効果音・音楽） | 環境音・BGM | Pixabay Content License（商用可・改変可、素材単体の再配布は不可） | 不要 |
| 魔王魂（maou.audio） | ファンタジーBGM・魔法・戦闘SE | 独自規約（商用可・改変可、素材そのものの再配布は不可） | 規約に従う（任意とされているが要確認） |
| 効果音ラボ（soundeffect-lab.info） | UI・コイン・打撃・魔法 | 独自規約（商用可、素材単体の再配布は不可） | 不要（規約を確認） |
| DOVA-SYNDROME（dova-s.jp） | 季節ごとのBGM・ボス戦 | 独自規約（商用可、曲ごとに作曲者の追加条件あり） | 任意（曲ごとに確認） |
| OtoLogic（otologic.jp） | UI・ジングル | CC BY 4.0 | 必要（「OtoLogic」） |
| incompetech（Kevin MacLeod） | 冒険・戦闘BGM | CC BY 4.0 | 必要 |
| Sonniss「GDC Game Audio Bundle」 | 高品質な剣・魔法・環境音 | 独自規約（ロイヤリティフリー・商用可、素材単体の再配布は不可） | 不要 |

おすすめの組み合わせ：UI・カード・コインは Kenney（CC0）、戦闘・魔法は魔王魂か効果音ラボ、BGM は DOVA-SYNDROME か魔王魂。
クレジットが必要な素材を使ったら、アプリの「この作品について」に一覧を載せてください。

## カタログ

```bash
npm run catalog -w @midorino/ui
# http://localhost:5173/kiridani.html               本物のエンジンで、あなた＋AI 3人の試合
#   ?n=6&level=expert&seed=3                         人数・AI の腕前（novice|mid|expert）・種
#   ?auto=1                                          自分の席も AI に任せて眺める
#   ?sample=1                                        エンジン無しの台本の試合（&manual=1 で自分の番を選ぶ）
#   ?at=draft|char|r5|combat|winter|boss|final       その場面の手前まで飛ばしてから再生
#   ?speed=fast|minimal                              演出の速さ
#   #gallery                                         仮の絵の一覧
```

右上の ⚙ から人数・場面・自分で選ぶかを切り替えられます。

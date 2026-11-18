# カード以外の絵（ラスター画像）の置き場

カードの絵（`cards/`）と同じ仕組み。ここに置いた画像はビルドでそのまま `dist/art/` に入り、画面が自動で使う。
画像が無いもの・一覧に無い id は今までどおり SVG の絵で表示する（一覧に無い id は取りに行かない）。

| フォルダ | id | 大きい版 | 小さい版 | 使う所 |
| --- | --- | --- | --- | --- |
| `monsters/` | 魔物・主・古竜の型の id（`rat`・`b_bear`・`b_ancient` …。`packages/engine/src/kiridani2/data.ts` の MONSTERS・BOSS_TYPES・ANCIENT_DRAGON） | `<id>.webp` 512×512 | `<id>-s.webp` 160×160（80px 以下で使う） | 巣・予告・戦闘・主の登場・討伐の証・詳しく見る |
| `spaces/` | 行動マスの id（SPACES）・巣 `nest_forest` `nest_cave` `nest_swamp` `nest_mount`・主の巣 `lair` | `<id>.webp` 640×400（16:10） | `<id>-s.webp` 256×160 | 行動マス（真ん中を正方形に切る）・巣の背景（5:3 に切る）・詳しく見る |
| `title/` | `key` | `key-p.webp` 縦 1080×1920・`key-l.webp` 横 1920×1080 | なし | タイトル・設定・部屋の入口の背景（横向きの画面は key-l） |
| `misc/` | `back-occ`・`back-item` | `<id>.webp` 512×512 | `<id>-s.webp` 160×160 | カードの裏 |

- 各フォルダに `index.json`（**必須**）：`{"v": "2026-11-20", "ids": ["rat", "b_bear"]}`。`v` は絵を差し替えたら変える（URL の `?v=`。サービスワーカーの手元の古い絵が取り直される）。
- 1つの id につき大・小の2枚とも置く（title は key-p と key-l）。
- 文字・枠は描かない（枠は画面が重ねる）。主・古竜には金の縁、魔物には細い紺の縁が重なる。
- 段階カードの場所は、カードの絵（`cards/<id>.webp`）を使う。

置いたら `packages/app` で `npm run build`。

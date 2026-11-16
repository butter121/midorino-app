// 絵の差し替え口。画面はすべてここから絵を引く（直接 ./placeholder や ./art を import しない）。
//
// 本番の絵（src/kiridani/art/）は同じ名前・同じ props で作られている。art/ に index.ts（下の名前をまとめて
// export するだけのファイル）を置いたら、次の1行の './placeholder' を './art' に替えれば画面全体が差し替わる。
import * as A from './art';
// 仮の絵（本番に無い id・部品の受け皿として残す）
import * as P from './placeholder';

// 本番と同じ形の部品：<HeroArt|JobArt|ItemArt|MonsterArt|BossArt id size label? frame? />・<KIcon name size label? />
//   <WeatherScene id season? width />・<NestScene id width />・<EffectArt id size />
export const { HeroArt, JobArt, ItemArt, MonsterArt, BossArt, KIcon, KICON_NAMES, WeatherScene, NestScene, ITEM_KIND, RACE_BG, RACE_JP } = A;

/** 演出の絵。本番に無い id（place-ring など画面が足した分）は仮の絵で描く */
export function EffectArt({ id, size }: { id: string; size?: number }) {
  return (A.EFFECT_IDS as readonly string[]).includes(id) && A.EffectArt !== P.EffectArt
    ? <A.EffectArt id={id} size={size} />
    : <P.EffectArt id={id} size={size} />;
}

// 小さな天候アイコン・行動スペースの地形・カード裏も本番の絵を使う。演出 id の一覧は画面側（仮の絵）の定義を正とする
export const { WeatherArt, TerrainArt, CardBackArt } = A;
export const { EFFECT_IDS } = P;
export type { EffectId, ArtProps } from './placeholder';

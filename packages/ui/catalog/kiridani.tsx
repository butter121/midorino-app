import { createRoot } from 'react-dom/client';
import { HeroArt, HERO_IDS, HERO_LOOKS } from '../src/kiridani/art/heroes';
import { BossArt, BOSS_IDS, BOSS_NAMES } from '../src/kiridani/art/bosses';
import { KIcon, KICON_NAMES, KICON_JP } from '../src/kiridani/art/icons';
import { JobArt, JOB_IDS, JOB_LOOKS } from '../src/kiridani/art/jobs';
import { ItemArt, ITEM_IDS, ITEM_NAMES } from '../src/kiridani/art/items';
import { WeatherScene, WEATHER_JP, NestScene, NEST_IDS, NEST_JP } from '../src/kiridani/art/scenes';
import { EffectArt, EFFECT_IDS, EFFECT_JP } from '../src/kiridani/art/effects';
import { MonsterArt, MONSTER_IDS, MONSTER_LOOKS } from '../src/kiridani/art/monsters';

const box: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, fontFamily: '"Zen Maru Gothic",sans-serif', color: '#1E2433' };
const sec = new URLSearchParams(location.search).get('s') ?? 'heroes';
function App() {
  if (sec === 'scenes') return (
    <div style={box}>
      {Object.keys(WEATHER_JP).map((id) => <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 12 }}><WeatherScene id={id} season="autumn" width={200} />{WEATHER_JP[id]}</figure>)}
      {NEST_IDS.map((id) => <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 12 }}><NestScene id={id} width={200} />{NEST_JP[id]}</figure>)}
      {EFFECT_IDS.map((id) => <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 12, background: '#3E4A6B', color: '#fff', padding: 6, borderRadius: 8 }}><EffectArt id={id} size={90} />{EFFECT_JP[id]}</figure>)}
    </div>
  );
  if (sec === 'sheet') return <Sheet />;
  if (sec === 'bosses') return (
    <div style={box}>{BOSS_IDS.map((id) => (
      <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 12 }}>
        <BossArt id={id} size={180} /><figcaption>{BOSS_NAMES[id]}</figcaption>
      </figure>))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, width: '100%' }}>{KICON_NAMES.map((n) => (
        <span key={n} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: 11, width: 56 }}><KIcon name={n} size={40} />{KICON_JP[n]}</span>))}</div>
      <div style={{ display: 'flex', gap: 10 }}>{KICON_NAMES.slice(0, 12).map((n) => <KIcon key={n} name={n} size={24} />)}</div>
    </div>
  );
  if (sec === 'jobs' || sec === 'items') {
    const ids = sec === 'jobs' ? JOB_IDS : ITEM_IDS;
    return (<div style={box}>{ids.map((id) => (
      <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 12, width: 130 }}>
        {sec === 'jobs' ? <JobArt id={id} size={130} /> : <ItemArt id={id} size={130} />}
        <figcaption>{id} {sec === 'jobs' ? JOB_LOOKS[id].name : ITEM_NAMES[id]}</figcaption>
      </figure>))}</div>);
  }
  if (sec === 'monsters') return (
    <div style={box}>{MONSTER_IDS.map((id) => (
      <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 12, width: 130 }}>
        <MonsterArt id={id} size={130} /><figcaption>{MONSTER_LOOKS[id].name}</figcaption>
      </figure>))}</div>
  );
  return (
    <div style={box}>
      {HERO_IDS.map((id) => (
        <figure key={id} style={{ margin: 0, textAlign: 'center', fontSize: 13 }}>
          <HeroArt id={id} size={150} />
          <figcaption><b>{HERO_LOOKS[id].name}</b><br />{HERO_LOOKS[id].role}</figcaption>
        </figure>
      ))}
    </div>
  );
}
const PAL: [string, string][] = [['#1E2433', '墨（線）'], ['#F3E9D2', '羊皮紙'], ['#DDE3EA', '霧'], ['#2B3550', '夜'], ['#4F7A5A', '苔'], ['#D9A441', '金'],
  ['#E0662F', '炎'], ['#5CC4E0', '氷'], ['#F2C94C', '雷'], ['#FFF1B8', '光'], ['#7B4FA6', '闇']];
const H: React.CSSProperties = { fontSize: 15, fontWeight: 900, margin: '18px 0 8px', borderBottom: '2px solid #1E2433', paddingBottom: 2 };
const cap: React.CSSProperties = { margin: 0, textAlign: 'center', fontSize: 12, lineHeight: 1.3 };
function Card({ art, name, kind, text, quirk }: { art: React.ReactNode; name: string; kind: string; text: string; quirk?: boolean }) {
  return (
    <div style={{ width: 168, background: '#F3E9D2', border: '3px solid #1E2433', borderRadius: 14, padding: 6, boxShadow: quirk ? '0 0 0 3px #D9A441' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}><span>{kind}</span>{quirk && <span style={{ color: '#9A5A00' }}>★くせ者</span>}</div>
      <div style={{ borderRadius: 10, overflow: 'hidden', margin: '4px 0' }}>{art}</div>
      <div style={{ fontWeight: 900, fontSize: 15 }}>{name}</div>
      <div style={{ fontSize: 12, lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}
function Sheet() {
  return (
    <div style={{ ...box, display: 'block', width: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>霧谷の冒険者団　絵の方向性</h1>
        <span style={{ fontSize: 13 }}>「霧の絵本」：太くやわらかい紺の線＋平らな塗り＋霧のかかった丸い背景。すべてオリジナルのSVG（拡大してもにじまない）</span>
      </div>
      <div style={H}>色（線は墨、属性は5色。属性は色だけでなく形のアイコンでも示す）</div>
      <div style={{ display: 'flex', gap: 8 }}>{PAL.map(([c, n]) => <div key={c} style={{ textAlign: 'center', fontSize: 11 }}><div style={{ width: 70, height: 34, background: c, border: '2px solid #1E2433', borderRadius: 8 }} />{n}</div>)}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 12 }}>{['fire', 'ice', 'thunder', 'light', 'dark'].map((n) => <span key={n} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: 11 }}><KIcon name={n} size={34} />{KICON_JP[n]}</span>)}</div>
      </div>
      <div style={H}>冒険者12人（名前と役割はそのまま、見た目をファンタジーに）</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{HERO_IDS.map((id) => <figure key={id} style={cap}><HeroArt id={id} size={88} /><b>{HERO_LOOKS[id].name}</b><br />{HERO_LOOKS[id].role}</figure>)}</div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={H}>カードにするとこう（職能・品物）</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Card art={<JobArt id="o01" size={152} />} kind="職能" name="見習い炎術士" text="魔石1で炎+2。炎の弱点で倒すと魔石1が戻る" />
            <Card art={<ItemArt id="i05" size={152} />} kind="品物・武具" name="雷鳴の戦槌" text="雷+2。嵐の日は+4" />
            <Card art={<JobArt id="o26" size={152} />} kind="職能" name="呪われた勇者" text="戦力+5。毎ラウンド食料か薬草を払わないと仲間が休む" quirk />
          </div>
        </div>
        <div>
          <div style={H}>主（ボス）は金の縁と暗い背景</div>
          <div style={{ display: 'flex', gap: 8 }}>{['b_bear', 'b_wyrm', 'b_ancient'].map((id) => <figure key={id} style={cap}><BossArt id={id} size={150} />{BOSS_NAMES[id]}</figure>)}</div>
        </div>
      </div>
      <div style={H}>魔物（種族で背景色を変える：獣＝緑／亡者＝薄紫／精霊＝青緑／竜＝赤茶／人型＝土色）</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['rat', 'wolf', 'skel', 'wraith', 'slime', 'wisp', 'goblin', 'ogre', 'wyvern', 'hydra', 'lich', 'shade'].map((id) => <figure key={id} style={cap}><MonsterArt id={id} size={88} />{MONSTER_LOOKS[id].name}</figure>)}</div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={H}>職能30枚（一部）</div>
          <div style={{ display: 'flex', gap: 6 }}>{['o02', 'o06', 'o11', 'o16', 'o19', 'o27', 'o29'].map((id) => <figure key={id} style={cap}><JobArt id={id} size={72} />{JOB_LOOKS[id].name}</figure>)}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={H}>品物30枚（一部：武具は灰青／道具は木色／秘術は紫）</div>
          <div style={{ display: 'flex', gap: 6 }}>{['i02', 'i06', 'i13', 'i14', 'i20', 'i24', 'i27'].map((id) => <figure key={id} style={cap}><ItemArt id={id} size={72} />{ITEM_NAMES[id]}</figure>)}</div>
        </div>
      </div>
      <div style={H}>資源・状態のアイコン（24pxでも見分けられる形）</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat', 'beast', 'undead', 'spirit', 'dragon', 'humanoid', 'fame', 'power', 'defense', 'injury', 'companion', 'wall', 'trophy', 'fate'].map((n) => <span key={n} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: 11, width: 50 }}><KIcon name={n} size={32} />{KICON_JP[n]}</span>)}</div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);

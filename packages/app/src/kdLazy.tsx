// 霧谷の冒険者団：試合の画面は使うときに読み込む（旧ルール v1 と新ルール v2 で別のまとまり。タイトルと待合室は軽く保つ）
import { lazy, Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = ComponentType<any>;
function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, key: K) {
  return lazy(() => load().then((m) => ({ default: m[key] as unknown as AnyComp })));
}

const loadV1Play = () => import('@midorino/ui/src/kiridani/play');
const loadV1Online = () => import('@midorino/ui/src/kiridani/online');
const loadV2Play = () => import('@midorino/ui/src/kiridani2/play2');
const loadV2Online = () => import('@midorino/ui/src/kiridani2/online2');

type V1Play = typeof import('@midorino/ui/src/kiridani/play')['KiridaniEngineGame'];
type V1Online = typeof import('@midorino/ui/src/kiridani/online')['KiridaniOnlineGame'];
type V2Play = typeof import('@midorino/ui/src/kiridani2/play2')['Kiridani2EngineGame'];
type V2Online = typeof import('@midorino/ui/src/kiridani2/online2')['Kiridani2OnlineGame'];

const L1Play = lazyNamed(loadV1Play, 'KiridaniEngineGame');
const L1Online = lazyNamed(loadV1Online, 'KiridaniOnlineGame');
const L2Play = lazyNamed(loadV2Play, 'Kiridani2EngineGame');
const L2Online = lazyNamed(loadV2Online, 'Kiridani2OnlineGame');

const Loading = () => <div className="kd-root kda-title" role="status"><p className="kda-sub">読み込んでいます…</p></div>;
function wrap<C extends AnyComp>(L: AnyComp) {
  return function Lazy(props: ComponentProps<C>): ReactNode {
    return <Suspense fallback={<Loading />}><L {...props} /></Suspense>;
  };
}

export const KiridaniEngineGame = wrap<V1Play>(L1Play);
export const KiridaniOnlineGame = wrap<V1Online>(L1Online);
export const Kiridani2EngineGame = wrap<V2Play>(L2Play);
export const Kiridani2OnlineGame = wrap<V2Online>(L2Online);
/** 試合の画面を先に読み込んでおく（待合室にいる間など） */
export const preload = (rules: 1 | 2) => { void (rules === 2 ? Promise.all([loadV2Play(), loadV2Online()]) : Promise.all([loadV1Play(), loadV1Online()])).catch(() => {}); };

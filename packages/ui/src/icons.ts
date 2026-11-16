// ミドリノ谷の四季 アイコン（オリジナル・SVGスプライト）。<IconSprite/> を1回置けば <Icon name=".."/> で使える。
// 線の色は --ink（#2B3A3A）。家族コマ(i-worker)と部屋(i-room)は currentColor で色を変える。
export const ICON_NAMES = ["i-wood", "i-clay", "i-stone", "i-grain", "i-veg", "i-sheep", "i-pig", "i-cattle", "i-food", "i-coin", "i-worker", "i-vp", "i-beg", "i-room", "i-field", "i-pasture", "i-tool", "i-stall", "i-baby", "i-trade", "s-spring", "s-summer", "s-autumn", "s-winter", "w-rain", "w-sun", "w-drought", "w-frost", "w-typhoon", "w-snow", "w-calm"] as const;
export type IconName = (typeof ICON_NAMES)[number];

export const SPRITE = `<defs>
    <style>
      .mi-k{stroke:#2B3A3A;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
      .mi-kt{stroke:#2B3A3A;stroke-width:2;stroke-linecap:round;fill:none}
    </style>
  </defs>

  <!-- 木材：切り株の輪切り2本 -->
  <symbol id="i-wood" viewBox="0 0 48 48">
    <rect class="mi-k" x="5" y="20" width="30" height="16" rx="8" fill="#C98A4B"/>
    <ellipse class="mi-k" cx="35" cy="28" rx="7" ry="8" fill="#F2C98F"/>
    <path class="mi-kt" d="M35 24.5a3.5 3.5 0 1 1 -0.1 0"/>
    <rect class="mi-k" x="10" y="9" width="26" height="14" rx="7" fill="#B3753C"/>
    <ellipse class="mi-k" cx="36" cy="16" rx="6" ry="7" fill="#F2C98F"/>
    <path class="mi-kt" d="M14 30h10M16 15h9"/>
  </symbol>

  <!-- 粘土：丸い粘土のかたまり＋指あと -->
  <symbol id="i-clay" viewBox="0 0 48 48">
    <path class="mi-k" d="M8 34c-2-9 5-19 16-20 11-1 18 7 16 17-1 5-6 7-16 7S9 39 8 34z" fill="#D9774B"/>
    <path d="M14 22c3-4 8-5 12-4" stroke="#F3A97F" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="29" cy="29" rx="4" ry="3" fill="#B85A33"/>
  </symbol>

  <!-- 石材：重なった丸石 -->
  <symbol id="i-stone" viewBox="0 0 48 48">
    <path class="mi-k" d="M6 36c0-7 5-12 12-12s11 5 11 12z" fill="#8E989E"/>
    <path class="mi-k" d="M20 36c0-9 6-16 13-16s10 7 10 16z" fill="#B4BDC2"/>
    <path d="M27 26c2-2 5-2 7-1" stroke="#E2E7EA" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path class="mi-kt" d="M4 36h41"/>
  </symbol>

  <!-- 麦：穂が3本 -->
  <symbol id="i-grain" viewBox="0 0 48 48">
    <path class="mi-kt" d="M24 44V18M24 40c-6-3-9-8-10-14M24 40c6-3 9-8 10-14"/>
    <g class="mi-k" fill="#E8C25A">
      <ellipse cx="24" cy="12" rx="4" ry="7"/>
      <ellipse cx="13" cy="20" rx="3.5" ry="6" transform="rotate(-25 13 20)"/>
      <ellipse cx="35" cy="20" rx="3.5" ry="6" transform="rotate(25 35 20)"/>
    </g>
    <path d="M22.5 9v5" stroke="#FFF1BF" stroke-width="2" stroke-linecap="round"/>
  </symbol>

  <!-- 野菜：にんじん -->
  <symbol id="i-veg" viewBox="0 0 48 48">
    <path class="mi-k" d="M15 18c5-4 13-4 17 1L18 44c-3 1-5-1-5-4z" fill="#F08A3C" transform="rotate(-8 24 30)"/>
    <path class="mi-kt" d="M19 26l5 2M17 33l4 1"/>
    <path class="mi-k" d="M24 17c-2-6-1-11 3-13M24 17c1-6 6-9 11-8M24 17c-5-3-10-2-13 1" fill="none" stroke="#3E8E57" stroke-width="3.2"/>
  </symbol>

  <!-- 羊：もこもこの雲 -->
  <symbol id="i-sheep" viewBox="0 0 48 48">
    <path class="mi-kt" d="M15 36v6M33 36v6"/>
    <path class="mi-k" d="M10 30c-5 0-6-8 0-9 0-6 7-8 10-4 3-5 11-4 12 1 6-1 9 6 4 9 2 6-5 9-8 6-3 4-10 4-12 0-3 2-7 0-6-3z" fill="#FFFDF5"/>
    <ellipse class="mi-k" cx="38" cy="22" rx="6" ry="7" fill="#4A4F57"/>
    <circle cx="40" cy="21" r="1.4" fill="#fff"/>
  </symbol>

  <!-- 豚：まるい顔 -->
  <symbol id="i-pig" viewBox="0 0 48 48">
    <path class="mi-k" d="M10 14l2-8 7 5zM38 14l-2-8-7 5z" fill="#F29CB0"/>
    <circle class="mi-k" cx="24" cy="26" r="16" fill="#F7B6C4"/>
    <ellipse class="mi-k" cx="24" cy="31" rx="7" ry="5" fill="#EE8FA6"/>
    <circle cx="21.5" cy="31" r="1.5" fill="#2B3A3A"/><circle cx="26.5" cy="31" r="1.5" fill="#2B3A3A"/>
    <circle cx="17" cy="22" r="2" fill="#2B3A3A"/><circle cx="31" cy="22" r="2" fill="#2B3A3A"/>
  </symbol>

  <!-- 牛：茶色の顔に白い鼻・小さな角 -->
  <symbol id="i-cattle" viewBox="0 0 48 48">
    <path class="mi-k" d="M11 13c-3-1-5-4-5-7 3 1 6 2 8 4zM37 13c3-1 5-4 5-7-3 1-6 2-8 4z" fill="#F4E6C8"/>
    <path class="mi-k" d="M10 18c0-6 6-9 14-9s14 3 14 9v8c0 8-6 14-14 14s-14-6-14-14z" fill="#A8724A"/>
    <path d="M18 11c3 3 2 8-2 9" fill="#F4E6C8"/>
    <ellipse class="mi-k" cx="24" cy="33" rx="10" ry="7" fill="#F4D7C2"/>
    <circle cx="20" cy="33" r="1.6" fill="#2B3A3A"/><circle cx="28" cy="33" r="1.6" fill="#2B3A3A"/>
    <circle cx="17" cy="22" r="2" fill="#2B3A3A"/><circle cx="31" cy="22" r="2" fill="#2B3A3A"/>
  </symbol>

  <!-- 食料：おむすび -->
  <symbol id="i-food" viewBox="0 0 48 48">
    <path class="mi-k" d="M24 6c5 0 18 22 18 28 0 6-8 8-18 8S6 40 6 34C6 28 19 6 24 6z" fill="#FFFDF7"/>
    <path class="mi-k" d="M14 30h20v12c-3 1-6 1-10 1s-7 0-10-1z" fill="#2F4A3F"/>
    <circle cx="20" cy="18" r="1.4" fill="#E8C25A"/>
  </symbol>

  <!-- コイン：葉の刻印 -->
  <symbol id="i-coin" viewBox="0 0 48 48">
    <circle class="mi-k" cx="24" cy="24" r="17" fill="#F2C14E"/>
    <circle cx="24" cy="24" r="12" fill="none" stroke="#D69A1F" stroke-width="2"/>
    <path d="M18 29c0-8 6-12 12-12 0 7-5 12-12 12zM18 29l8-8" stroke="#8A5A00" stroke-width="2" fill="#FFE08A" stroke-linejoin="round" stroke-linecap="round"/>
  </symbol>

  <!-- 家族コマ：頭に芽が生えた丸い子（色は currentColor） -->
  <symbol id="i-worker" viewBox="0 0 48 48">
    <path class="mi-k" d="M24 13c-1-4 1-8 5-9 0 4-2 7-5 9zM24 13c-1-3-4-5-7-4 1 3 4 4 7 4z" fill="#6CC17A"/>
    <path class="mi-k" d="M10 42c0-10 6-17 14-17s14 7 14 17z" fill="currentColor"/>
    <circle class="mi-k" cx="24" cy="22" r="10" fill="currentColor"/>
    <circle cx="20.5" cy="22" r="1.7" fill="#2B3A3A"/><circle cx="27.5" cy="22" r="1.7" fill="#2B3A3A"/>
    <ellipse cx="18" cy="25.5" rx="2" ry="1.2" fill="#fff" opacity=".45"/>
    <ellipse cx="30" cy="25.5" rx="2" ry="1.2" fill="#fff" opacity=".45"/>
  </symbol>

  <!-- 勝利点：葉の勲章 -->
  <symbol id="i-vp" viewBox="0 0 48 48">
    <path class="mi-k" d="M24 4l5 9 10 2-7 7 2 10-10-5-10 5 2-10-7-7 10-2z" fill="#6CC17A"/>
    <path class="mi-k" d="M17 30l-4 14 7-4 4 5 0-12M31 30l4 14-7-4-4 5" fill="#3E8E57"/>
  </symbol>

  <!-- 借り：割れた皿 -->
  <symbol id="i-beg" viewBox="0 0 48 48">
    <ellipse class="mi-k" cx="24" cy="28" rx="18" ry="10" fill="#E9E2D0"/>
    <path class="mi-kt" d="M22 18l4 6-5 4 4 8"/>
  </symbol>

  <!-- 部屋（家）：素材は currentColor -->
  <symbol id="i-room" viewBox="0 0 48 48">
    <path class="mi-k" d="M6 22L24 8l18 14" fill="none"/>
    <path class="mi-k" d="M10 20h28v22H10z" fill="currentColor"/>
    <path class="mi-k" d="M4 23L24 7l20 16-4 2L24 12 8 25z" fill="#C2553E"/>
    <rect class="mi-k" x="20" y="29" width="8" height="13" rx="3" fill="#7A4E2D"/>
    <rect class="mi-k" x="13" y="25" width="5" height="5" rx="1" fill="#FFE6A6"/>
  </symbol>

  <!-- 畑 -->
  <symbol id="i-field" viewBox="0 0 48 48">
    <path class="mi-k" d="M4 16h40l-4 26H8z" fill="#8C5E3C"/>
    <path d="M10 23h28M9 30h30M8 37h32" stroke="#6E4529" stroke-width="2.5" stroke-linecap="round"/>
  </symbol>

  <!-- 牧場（柵） -->
  <symbol id="i-pasture" viewBox="0 0 48 48">
    <rect x="3" y="26" width="42" height="17" rx="4" fill="#A9D67B"/>
    <path class="mi-k" d="M8 16v26M24 16v26M40 16v26" fill="none"/>
    <path class="mi-k" d="M4 24h40M4 34h40" fill="none" stroke="#C98A4B" stroke-width="3.2"/>
  </symbol>

  <!-- 工房：金づちとのこぎり -->
  <symbol id="i-tool" viewBox="0 0 48 48">
    <path class="mi-k" d="M8 40L30 18l4 4-22 22z" fill="#C98A4B"/>
    <path class="mi-k" d="M24 10l8-4 10 10-4 8-4-4-4 4-6-6 4-4z" fill="#8E989E"/>
  </symbol>
  <!-- 市場：屋台 -->
  <symbol id="i-stall" viewBox="0 0 48 48">
    <path class="mi-k" d="M8 22v20h32V22" fill="#FFF3DA"/>
    <path class="mi-k" d="M4 22l4-12h32l4 12z" fill="#5DA36A"/>
    <path d="M14 10l-2 12M24 10v12M34 10l2 12" stroke="#FFFDF7" stroke-width="3.5"/>
    <path class="mi-k" d="M4 22h40" fill="none"/>
    <path class="mi-k" d="M14 30h20v5H14z" fill="#E8C25A"/>
  </symbol>
  <!-- 家族を増やす：ゆりかごの芽 -->
  <symbol id="i-baby" viewBox="0 0 48 48">
    <path class="mi-k" d="M24 18c-1-5 1-9 6-10 0 5-3 8-6 10zM24 18c-1-4-5-6-9-5 1 4 5 5 9 5z" fill="#6CC17A"/>
    <path class="mi-k" d="M6 26h36c0 9-8 16-18 16S6 35 6 26z" fill="#F6C142"/>
    <circle class="mi-k" cx="24" cy="25" r="7" fill="#FCE6EC"/>
  </symbol>
  <!-- 交換 -->
  <symbol id="i-trade" viewBox="0 0 48 48">
    <path class="mi-kt" d="M8 17h28l-6-6M40 31H12l6 6" stroke-width="3.2"/>
  </symbol>

  <!-- 季節 -->
  <symbol id="s-spring" viewBox="0 0 48 48">
    <g class="mi-k" fill="#F6A7BB">
      <circle cx="24" cy="12" r="7"/><circle cx="35" cy="20" r="7"/><circle cx="31" cy="33" r="7"/>
      <circle cx="17" cy="33" r="7"/><circle cx="13" cy="20" r="7"/>
    </g>
    <circle cx="24" cy="24" r="5" fill="#F2C14E" class="mi-k"/>
  </symbol>
  <symbol id="s-summer" viewBox="0 0 48 48">
    <circle class="mi-k" cx="24" cy="24" r="10" fill="#F6C142"/>
    <path class="mi-kt" d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" stroke-width="3"/>
  </symbol>
  <symbol id="s-autumn" viewBox="0 0 48 48">
    <path class="mi-k" d="M24 4l4 10 8-4-2 10 9 2-7 6 3 8-10-3-1 11h-4l-1-11-10 3 3-8-7-6 9-2-2-10 8 4z" fill="#E5803A"/>
    <path class="mi-kt" d="M24 18v26"/>
  </symbol>
  <symbol id="s-winter" viewBox="0 0 48 48">
    <path class="mi-kt" d="M24 4v40M7 14l34 20M7 34l34-20" stroke-width="3.2" stroke="#4E77B8"/>
    <path class="mi-kt" d="M19 7l5 5 5-5M19 41l5-5 5 5M5 20l7 0-1-7M43 28l-7 0 1 7M5 28l7 0-1 7M43 20l-7 0 1-7" stroke="#4E77B8"/>
  </symbol>

  <!-- 天候 -->
  <symbol id="w-rain" viewBox="0 0 48 48">
    <path class="mi-k" d="M12 28c-6 0-7-9 0-10 1-7 10-10 15-5 6-3 13 1 12 8 5 1 4 7 0 7z" fill="#E6EEF5"/>
    <path class="mi-kt" d="M15 34l-3 7M24 34l-3 7M33 34l-3 7" stroke="#3A8FD0" stroke-width="3"/>
  </symbol>
  <symbol id="w-sun" viewBox="0 0 48 48">
    <circle class="mi-k" cx="24" cy="24" r="11" fill="#F6C142"/>
    <path class="mi-kt" d="M24 3v6M24 39v6M3 24h6M39 24h6M9 9l4 4M35 35l4 4M39 9l-4 4M13 35l-4 4" stroke-width="3" stroke="#E89A1A"/>
  </symbol>
  <symbol id="w-drought" viewBox="0 0 48 48">
    <circle class="mi-k" cx="24" cy="15" r="9" fill="#F28C3A"/>
    <path class="mi-kt" d="M24 1v3M10 5l2 3M38 5l-2 3M5 15h3M40 15h3" stroke="#E5622A" stroke-width="2.6"/>
    <path class="mi-k" d="M3 38c6-5 36-5 42 0v5H3z" fill="#D9B27A"/>
    <path class="mi-kt" d="M14 38l3 2-2 3M31 37l-2 3 3 3"/>
    <path class="mi-kt" d="M24 38c0-6 1-9 0-12" stroke="#7FA65A" stroke-width="2.6"/>
    <path class="mi-k" d="M24 29c-3 0-6 2-7 5 3 0 6-2 7-5z" fill="#A9C27A"/>
  </symbol>
  <symbol id="w-frost" viewBox="0 0 48 48">
    <path class="mi-k" d="M10 40c0-9 6-14 14-14s14 5 14 14z" fill="#9CCB86"/>
    <path class="mi-kt" d="M24 4v18M16 8l16 10M16 18l16-10" stroke="#5E8BD0" stroke-width="3"/>
  </symbol>
  <symbol id="w-typhoon" viewBox="0 0 48 48">
    <path class="mi-kt" d="M24 24m-4 0a4 4 0 1 0 8 0c0-8-14-10-18-2M24 24c0 8 14 10 18 2M24 24c8 0 10-14 2-18M24 24c-8 0-10 14-2 18" stroke="#4E77B8" stroke-width="3.2"/>
  </symbol>
  <symbol id="w-snow" viewBox="0 0 48 48">
    <path class="mi-k" d="M12 26c-6 0-7-9 0-10 1-7 10-10 15-5 6-3 13 1 12 8 5 1 4 7 0 7z" fill="#F4F7FB"/>
    <g fill="#8FB0E0" class="mi-k"><circle cx="14" cy="36" r="3"/><circle cx="25" cy="40" r="3"/><circle cx="35" cy="35" r="3"/></g>
  </symbol>
  <symbol id="w-calm" viewBox="0 0 48 48">
    <circle class="mi-k" cx="30" cy="18" r="8" fill="#F6C142"/>
    <path class="mi-k" d="M8 32c-5 0-5-8 1-8 1-5 8-7 12-3 5-2 10 1 10 6 4 0 4 5 0 5z" fill="#FFFFFF"/>
  </symbol>`;

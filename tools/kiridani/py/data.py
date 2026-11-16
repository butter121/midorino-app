"""霧谷の冒険者団 — データ定義（数値は v0.1 の仮値。シミュレーションで調整する）"""

NUM_ROUNDS = 12
SEASONS = ['spring', 'summer', 'autumn', 'winter']
SEASON_JP = dict(spring='春', summer='夏', autumn='秋', winter='冬')
TIDE = dict(spring='thunder', summer='fire', autumn='light', winter='ice')   # 魔力の潮
ELEMENTS = ['fire', 'ice', 'thunder', 'light', 'dark']
EL_JP = dict(fire='炎', ice='氷', thunder='雷', light='光', dark='闇')

RES = ['wood', 'iron', 'herb', 'mana', 'food', 'gold', 'mat']
RES_JP = dict(wood='木材', iron='鉄', herb='薬草', mana='魔石', food='食料', gold='金貨', mat='素材')

START_COMPANIONS = 2
MAX_COMPANIONS = 5
START_BEDS = 3
BASE_PLOTS = 12              # 拠点の区画数（寝床・施設・防壁）
START_FOOD = 3
START_GOLD = 2
SEAT_FOOD = {3: [0, 1, 1], 4: [0, 1, 1, 2], 5: [0, 1, 1, 2, 2], 6: [0, 1, 1, 2, 2, 3]}
UPKEEP = 2                   # 仲間1人あたりの冬の食料
DISCONTENT = 3               # 不満1枚の失点
HIRE_FOOD = 2
BED_COST = {'wood': 3}
WALL_COST = {'wood': 2, 'iron': 1}
POWER_PER = 2                # 仲間1人の戦力
MAX_SKILL = 2                # 仲間1人あたりの熟練の上限
WEAKNESS_BONUS = 2
TIDE_BONUS = 1
FATE_DECK = [-1, 0, 0, 1, 1, 2]
NEST_CAP = 2
FAME_PER_COMPANION = 2
HERO_BONUS = 3
GOLD_PER_FAME = 4

# 市場：魔石と素材だけ相場が動く。基本資源は固定価格で買える
MARKET_BASE = dict(mana=3, mat=2)
MARKET_SPAN = 3
FIXED_BUY = dict(wood=1, iron=2, herb=1, food=1)
MARKET_QTY = 3

# ---- アクションスペース ----
ACTIONS = [
    dict(id='forest', name='古の森', accum={'wood': 3}),
    dict(id='mine', name='鉄の坑道', accum={'iron': 2}),
    dict(id='meadow', name='薬草の野', accum={'herb': 2}),
    dict(id='spring', name='魔石の泉', accum={'mana': 1}),
    dict(id='hunt', name='狩場', accum={'food': 3}),
    dict(id='board', name='依頼板', give={'gold': 2}),
    dict(id='guild', name='ギルドで登用'),
    dict(id='forge', name='鍛冶場'),
    dict(id='workshop', name='工房'),
    dict(id='market', name='市場'),
    dict(id='plaza', name='広場', give={'food': 1}, unlimited=True),
    dict(id='tavern', name='酒場で募集', from_round=3),
    dict(id='training', name='訓練場', from_round=5),
    dict(id='ruins', name='遺跡の探索', from_round=5),
    dict(id='grove', name='雑木林', accum={'wood': 2}, min_p=4),
    dict(id='market2', name='露店', min_p=4),
    dict(id='deepmine', name='深い坑道', accum={'iron': 1}, min_p=5),
    dict(id='peddler', name='行商', give={'gold': 1, 'food': 1}, min_p=5),
    dict(id='herb2', name='霧の沢', accum={'herb': 1}, min_p=6),
    dict(id='outpost', name='見張り小屋', give={'food': 1, 'gold': 1}, min_p=6),
]
ACT = {a['id']: a for a in ACTIONS}
MARKETS = {'market', 'market2'}
NESTS = {3: ['nest_forest', 'nest_cave', 'nest_swamp'], 4: ['nest_forest', 'nest_cave', 'nest_swamp'],
         5: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount'], 6: ['nest_forest', 'nest_cave', 'nest_swamp', 'nest_mount']}
NEST_JP = dict(nest_forest='森の巣', nest_cave='洞窟', nest_swamp='沼の巣', nest_mount='山の巣', lair='主の巣')

# ---- 魔物（各年10種。強さ・反撃・弱点・種族・戦利品・証・冬の襲撃） ----
def M(id, name, year, s, c, weak, race, loot, trophy, raid):
    return dict(id=id, name=name, year=year, str=s, counter=c, weak=weak, race=race, loot=loot, trophy=trophy, raid=raid)

MONSTERS = [
    M('rat', '畑荒らしの大ネズミ', 1, 3, 1, 'fire', 'beast', {'food': 1}, 1, 1),
    M('imp', '霧の小鬼', 1, 4, 1, 'light', 'spirit', {'mana': 1}, 1, 1),
    M('boar', '牙猪', 1, 5, 2, 'ice', 'beast', {'mat': 1, 'food': 2}, 2, 2),
    M('skel', '骸骨兵', 1, 4, 2, 'light', 'undead', {'iron': 1, 'mat': 1}, 1, 1),
    M('slime', '沼スライム', 1, 4, 1, 'fire', 'spirit', {'herb': 2}, 1, 1),
    M('wolf', 'はぐれ狼', 1, 5, 2, 'fire', 'beast', {'mat': 1, 'food': 1}, 2, 2),
    M('goblin', '小鬼の盗賊', 1, 5, 1, 'thunder', 'humanoid', {'gold': 3}, 1, 2),
    M('bat', '吸血大コウモリ', 1, 3, 2, 'light', 'beast', {'mat': 1}, 1, 1),
    M('wisp', '鬼火', 1, 5, 1, 'ice', 'spirit', {'mana': 2}, 2, 1),
    M('spider', '洞窟大蜘蛛', 1, 6, 2, 'fire', 'beast', {'mat': 2}, 2, 2),
    M('frog', '沼の大蛙', 2, 6, 2, 'fire', 'beast', {'mat': 1, 'mana': 1}, 2, 2),
    M('golem', '岩の巨人', 2, 8, 3, 'thunder', 'spirit', {'iron': 2, 'mana': 1}, 3, 3),
    M('ghoul', '屍食鬼', 2, 7, 2, 'light', 'undead', {'mat': 2}, 2, 2),
    M('harpy', '嵐のハーピー', 2, 7, 2, 'ice', 'beast', {'mat': 1, 'gold': 2}, 2, 2),
    M('ogre', '人喰い鬼', 2, 8, 3, 'fire', 'humanoid', {'food': 3, 'gold': 2}, 3, 3),
    M('wraith', '嘆きの亡霊', 2, 7, 2, 'light', 'undead', {'mana': 2}, 2, 2),
    M('salam', '火蜥蜴', 2, 7, 3, 'ice', 'beast', {'mat': 2, 'mana': 1}, 3, 2),
    M('bandit', '山賊の頭領', 2, 6, 2, 'thunder', 'humanoid', {'gold': 4}, 2, 3),
    M('treant', '怒れる古木', 2, 8, 2, 'fire', 'spirit', {'wood': 4, 'herb': 1}, 3, 2),
    M('icewolf', '氷牙の狼群', 2, 7, 3, 'fire', 'beast', {'mat': 2, 'food': 2}, 3, 3),
    M('wyvern', '飛竜の若者', 3, 10, 3, 'ice', 'dragon', {'mat': 2, 'mana': 2}, 4, 3),
    M('lich', '墓所の死霊術師', 3, 10, 3, 'light', 'undead', {'mana': 3}, 4, 3),
    M('troll', '再生する大鬼', 3, 9, 4, 'fire', 'humanoid', {'mat': 2, 'food': 3}, 3, 3),
    M('basil', '石化の大蛇', 3, 9, 3, 'thunder', 'beast', {'mat': 3}, 3, 3),
    M('elem', '雷の精霊', 3, 9, 3, 'dark', 'spirit', {'mana': 3}, 3, 2),
    M('knight', '亡国の黒騎士', 3, 11, 4, 'light', 'undead', {'iron': 3, 'gold': 3}, 4, 4),
    M('manti', '人面獅子', 3, 10, 4, 'ice', 'beast', {'mat': 3, 'gold': 2}, 4, 3),
    M('witch', '霧の魔女', 3, 9, 3, 'thunder', 'humanoid', {'mana': 2, 'herb': 2}, 3, 3),
    M('hydra', '沼の多頭蛇', 3, 11, 4, 'fire', 'dragon', {'mat': 4}, 4, 4),
    M('shade', '影の獣', 3, 8, 3, 'light', 'spirit', {'mat': 2, 'mana': 1}, 3, 2),
]
MON = {m['id']: m for m in MONSTERS}

BOSSES = {
    4: [M('b_bear', '森の大熊', 1, 8, 3, 'fire', 'beast', {'mat': 2, 'food': 4}, 5, 3),
        M('b_queen', '蜘蛛の女王', 1, 8, 2, 'fire', 'beast', {'mat': 3}, 5, 3)],
    8: [M('b_wyrm', '山の飛竜', 2, 12, 4, 'ice', 'dragon', {'mat': 3, 'mana': 2}, 6, 4),
        M('b_dullahan', '首無し騎士', 2, 12, 4, 'light', 'undead', {'iron': 3, 'mana': 2}, 6, 4)],
    12: [M('b_ancient', '谷底の古竜', 3, 20, 4, None, 'dragon', {'mana': 3}, 5, 0)],
}
DRAGON_FAIL = 3   # 古竜を倒せなかったときの全員の失点

# ---- 天候（各季節6枚） ----
WEATHER = {
    'spring': ['calm', 'storm', 'sprout', 'thaw', 'fog', 'newmoon'],
    'summer': ['calm', 'heat', 'storm', 'harvestmoon', 'surge', 'drought'],
    'autumn': ['calm', 'newmoon', 'fog', 'harvestmoon', 'gale', 'festival'],
    'winter': ['calm', 'blizzard', 'cold', 'mild', 'newmoon', 'fair'],
}
WEATHER_JP = dict(calm='穏やかな日', storm='嵐', sprout='芽吹き', thaw='雪解け', fog='濃霧', newmoon='新月',
                  heat='猛暑', harvestmoon='豊穣の月', surge='魔力の奔流', drought='日照り', gale='強風',
                  festival='収穫祭', blizzard='吹雪', cold='寒波', mild='暖冬', fair='冬の市')
WEATHER_EL = dict(storm=('thunder', 2), heat=('fire', 2), newmoon=('dark', 2), blizzard=('ice', 2))

# ---- キャラクター ----
CHARACTERS = {
    'toma': dict(name='トーマ', role='森の弓使い', tags={'wood', 'rear', 'trap'}),
    'mina': dict(name='ミナ', role='土くれの魔導士', tags={'mana', 'fire', 'convert'}),
    'gan': dict(name='ガン', role='ドワーフの鍛冶師', tags={'iron', 'front'}),
    'leo': dict(name='レオ', role='闇市の商人', tags={'gold', 'dark', 'trade'}),
    'haru': dict(name='ハル', role='獣使い', tags={'food', 'beast'}),
    'sana': dict(name='サナ', role='薬草師', tags={'herb', 'support'}),
    'yuki': dict(name='ユキ', role='星詠みの巫女', tags={'thunder', 'weather', 'fate'}),
    'goro': dict(name='ゴロウ', role='城塞の騎士', tags={'front', 'wall'}),
    'aya': dict(name='アヤ', role='旅の吟遊詩人', tags={'trade', 'support', 'coop'}),
    'momo': dict(name='モモ', role='野営の料理人', tags={'food', 'morale'}),
    'riku': dict(name='リク', role='魔物狩り', tags={'front', 'dark', 'chain'}),
    'nana': dict(name='ナナ', role='光の神官', tags={'light', 'support', 'companion'}),
}

# ---- 職能カード30種 ----
def O(id, name, tags, text, chars, quirk=False):
    return dict(id=id, name=name, kind='occ', tags=set(tags), text=text, chars=chars, quirk=quirk)

OCCUPATIONS = [
    O('o01', '見習い炎術士', ['fire', 'rear', 'mana'], '魔石1で炎+2。炎の弱点で倒すと魔石1が戻る', ['mina']),
    O('o02', '霜の射手', ['ice', 'rear', 'wood'], '矢を使うと氷属性になり、反撃-1', ['toma']),
    O('o03', '雷槍の傭兵', ['thunder', 'front', 'gold'], '金貨2で戦力+3（春は金貨1）', ['yuki', 'leo']),
    O('o04', '聖堂の癒し手', ['light', 'support', 'herb'], '戦闘後、負傷した仲間1人を無料で回復（各ラウンド1回）', ['nana', 'sana']),
    O('o05', '闇市の情報屋', ['dark', 'trade'], '2ラウンド先の魔物が見える。情報料として毎ラウンド金貨1', ['leo', 'yuki']),
    O('o06', '盾持ちの古参兵', ['front', 'iron'], '防御+2。共闘相手の防御+1', ['goro', 'aya']),
    O('o07', '魔獣の調教師', ['beast', 'food'], '獣を使い魔にできる。使い魔の戦力+1、上限+1', ['haru']),
    O('o08', '薬草摘みの少女', ['herb', 'support'], '薬草を取るたび+1。冬に薬草2を食料2に', ['sana', 'momo']),
    O('o09', '酒場の看板娘', ['food', 'support', 'companion'], '仲間を雇う食料が不要。仲間4人以上で名声+3', ['nana', 'momo']),
    O('o10', '鉱山のドワーフ', ['iron', 'front'], '鉄を取るたび+1。鉄の武具を出すと名声+1', ['gan']),
    O('o11', '狂戦士', ['front', 'dark', 'chain'], '戦力+3。勝っても必ず1人負傷', ['riku', 'sana']),
    O('o12', '星図の学者', ['fate', 'thunder'], '運命カードの「-1」を「+1」に替える', ['yuki']),
    O('o13', '城壁の工兵', ['wood', 'iron', 'wall'], '防壁を建てるたび名声+1。防壁1つで襲撃-2', ['goro']),
    O('o14', '影の斥候', ['dark', 'rear'], '各年1回、定員の埋まった巣にも入れる', ['riku', 'leo']),
    O('o15', '竜骨の錬金術師', ['mana', 'convert'], '素材を魔石として、魔石1を薬草2として払える', ['mina', 'sana']),
    O('o16', '嵐呼びの巫女', ['thunder', 'weather'], '各年1回、次の天候を嵐に。嵐の日は戦力+2', ['yuki']),
    O('o17', '光の聖騎士', ['light', 'front'], '亡者・闇に戦力+2。古竜戦に参加で名声+2', ['nana']),
    O('o18', '罠師', ['wood', 'trap'], '木材2で巣に罠（強さ-2）。罠の巣で誰かが勝つと金貨1', ['toma']),
    O('o19', '契約魔の主', ['dark', 'mana'], '魔石2で闇の使い魔（戦力+4）。新月は魔石1', ['mina', 'riku']),
    O('o20', '野営地の世話役', ['food', 'companion'], '冬の維持費を仲間2人ぶん減らす', ['momo']),
    O('o21', '古地図の冒険家', ['trade', 'gold'], '遺跡の探索で3枚見て1枚', ['leo', 'aya']),
    O('o22', '双剣の剣士', ['front', 'chain'], '同じラウンド2回目の戦闘で+4。熟練の上限+1', ['riku']),
    O('o23', '結界の守り手', ['light', 'wall'], '冬の襲撃-3。施設3つ以上で戦力+1', ['goro', 'nana']),
    O('o24', '交渉上手の仲介人', ['trade', 'coop'], '共闘で戦利品と証を両方が全部受け取る', ['aya']),
    O('o25', '獣の皮なめし職人', ['beast', 'mat'], '獣を倒すと素材+2。素材3を名声2に（各ラウンド1回）', ['haru', 'riku']),
    O('o26', '呪われた勇者', ['front', 'dark'], '戦力+5。毎ラウンド食料1か薬草1を払わないと仲間1人が休む。古竜を倒すと名声+8', ['sana', 'momo'], True),
    O('o27', '賭博師', ['fate', 'gold'], '運命カードを2枚めくり合計を使う。年1回、山を戻して混ぜ直す', ['yuki', 'leo'], True),
    O('o28', '孤高の剣聖', ['front', 'chain'], '仲間3人以下の間、戦力+3。4人目を雇うと捨てる', ['riku', 'gan'], True),
    O('o29', '宝探しの鼠人', ['trade', 'gold'], '遺跡で1枚多く取れる。主の報酬が4枚から1枚', ['leo', 'aya']),
    O('o30', '氷雪の隠者', ['ice', 'rear'], '冬の戦闘で戦力+3。吹雪の年は襲撃なし', ['mina', 'toma']),
]

# ---- 品物カード30種 ----
def I(id, name, kind, tags, cost, fame, text, chars, quirk=False, **kw):
    d = dict(id=id, name=name, kind=kind, tags=set(tags), cost=cost, fame=fame, text=text, chars=chars, quirk=quirk)
    d.update(kw)
    return d

ITEMS = [
    I('i01', '樫の長弓', 'weapon', ['wood', 'rear'], {'wood': 2}, 0, '戦力+1。矢を1本多く使える', ['toma'], power=1),
    I('i02', 'ドワーフの大剣', 'weapon', ['iron', 'front'], {'iron': 4}, 1, '戦力+3', ['gan'], power=3, ironw=True),
    I('i03', '炎刃の短剣', 'weapon', ['fire'], {'iron': 2, 'mana': 1}, 0, '炎+2。夏は+1', ['mina'], power=2, el='fire', ironw=True),
    I('i04', '氷晶の杖', 'weapon', ['ice', 'mana'], {'wood': 1, 'mana': 2}, 1, '氷+2。反撃-1', ['mina', 'toma'], power=2, el='ice'),
    I('i05', '雷鳴の戦槌', 'weapon', ['thunder', 'iron'], {'iron': 2, 'mana': 1}, 1, '雷+2。嵐の日は+4', ['yuki'], power=2, el='thunder', ironw=True),
    I('i06', '聖印の大盾', 'weapon', ['light', 'front'], {'iron': 3}, 1, '防御+2。光属性', ['goro', 'nana'], power=0, el='light', defense=2, ironw=True),
    I('i07', '黒曜の大鎌', 'weapon', ['dark', 'front'], {'iron': 1, 'mana': 1, 'mat': 1}, 1, '闇+2。素材+1', ['riku'], power=2, el='dark', ironw=True),
    I('i08', '魔獣骨の鎧', 'weapon', ['beast', 'front'], {'mat': 3}, 2, '防御+3。使い魔1体につき戦力+1', ['haru'], power=0, defense=3),
    I('i09', '捕獲の投げ網', 'weapon', ['wood', 'beast', 'trap'], {'wood': 2}, 0, '戦力+1。獣の強さ-2。獣を使い魔にでき、食料-1', ['haru', 'toma'], power=1),
    I('i10', '吟遊詩人のリュート', 'weapon', ['support', 'coop'], {'wood': 2, 'gold': 2}, 1, '共闘のとき両者の戦力+2', ['aya'], power=0),
    I('i11', '魔導炉', 'tool', ['mana'], {'iron': 2, 'wood': 1}, 1, '毎ラウンド開始時に魔石1（6ラウンド）', ['mina']),
    I('i12', '薬草園', 'tool', ['herb'], {'wood': 2}, 1, '春・夏・秋の終わりに薬草2', ['sana']),
    I('i13', '野戦炊事場', 'tool', ['food', 'morale'], {'wood': 3}, 1, '維持費-1。毎戦闘で士気+1', ['momo']),
    I('i14', '物見の塔', 'tool', ['wall', 'fate'], {'wood': 3, 'iron': 1}, 2, '3ラウンド先まで見る。襲撃-1', ['yuki', 'goro']),
    I('i15', '交易の荷馬車', 'tool', ['trade', 'gold'], {'wood': 2}, 2, '市場の個数+2', ['leo', 'aya']),
    I('i16', '訓練場', 'tool', ['front', 'chain'], {'wood': 2, 'iron': 1}, 1, '毎年1回、無料で熟練+1', ['riku', 'gan']),
    I('i17', '兵舎', 'tool', ['companion'], {'wood': 5}, 1, '寝床2つぶん。仲間1人につき名声+1', ['nana']),
    I('i18', '鍛冶場の金床', 'tool', ['iron'], {'iron': 2}, 1, '武具を出すたび鉄1が戻る', ['gan']),
    I('i19', '火球の巻物', 'spell', ['fire', 'mana'], {'mana': 2}, 0, '炎+4', ['mina'], power=4, el='fire'),
    I('i20', '時渡りの砂時計', 'spell', ['mana'], {'mana': 3}, 0, '仲間をもう1人置ける', ['riku', 'mina']),
    I('i21', '天候の鈴', 'spell', ['weather'], {'mana': 1}, 0, '次の天候を好きなものに', ['yuki']),
    I('i22', '帰還の羽根', 'spell', ['light', 'support'], {'mana': 1}, 0, '負けても負傷せず、仲間が戻る', ['nana', 'sana']),
    I('i23', '影分身の呪符', 'spell', ['dark'], {'mana': 2}, 0, '定員を無視して巣に入り、戦力+2', ['riku', 'leo'], power=2, el='dark'),
    I('i24', '竜殺しの秘薬', 'spell', ['dragon', 'herb'], {'mana': 2, 'herb': 2}, 0, '主・古竜との戦闘で戦力+6', ['sana', 'nana'], power=6),
    I('i25', '契約の羊皮紙', 'spell', ['trade', 'coop'], {'gold': 2}, 0, 'このラウンドの共闘で証を両方が受け取る', ['aya']),
    I('i26', '生贄の魔剣', 'weapon', ['dark', 'front'], {'iron': 2, 'mana': 2}, 1, '戦力+3。戦闘のたび1人負傷。主を倒すと名声+3', ['sana', 'nana'], True, power=3, el='dark', ironw=True),
    I('i27', '竜の卵', 'tool', ['dragon', 'food'], {'food': 1}, 0, '毎冬食料1。最後まで育てると古竜戦+6、名声+6', ['momo', 'haru'], True),
    I('i28', '黄金の誓約書', 'spell', ['gold', 'trade'], {'mana': 1}, 0, '金貨2枚ごとに戦力+1。勝てば倍返し、負ければ失う', ['leo', 'aya'], True),
    I('i29', '携帯鍛冶炉', 'tool', ['iron', 'front'], {'iron': 1, 'wood': 1}, 1, '戦闘中に鉄1で戦力+2', ['gan', 'goro']),
    I('i30', '聖水の小瓶', 'spell', ['light', 'herb'], {'herb': 1, 'mana': 1}, 0, '亡者・闇の魔物の強さ-3', ['nana', 'sana'], power=0),
]
CARDS = {c['id']: c for c in OCCUPATIONS + ITEMS}
OCC_IDS = [c['id'] for c in OCCUPATIONS]
ITEM_IDS = [c['id'] for c in ITEMS]

# ---- 共通の依頼（15種から3枚） ----
QUESTS = {
    'q_kill4': '魔物を4体倒す', 'q_beast2': '獣を2体倒す', 'q_undead2': '亡者を2体倒す', 'q_boss': '主の討伐に勝つ',
    'q_comp4': '仲間を4人にする', 'q_fac3': '施設を3つ建てる', 'q_wall3': '防壁を3つ建てる', 'q_weap3': '武具を3つ持つ',
    'q_occ3': '職能を3枚出す', 'q_spell2': '秘術を2回使う', 'q_weak3': '弱点を突いて3体倒す', 'q_gold10': '金貨を10枚持つ',
    'q_coop2': '共闘で2体倒す', 'q_mat6': '素材を6持つ', 'q_skill3': '熟練を3つつける',
}
QUEST_FAME = [4, 3, 2]

# ---- エンジン用の追加定数（設計書に数値のない部分。シミュレーションで調整） ----
DEF_PER = 1                  # 送った仲間1人あたりの防御
FORECAST = 1                 # 天候・魔物の予報（何ラウンド先まで見えるか）
REAR_DEF = 1                 # 後衛カードを持つときの防御
POTION = ({'herb': 2}, 1)    # 誰でも使えるポーション（サナは+2、2本まで）
MORALE = ({'food': 1}, 1)    # 誰でも使える士気（モモは2回）
OCC_FOOD = [1, 1]            # 職能を出す費用（1枚目、2枚目以降）
RAID_WALLS = 1               # 防壁いくつで襲撃-1か
BOSS_ROUNDS = (4, 8, 12)
WINTER_ROUNDS = (4, 8, 12)
BOSS_SHARE = 1.0             # 主討伐で最大貢献者以外が受け取る証の割合
DRAGON_JOIN_FAME = 5
# 静的なカード評価（ドラフトAI用。measure の pick-to-win から更新する）
RATING = {}

# 調整用のキャラ・カード数値
O28_POWER = 3
O22_POWER = 4
O08_FOOD = 2
YUKI_PER_YEAR = 4
AYA_COOP = 2
START_BONUS = dict(leo={'gold': 4}, aya={'gold': 5}, mina={'mana': 2}, gan={'iron': 2}, yuki={'mana': 2, 'gold': 2}, haru={'food': 1}, momo={'food': 2}, riku={'mat': 2})
TAME_KEEPS_TROPHY = True
NANA_HIRE_FOOD = 1
HARU_START_PETS = 1
AYA_TRADE_GOLD = 2
NANA_FREE_BED = False   # True=設計書どおり（最初の募集は寝床不要）。強すぎたので無効化
NANA_FIRST_FREE_FOOD = False
RIKU_CHAIN = 4
GORO_DEF = 1
I26_BOSS_FAME = 1
O17_DRAGON_FAME = 2
CHAR_RATING = {}





RAID_PAYABLE = False      # 襲撃1点＝名声-1（資源で払えない）
COOP_SUPPORT_SHARE = 0.5  # 共闘で証を取らなかった側も証の半分（切り上げ）
RAID_FROM_DECK = 0         # 冬に、まだ出ていない魔物（山札の上から）も谷を襲う
SPAWN_EXTRA = 0            # 1ラウンドに出る魔物の上限 = 巣の数-1+これ（年10体の山から6〜8体が出る）

DRAFT_SHOW = 3             # ドラフトで1周に見る枚数（設計書: 3枚から1枚）

SELL_SPREAD = 0            # 売値 = 相場 - これ（レオは+1）

MINA_SPRING = 2            # ミナが魔石の泉で追加で得る魔石（設計書は+1）

MINA_DISCOUNT_ALWAYS = True  # 秘術の魔石-1を毎回（設計書は各ラウンド1回）

# CALIB-START（calib.py が 400 局のミラー卓から自動生成）
RATING.update({"i17": 1.8, "i06": 1.42, "o09": 1.35, "i02": 1.34, "o17": 1.26, "o21": 1.25, "o02": 1.23, "o04": 1.23, "o23": 1.22, "i04": 1.19, "o20": 1.16, "o30": 1.16, "o25": 1.15, "i12": 1.15, "i26": 1.15, "i08": 1.11, "o03": 1.11, "i29": 1.11, "i25": 1.08, "o26": 1.08, "i28": 1.07, "o29": 1.04, "i14": 1.02, "o06": 1.02, "o28": 1.01, "i01": 1.01, "o22": 1.0, "o12": 0.98, "o15": 0.98, "i05": 0.97, "i13": 0.96, "i22": 0.96, "i07": 0.95, "i30": 0.94, "o07": 0.93, "o13": 0.93, "o14": 0.9, "o01": 0.9, "i21": 0.86, "i24": 0.86, "o10": 0.83, "o18": 0.82, "o05": 0.81, "o16": 0.8, "o11": 0.77, "i16": 0.76, "o27": 0.76, "i15": 0.73, "i20": 0.73, "i23": 0.73, "o24": 0.72, "i03": 0.69, "i10": 0.69, "i19": 0.66, "i11": 0.62, "o19": 0.57, "i18": 0.46, "o08": 0.46, "i09": 0.33, "i27": 0.2})
CHAR_RATING.update({"nana": 0.58, "goro": 0.42, "momo": 0.21, "aya": 0.14, "yuki": 0.13, "gan": 0.04, "leo": -0.06, "haru": -0.24, "toma": -0.25, "riku": -0.41, "sana": -0.42, "mina": -0.52})
# CALIB-END

"""
占卜判词/消息/算法的 Python 实现。

从 script.js / zodiac.js 中完整移植占卜算法，
用于服务端统一计算（本地占卜 + 远程占卜共用）。
"""

import math
import random
from datetime import datetime


# ── 黄道十二宮データ ──────────────────────────────────────────────────

ZODIAC = [
    {"key": "aries",       "jp": "牡羊座",   "roma": "Aries",       "glyph": "♈", "element": "fire",  "date": "3/21 - 4/19"},
    {"key": "taurus",      "jp": "牡牛座",   "roma": "Taurus",      "glyph": "♉", "element": "earth", "date": "4/20 - 5/20"},
    {"key": "gemini",      "jp": "双子座",   "roma": "Gemini",      "glyph": "♊", "element": "air",   "date": "5/21 - 6/21"},
    {"key": "cancer",      "jp": "蟹座",     "roma": "Cancer",      "glyph": "♋", "element": "water", "date": "6/22 - 7/22"},
    {"key": "leo",         "jp": "獅子座",   "roma": "Leo",         "glyph": "♌", "element": "fire",  "date": "7/23 - 8/22"},
    {"key": "virgo",       "jp": "乙女座",   "roma": "Virgo",       "glyph": "♍", "element": "earth", "date": "8/23 - 9/22"},
    {"key": "libra",       "jp": "天秤座",   "roma": "Libra",       "glyph": "♎", "element": "air",   "date": "9/23 - 10/23"},
    {"key": "scorpio",     "jp": "蠍座",     "roma": "Scorpio",     "glyph": "♏", "element": "water", "date": "10/24 - 11/22"},
    {"key": "sagittarius", "jp": "射手座",   "roma": "Sagittarius", "glyph": "♐", "element": "fire",  "date": "11/23 - 12/21"},
    {"key": "capricorn",   "jp": "山羊座",   "roma": "Capricorn",   "glyph": "♑", "element": "earth", "date": "12/22 - 1/19"},
    {"key": "aquarius",    "jp": "水瓶座",   "roma": "Aquarius",    "glyph": "♒", "element": "air",   "date": "1/20 - 2/18"},
    {"key": "pisces",      "jp": "魚座",     "roma": "Pisces",      "glyph": "♓", "element": "water", "date": "2/19 - 3/20"},
]

ELEMENT_META = {
    "fire":  {"jp": "火",  "color": "#ff8a5c", "soft": "#ffd2b0"},
    "earth": {"jp": "地",  "color": "#c4a86a", "soft": "#ecdcb0"},
    "air":   {"jp": "風",  "color": "#9fd0ff", "soft": "#d6ecff"},
    "water": {"jp": "水",  "color": "#a9a4ff", "soft": "#ddd9ff"},
}


def find_zodiac(key: str) -> dict | None:
    for z in ZODIAC:
        if z["key"] == key:
            return z
    return None


# ── 判词数组 ──────────────────────────────────────────────────────────

MIRACLE_HIGH_VERDICTS = [
    "奇跡のご縁 ─ 主人公級の相性",
    "運命的な結びつき ─ これはもう最終回手前",
    "星が祝福するご縁 ─ 友情・努力・相性",
    "かけがえのない絆 ─ コンビ技が決まる相性",
    "心が通い合うご縁 ─ スーパー級の相性",
]

MIRACLE_LOW_VERDICTS = [
    "まだ形の見えないご縁 ─ 第1話はここから",
    "少し不思議な結びつき ─ 伏線回収はこれから",
    "意外性のあるご縁 ─ 名探偵も二度見する相性",
    "慎重に育てたい関係 ─ 作戦会議が効く相性",
    "距離の縮め方が大切なご縁 ─ 次回に期待の相性",
]


def pick_verdict(score: int, miracle: str | None, h: int) -> str:
    if miracle == "high":
        return MIRACLE_HIGH_VERDICTS[h % len(MIRACLE_HIGH_VERDICTS)]
    if miracle == "low":
        return MIRACLE_LOW_VERDICTS[h % len(MIRACLE_LOW_VERDICTS)]
    if score >= 82:
        return "運命を感じるご縁 ─ 主題歌が流れる相性"
    if score >= 70:
        return "自然に惹かれ合う ─ いいチームになれる相性"
    if score >= 57:
        return "心が通い合う ─ じわじわ良い相性"
    if score >= 42:
        return "歩み寄るほど深まる相性"
    return "ゆっくり育てたい、まだ序盤の相性"


# ── 消息数组 ──────────────────────────────────────────────────────────

MESSAGES = {
    "miracle_high": [
        "めったに見られないほど強い結びつきを感じる相性です。お互いの存在が安心感となり、関係を大切に育てるほど絆はさらに深まっていくでしょう。",
        "出会うべくして出会ったと思えるご縁です。言葉にしなくても気持ちが伝わりやすく、ふたりで過ごす時間が心の支えになっていきます。",
        "星の流れから見ると、おふたりは互いの魅力を自然に引き出し合える関係です。まるで冒険の一味に迎えたくなるような、頼もしさがあります。",
        "おふたりの間には、偶然とは思えない引力があります。向き合うほど、隠しコマンドを見つけたみたいに関係が強くなっていきそうです。",
        "この相性は、強いご縁とタイミングの良さを示しています。ここぞという場面では、まるで必殺技のカットインのように息が合うでしょう。",
    ],
    "miracle_low": [
        "今はまだ、お互いの距離感を探る時期かもしれません。焦らず相手の考え方を知っていくことで、思いがけない接点が見えてくるでしょう。",
        "価値観の違いが出やすい相性ですが、その違いは関係を広げるきっかけにもなります。丁寧な言葉選びが、ふたりの流れを変えてくれます。",
        "すぐに答えを決めつけず、少しずつ歩み寄ることが大切です。今は修行編だと思えば、伸びしろはかなり大きめです。",
        "星は、まだ余白の多い関係を示しています。名探偵なら見逃さない小さな伏線が、これから効いてくるかもしれません。",
        "おふたりの関係には、慎重さと素直さの両方が必要です。秘密道具を探すより、まずは一言のやさしさが近道になります。",
    ],
    "high": [
        "お互いの存在が、自然と心を明るくしてくれる相性です。無理をしなくても距離が縮まりやすく、一緒にいるほど信頼が深まります。",
        "違いさえも魅力として受け止めやすい関係です。素直な気持ちを伝えることで、恋の流れはさらに前向きに進んでいくでしょう。",
        "惹かれ合う力が強く、支え合える相性です。ふたりで全集中すれば、日常の小さな壁も軽やかに越えていけそうです。",
        "テンポの合いやすい相性です。まるで息ぴったりのチーム戦のように、相手の一手を自然に受け取れるでしょう。",
    ],
    "mid": [
        "穏やかに育っていく相性です。焦らず相手のペースを尊重することで、信頼はゆっくり確かなものになります。",
        "ときに価値観の違いを感じても、それはお互いを知るための大切なきっかけです。素直な言葉が、ふたりの距離を縮めてくれます。",
        "心地よい風のように、自然体で向き合える関係です。小さな感謝を重ねるほど、ふたりの時間は温かくなっていきます。",
        "まだ派手な展開ではありませんが、じわじわ効いてくる良いご縁です。日常回を大切にすると、ちゃんと名場面が増えていきます。",
    ],
    "low": [
        "今はまだ手探りでも、関係を育てる余地は十分にあります。違いを否定せず、面白がる気持ちが距離を近づけます。",
        "ゆっくり時間をかけるほど深まるご縁です。相手の小さな優しさに気づくことで、関係は少しずつ温まっていきます。",
        "最初はすれ違いがあっても、理解しようとする姿勢が流れを変えます。歩み寄るほど、星はふたりの味方をしてくれるでしょう。",
        "今はまだ序盤のライバル関係に見えますが、会話を重ねるほど印象は変わります。焦らず、次の話数を楽しみにしてみてください。",
    ],
}


def pick_message(score: int, miracle: str | None, h: int) -> str:
    if miracle == "high":
        return MESSAGES["miracle_high"][h % len(MESSAGES["miracle_high"])]
    if miracle == "low":
        return MESSAGES["miracle_low"][h % len(MESSAGES["miracle_low"])]
    bucket = "high" if score >= 70 else ("mid" if score >= 45 else "low")
    return MESSAGES[bucket][h % len(MESSAGES[bucket])]


# ── 名前モードのアスペクトラベル ─────────────────────────────────────

def name_resonance_label(score: int, miracle: str | None) -> str:
    if miracle == "high":
        return "言霊が、必殺技のように響き合っています"
    if miracle == "low":
        return "言霊が、まだ次回予告を待っているようです"
    if score >= 82:
        return "言霊が、ぴたりとコンビ技になっています"
    if score >= 70:
        return "ふたつの名前が、やさしく響き合っています"
    if score >= 57:
        return "名前の響きが、心地よく調和しています"
    if score >= 42:
        return "ふたつの響きが、少しずつ寄り添っています"
    return "名前の響きが、ゆっくり距離を縮めています"


# ── miracle 判定 ─────────────────────────────────────────────────────

def determine_miracle(score: int) -> str | None:
    if 91 <= score <= 99:
        return "high"
    if 5 <= score <= 17:
        return "low"
    return None


# ── ハッシュ（FNV-1a） ────────────────────────────────────────────────
# JS の hashString と完全一致する 32bit unsigned 実装。

def _hash_string(s: str) -> int:
    """FNV-1a hash matching the JS hashString function."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


# ── 名前の等冪計算の素（ことだまの響き） ──────────────────────────────
# JS nameSeedParts と完全一致。
# 占う「いま」の日付＋時刻（時単位）を種に混ぜる。

def _name_seed_parts(name_left: str, name_right: str) -> dict:
    now = datetime.now()
    stamp = f"{now.year}-{now.month:02d}-{now.day:02d}-{now.hour:02d}"
    seed = "|".join(sorted([name_left, name_right])) + "@" + stamp
    h = _hash_string(seed)
    h2 = _hash_string(seed + "✦")
    h3 = _hash_string(seed + "★")
    raw = (h % 10000) / 10000
    return {"raw": raw, "h": h, "h2": h2, "h3": h3, "now": now}


# ── スコア分布 ────────────────────────────────────────────────────────
# JS applyScoreDistribution と完全一致。

def _apply_score_distribution(raw: float, h3: int) -> dict:
    roll = h3 % 20
    if roll == 0:
        return {"score": 91 + ((h3 >> 8) & 0xFF) % 9, "miracle": "high"}  # 91〜99 (5%)
    if roll == 1:
        return {"score": 5 + ((h3 >> 8) & 0xFF) % 13, "miracle": "low"}   # 5〜17 (5%)
    # 通常分布：70〜80 に集中
    bucket = (h3 >> 4) % 10
    v = (h3 >> 8) & 0xFFFFFF
    if bucket < 4:
        return {"score": 70 + v % 11, "miracle": None}   # 70〜80 (36%)
    if bucket < 7:
        return {"score": 80 + v % 11, "miracle": None}   # 80〜90 (27%)
    if bucket < 9:
        return {"score": 50 + v % 21, "miracle": None}   # 50〜70 (18%)
    return {"score": 30 + v % 21, "miracle": None}       # 30〜50 (9%)


# ── 黄道（太陽の位置）まわりの計算 ────────────────────────────────────

def _sun_ecliptic_longitude(dt: datetime) -> float:
    """指定日時の太陽の黄経（0〜360°、春分点=牡羊座0°）。JS と同一算法。"""
    epoch = datetime(1970, 1, 1)
    jd = (dt - epoch).total_seconds() / 86400.0 + 2440587.5
    n = jd - 2451545.0
    L = 280.460 + 0.9856474 * n
    g = (357.528 + 0.9856003 * n) * math.pi / 180.0
    lon = L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g)
    return ((lon % 360) + 360) % 360


def _sign_center(key: str) -> int:
    """星座の中心黄経（牡羊=15°, 牡牛=45° …）。"""
    for i, z in enumerate(ZODIAC):
        if z["key"] == key:
            return i * 30 + 15
    return 0


def _ang_dist(a: float, b: float) -> float:
    """2つの黄経の最小角差（0〜180°）。"""
    d = ((a - b) % 360 + 360) % 360
    return 360 - d if d > 180 else d


# ── アスペクト（角度関係） ────────────────────────────────────────────

_ASPECTS = [
    {"a": 0,   "v": 0.88, "orb": 10},  # 合
    {"a": 60,  "v": 0.82, "orb": 8},   # セクスタイル（吉）
    {"a": 90,  "v": 0.40, "orb": 8},   # スクエア（凶）
    {"a": 120, "v": 0.98, "orb": 10},  # トライン（大吉）
    {"a": 150, "v": 0.38, "orb": 6},   # インコンジャクト（凶）
    {"a": 180, "v": 0.62, "orb": 10},  # オポジション
]


def _aspect_harmony(deg: float) -> float:
    """アスペクトの調和度を 0〜1 で返す。プトレマイオスの主要アスペクト。"""
    acc = 0.0
    wsum = 0.0
    for asp in _ASPECTS:
        w = max(0.0, 1 - abs(deg - asp["a"]) / asp["orb"])
        acc += asp["v"] * w
        wsum += w
    return acc / wsum if wsum > 0 else 0.5


_ASPECT_NAMES = {
    0:   "重なり合うご縁（コンジャンクション）",
    30:  "ゆるやかに近づくご縁（セミセクスタイル）",
    60:  "心地よく支え合う関係（セクスタイル）",
    90:  "刺激し合い成長できる関係（スクエア）",
    120: "自然に響き合う関係（トライン）",
    150: "歩み寄りが鍵になる関係（インコンジャンクト）",
    180: "向き合うほど惹かれる関係（オポジション）",
}


def _aspect_name(sep: float) -> str:
    s = round(sep / 30) * 30
    return _ASPECT_NAMES.get(s, "星が示すご縁")


def _zodiac_affinity_by_sun(key_left: str, key_right: str, sun_lon: float) -> dict:
    """太陽の現在位置を踏まえた、ふたつの星座の相性（0〜1）。"""
    c_left = _sign_center(key_left)
    c_right = _sign_center(key_right)
    sep = _ang_dist(c_left, c_right)
    base_aspect = _aspect_harmony(sep)
    sun_favor = (
        _aspect_harmony(_ang_dist(sun_lon, c_left))
        + _aspect_harmony(_ang_dist(sun_lon, c_right))
    ) / 2
    score = base_aspect * 0.65 + sun_favor * 0.35
    sun_sign = ZODIAC[int(((sun_lon % 360 + 360) % 360) // 30)]
    return {"score": score, "aspect_name": _aspect_name(sep), "sun_sign": sun_sign}


# ── 統一入口：名前だけの相性 ──────────────────────────────────────────

def compute_by_name(name_left: str, name_right: str) -> dict:
    """名前だけの相性（ことだまの響き）。星座を使わず姓名の等冪計算のみ。
    JS の computeByName() と完全一致。"""
    parts = _name_seed_parts(name_left, name_right)
    raw, h, h3 = parts["raw"], parts["h"], parts["h3"]
    dist = _apply_score_distribution(raw, h3)

    return {
        "mode": "name",
        "score": dist["score"],
        "miracle": dist["miracle"],
        "nameL": name_left,
        "nameR": name_right,
        "zL": None,
        "zR": None,
        "verdict": pick_verdict(dist["score"], dist["miracle"], h),
        "message": pick_message(dist["score"], dist["miracle"], h),
        "aspect": name_resonance_label(dist["score"], dist["miracle"]),
    }


# ── 統一入口：星座＋名前の相性 ────────────────────────────────────────

def compute_compatibility(
    name_left: str,
    zodiac_left: str,
    name_right: str,
    zodiac_right: str,
) -> dict:
    """星座＋名前の相性。姓名の等冪計算を基礎に、太陽の現在位置で測った星座相性を叠加。
    JS の computeCompatibility() と完全一致。"""
    z_left = find_zodiac(zodiac_left)
    z_right = find_zodiac(zodiac_right)
    parts = _name_seed_parts(name_left, name_right)
    raw, h, h3, now = parts["raw"], parts["h"], parts["h3"], parts["now"]

    sun_lon = _sun_ecliptic_longitude(now)
    z = _zodiac_affinity_by_sun(zodiac_left, zodiac_right, sun_lon)

    # 奇跡枠を先に抽選する（出た場合は星座相性を上書き）
    pre = _apply_score_distribution(raw, h3)
    if pre["miracle"]:
        score, miracle = pre["score"], pre["miracle"]
    else:
        # 奇跡でない場合は姓名5割＋星座相性5割で補正
        same_sign = 0.04 if zodiac_left == zodiac_right else 0
        blended = max(0.0, min(1.0, raw * 0.5 + z["score"] * 0.5 + same_sign))
        score = round(20 + blended * 70)
        miracle = None

    return {
        "mode": "zodiac",
        "score": score,
        "miracle": miracle,
        "nameL": name_left,
        "nameR": name_right,
        "zL": z_left,
        "zR": z_right,
        "affinity": z["score"],
        "sunSign": z["sun_sign"],
        "verdict": pick_verdict(score, miracle, h),
        "message": pick_message(score, miracle, h),
        "aspect": z["aspect_name"],
    }


# ── 管理者スコア指定ビルド ────────────────────────────────────────────

def build_outcome_with_score(
    score: int,
    mode: str,
    name_left: str,
    name_right: str,
    zodiac_left: str | None = None,
    zodiac_right: str | None = None,
) -> dict:
    """Build an outcome with a manager-specified score."""
    score = max(0, min(100, score))
    miracle = determine_miracle(score)
    h = random.randint(0, 1000000)
    verdict = pick_verdict(score, miracle, h)
    message = pick_message(score, miracle, h)
    aspect = name_resonance_label(score, miracle)

    z_left = find_zodiac(zodiac_left) if zodiac_left else None
    z_right = find_zodiac(zodiac_right) if zodiac_right else None

    result = {
        "mode": mode,
        "score": score,
        "miracle": miracle,
        "nameL": name_left,
        "nameR": name_right,
        "zL": z_left,
        "zR": z_right,
        "verdict": verdict,
        "message": message,
        "aspect": aspect,
    }

    # 星座モードの場合、追加フィールドを計算
    if mode == "zodiac" and z_left and z_right:
        now = datetime.now()
        sun_lon = _sun_ecliptic_longitude(now)
        z = _zodiac_affinity_by_sun(zodiac_left, zodiac_right, sun_lon)
        result["affinity"] = z["score"]
        result["sunSign"] = z["sun_sign"]
        # 指定スコア時も星座モードなら aspect を星座名にする
        result["aspect"] = z["aspect_name"]

    return result


# ── 互換：旧 build_outcome_normal（内部で統一関数を呼ぶ） ─────────────

def build_outcome_normal(
    mode: str,
    name_left: str,
    name_right: str,
    zodiac_left: str | None = None,
    zodiac_right: str | None = None,
) -> dict:
    """Build an outcome using the unified algorithm (now identical to frontend)."""
    if mode == "zodiac" and zodiac_left and zodiac_right:
        return compute_compatibility(name_left, zodiac_left, name_right, zodiac_right)
    return compute_by_name(name_left, name_right)

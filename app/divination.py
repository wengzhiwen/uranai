"""
占卜判词/消息的 Python 移植。

从 script.js 中移植 pickVerdict / pickMessage / nameResonanceLabel 等
函数及其依赖的文本数组，用于服务端在「指定分数」或「记录存储」时
生成完整的 outcome 对象。
"""

import random

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


# ── outcome 构建 ─────────────────────────────────────────────────────


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

    return {
        "mode": mode,
        "score": score,
        "miracle": miracle,
        "nameL": name_left,
        "nameR": name_right,
        "zL": zodiac_left,
        "zR": zodiac_right,
        "verdict": verdict,
        "message": message,
        "aspect": aspect,
    }


def build_outcome_normal(
    mode: str,
    name_left: str,
    name_right: str,
    zodiac_left: str | None = None,
    zodiac_right: str | None = None,
) -> dict:
    """Build an outcome using deterministic hash (mirrors JS logic).

    For the server-side record, we don't need perfect parity with the client
    (which uses time-of-day seeding). The client will compute its own result
    for normal (non-override) divinations. This is used for record-keeping
    when the manager does NOT specify a score — we still need a stored result.
    """
    # Use a simple hash to pick outcome deterministically for the record
    combined = f"{name_left}|{name_right}"
    h = _hash_string(combined)
    h3 = _hash_string(combined + "★")
    raw = (h % 10000) / 10000

    # Score distribution (mirrors JS applyScoreDistribution)
    roll = h3 % 20
    v = (h3 >> 8) & 0xFFFF
    if roll == 0:
        score = 91 + v % 9
        miracle = "high"
    elif roll == 1:
        score = 5 + v % 13
        miracle = "low"
    else:
        bucket = (h3 >> 4) % 10
        if bucket < 4:
            score = 70 + v % 11   # 70-80 (36%)
        elif bucket < 7:
            score = 80 + v % 11   # 80-90 (27%)
        elif bucket < 9:
            score = 50 + v % 21   # 50-70 (18%)
        else:
            score = 30 + v % 21   # 30-50 (9%)
        miracle = None

    verdict = pick_verdict(score, miracle, h)
    message = pick_message(score, miracle, h)
    aspect = name_resonance_label(score, miracle)

    return {
        "mode": mode,
        "score": score,
        "miracle": miracle,
        "nameL": name_left,
        "nameR": name_right,
        "zL": zodiac_left,
        "zR": zodiac_right,
        "verdict": verdict,
        "message": message,
        "aspect": aspect,
    }


def _hash_string(s: str) -> int:
    """FNV-1a hash matching the JS hashString function."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h

"""
占卜判词/消息/算法的 Python 实现。

从 script.js / zodiac.js 中完整移植占卜算法，
用于服务端统一计算（本地占卜 + 远程占卜共用）。

支持 4 种语言：ja（日语）、zh-TW（繁体中文）、ko（韩语）、vi（越南语）。
"""

import math
import random
from datetime import datetime


# ── 支持的语言 ────────────────────────────────────────────────────────

SUPPORTED_LANGS = ("ja", "zh-TW", "ko", "vi")


# ── 黄道十二宮データ ──────────────────────────────────────────────────

ZODIAC = [
    {"key": "aries",       "jp": "牡羊座", "zh-TW": "牡羊座",   "ko": "양자리",     "vi": "Bạch Dương",  "roma": "Aries",       "glyph": "♈", "element": "fire",  "date": "3/21 - 4/19"},
    {"key": "taurus",      "jp": "牡牛座", "zh-TW": "牡牛座",   "ko": "황소자리",   "vi": "Kim Ngưu",    "roma": "Taurus",      "glyph": "♉", "element": "earth", "date": "4/20 - 5/20"},
    {"key": "gemini",      "jp": "双子座", "zh-TW": "雙子座",   "ko": "쌍둥이자리", "vi": "Song Tử",     "roma": "Gemini",      "glyph": "♊", "element": "air",   "date": "5/21 - 6/21"},
    {"key": "cancer",      "jp": "蟹座",   "zh-TW": "巨蟹座",   "ko": "게자리",     "vi": "Cự Giải",     "roma": "Cancer",      "glyph": "♋", "element": "water", "date": "6/22 - 7/22"},
    {"key": "leo",         "jp": "獅子座", "zh-TW": "獅子座",   "ko": "사자자리",   "vi": "Sư Tử",       "roma": "Leo",         "glyph": "♌", "element": "fire",  "date": "7/23 - 8/22"},
    {"key": "virgo",       "jp": "乙女座", "zh-TW": "處女座",   "ko": "처녀자리",   "vi": "Xử Nữ",       "roma": "Virgo",       "glyph": "♍", "element": "earth", "date": "8/23 - 9/22"},
    {"key": "libra",       "jp": "天秤座", "zh-TW": "天秤座",   "ko": "천칭자리",   "vi": "Thiên Bình",  "roma": "Libra",       "glyph": "♎", "element": "air",   "date": "9/23 - 10/23"},
    {"key": "scorpio",     "jp": "蠍座",   "zh-TW": "天蠍座",   "ko": "전갈자리",   "vi": "Bọ Cạp",      "roma": "Scorpio",     "glyph": "♏", "element": "water", "date": "10/24 - 11/22"},
    {"key": "sagittarius", "jp": "射手座", "zh-TW": "射手座",   "ko": "사수자리",   "vi": "Nhân Mã",     "roma": "Sagittarius", "glyph": "♐", "element": "fire",  "date": "11/23 - 12/21"},
    {"key": "capricorn",   "jp": "山羊座", "zh-TW": "摩羯座",   "ko": "염소자리",   "vi": "Ma Kết",      "roma": "Capricorn",   "glyph": "♑", "element": "earth", "date": "12/22 - 1/19"},
    {"key": "aquarius",    "jp": "水瓶座", "zh-TW": "水瓶座",   "ko": "물병자리",   "vi": "Bảo Bình",    "roma": "Aquarius",    "glyph": "♒", "element": "air",   "date": "1/20 - 2/18"},
    {"key": "pisces",      "jp": "魚座",   "zh-TW": "雙魚座",   "ko": "물고기자리", "vi": "Song Ngư",    "roma": "Pisces",      "glyph": "♓", "element": "water", "date": "2/19 - 3/20"},
]

ELEMENT_META = {
    "fire":  {"jp": "火", "zh-TW": "火", "ko": "불", "vi": "Lửa", "color": "#ff8a5c", "soft": "#ffd2b0"},
    "earth": {"jp": "地", "zh-TW": "土", "ko": "흙", "vi": "Đất", "color": "#c4a86a", "soft": "#ecdcb0"},
    "air":   {"jp": "風", "zh-TW": "風", "ko": "공기", "vi": "Khí", "color": "#9fd0ff", "soft": "#d6ecff"},
    "water": {"jp": "水", "zh-TW": "水", "ko": "물", "vi": "Nước", "color": "#a9a4ff", "soft": "#ddd9ff"},
}


def find_zodiac(key: str) -> dict | None:
    for z in ZODIAC:
        if z["key"] == key:
            return z
    return None


def zodiac_name(z: dict, lang: str) -> str:
    return z.get(lang, z["jp"])


def element_name(em: dict, lang: str) -> str:
    return em.get(lang, em["jp"])


# ── 判词数组 ──────────────────────────────────────────────────────────

MIRACLE_HIGH_VERDICTS = {
    "ja": [
        "奇跡のご縁 ─ 主人公級の相性",
        "運命的な結びつき ─ これはもう最終回手前",
        "星が祝福するご縁 ─ 友情・努力・相性",
        "かけがえのない絆 ─ コンビ技が決まる相性",
        "心が通い合うご縁 ─ スーパー級の相性",
    ],
    "zh-TW": [
        "奇蹟般的緣分 ─ 主角級的契合",
        "命中注定的牽絆 ─ 彷彿來到最終回前夕",
        "星辰祝福的緣分 ─ 友情・努力・契合",
        "無可取代的羈絆 ─ 完美搭檔般的契合",
        "心靈相通的緣分 ─ 超強契合",
    ],
    "ko": [
        "기적적인 인연 ─ 주인공급 궁합",
        "운명적인 연결 ─ 이제 피날레 직전",
        "별이 축복하는 인연 ─ 우정・노력・궁합",
        "대체할 수 없는 유대 ─ 완벽한 콤비 궁합",
        "마음이 통하는 인연 ─ 슈퍼급 궁합",
    ],
    "vi": [
        "Duyên kỳ diệu ─ độ hợp nhân vật chính",
        "Gắn kết định mệnh ─ sát hồi kết đẹp",
        "Duyên được sao chúc phúc ─ bạn・nỗ lực・hợp",
        "Gắn bó khó thay ─ cặp đôi ăn ý",
        "Duyên tâm giao ─ độ hợp siêu cao",
    ],
}

MIRACLE_LOW_VERDICTS = {
    "ja": [
        "まだ形の見えないご縁 ─ 第1話はここから",
        "少し不思議な結びつき ─ 伏線回収はこれから",
        "意外性のあるご縁 ─ 名探偵も二度見する相性",
        "慎重に育てたい関係 ─ 作戦会議が効く相性",
        "距離の縮め方が大切なご縁 ─ 次回に期待の相性",
    ],
    "zh-TW": [
        "尚未成形緣分 ─ 第一話就從這裡開始",
        "有些不可思議的牽絆 ─ 伏筆回收還在後頭",
        "出人意料的緣分 ─ 連名偵探都要再看一眼的契合",
        "需要細心呵護的關係 ─ 戰略會議很有效的契合",
        "縮短距離是關鍵的緣分 ─ 值得期待下回的契合",
    ],
    "ko": [
        "아직 형체가 보이지 않는 인연 ─ 제1화는 여기서부터",
        "조금 신비로운 연결 ─ 복선 회수는 아직 앞으로",
        "의외의 인연 ─ 명탐정도 두 번 보는 궁합",
        "신중하게 키우고 싶은 관계 ─ 작전 회의가 효과 있는 궁합",
        "거리를 좁히는 게 중요한 인연 ─ 다음 편이 기대되는 궁합",
    ],
    "vi": [
        "Duyên còn mờ ─ tập 1 bắt đầu từ đây",
        "Gắn kết hơi bí ẩn ─ nút thắt còn phía trước",
        "Duyên bất ngờ ─ thám tử cũng phải nhìn lại",
        "Quan hệ cần nâng niu ─ bàn bạc sẽ hiệu quả",
        "Cần rút ngắn khoảng cách ─ chờ tập sau",
    ],
}

# Regular verdicts by score threshold
REGULAR_VERDICTS = {
    "ja": {
        82: "運命を感じるご縁 ─ 主題歌が流れる相性",
        70: "自然に惹かれ合う ─ いいチームになれる相性",
        57: "心が通い合う ─ じわじわ良い相性",
        42: "歩み寄るほど深まる相性",
        0:  "ゆっくり育てたい、まだ序盤の相性",
    },
    "zh-TW": {
        82: "命中注定的緣分 ─ 主題曲響起般契合",
        70: "自然而然互相吸引 ─ 能成為好搭檔的契合",
        57: "心靈相通 ─ 慢慢變好的契合",
        42: "越靠近越深的契合",
        0:  "想慢慢培養的、還在開頭的契合",
    },
    "ko": {
        82: "운명을 느끼는 인연 ─ 주제가가 흐르는 궁합",
        70: "자연스럽게 끌리는 ─ 좋은 팀이 될 수 있는 궁합",
        57: "마음이 통하는 ─ 점점 좋아지는 궁합",
        42: "다가갈수록 깊어지는 궁합",
        0:  "천천히 키우고 싶은, 아직 초반인 궁합",
    },
    "vi": {
        82: "Duyên định mệnh ─ như nhạc chủ đề vang lên",
        70: "Tự nhiên cuốn hút ─ hợp thành cặp ăn ý",
        57: "Tâm giao ─ độ hợp dần lên",
        42: "Càng gần càng hợp",
        0:  "Độ hợp còn non, nên nuôi chậm",
    },
}


def pick_verdict(score: int, miracle: str | None, h: int, lang: str = "ja") -> str:
    lang = lang if lang in SUPPORTED_LANGS else "ja"
    if miracle == "high":
        v = MIRACLE_HIGH_VERDICTS[lang]
        return v[h % len(v)]
    if miracle == "low":
        v = MIRACLE_LOW_VERDICTS[lang]
        return v[h % len(v)]
    rv = REGULAR_VERDICTS[lang]
    for threshold in sorted(rv.keys(), reverse=True):
        if score >= threshold:
            return rv[threshold]
    return rv[0]


# ── 消息数组 ──────────────────────────────────────────────────────────

MESSAGES = {
    "miracle_high": {
        "ja": [
            "めったに見られないほど強い結びつきを感じる相性です。お互いの存在が安心感となり、関係を大切に育てるほど絆はさらに深まっていくでしょう。",
            "出会うべくして出会ったと思えるご縁です。言葉にしなくても気持ちが伝わりやすく、ふたりで過ごす時間が心の支えになっていきます。",
            "星の流れから見ると、おふたりは互いの魅力を自然に引き出し合える関係です。まるで冒険の一味に迎えたくなるような、頼もしさがあります。",
            "おふたりの間には、偶然とは思えない引力があります。向き合うほど、隠しコマンドを見つけたみたいに関係が強くなっていきそうです。",
            "この相性は、強いご縁とタイミングの良さを示しています。ここぞという場面では、まるで必殺技のカットインのように息が合うでしょう。",
        ],
        "zh-TW": [
            "這是極為罕見的強烈契合。彼此的存在帶來安心感，越是珍惜呵護這段關係，羈絆就會越來越深。",
            "這是一份彷彿注定相遇的緣分。即使不開口也能心意相通，兩人共度的時光將成為心靈的支柱。",
            "從星辰的軌跡來看，你們是能自然激發彼此魅力的關係。就像冒險旅途中想邀請入隊的可靠夥伴。",
            "你們之間有著無法用巧合解釋的引力。越是面對彼此，就像發現了隱藏指令一般，關係會越來越緊密。",
            "這份契合代表著深厚的緣分與絕佳的時機。在關鍵時刻，你們的默契就像必殺技的特寫鏡頭一樣完美。",
        ],
        "ko": [
            "매우 보기 드문 강한 결속을 느낄 수 있는 궁합입니다. 서로의 존재가 안정감이 되고, 관계를 소중히 키울수록 유대는 더욱 깊어질 것입니다.",
            "만나야 할 사람을 만났다고 느껴지는 인연입니다. 말하지 않아도 마음이 전해지고, 둘이 함께하는 시간이 마음의 버팀목이 됩니다.",
            "별의 흐름으로 보면, 두 분은 서로의 매력을 자연스럽게 끌어낼 수 있는 관계입니다. 모험의 일행에 맞이하고 싶은 든든함이 있습니다.",
            "두 분 사이에는 우연이라고 볼 수 없는 인력이 있습니다. 마주할수록 숨겨진 커맨드를 발견한 것처럼 관계가 강해질 것 같습니다.",
            "이 궁합은 강한 인연과 타이밍의 좋음을 보여줍니다. 결정적인 순간에는 필살기 컷인처럼 호흡이 맞을 것입니다.",
        ],
        "vi": [
            "Đây là mức tương hợp hiếm thấy với sự gắn kết mạnh mẽ. Sự hiện diện của nhau mang lại cảm giác an tâm, càng trân trọng nuôi dưỡng mối quan hệ thì tình cảm càng sâu đậm.",
            "Đây là một duyên phận dường như đã được định sẵn để gặp nhau. Dù không nói ra cũng dễ dàng truyền đạt tâm ý, thời gian hai người bên nhau sẽ trở thành chỗ dựa tinh thần.",
            "Theo dòng chảy tinh tú, hai bạn là mối quan hệ có thể tự nhiên khơi dậy sức hấp dẫn của nhau. Giống như một người đồng đội đáng tin cậy mà bạn muốn mời vào đội phiêu lưu.",
            "Giữa hai bạn có một lực hấp dẫn không thể coi là ngẫu nhiên. Càng đối mặt nhau, quan hệ càng trở nên bền chặt như phát hiện một lệnh ẩn.",
            "Độ hợp này cho thấy duyên sâu và thời điểm rất đẹp. Ở khoảnh khắc quan trọng, sự ăn ý sẽ sáng lên như cảnh tuyệt chiêu.",
        ],
    },
    "miracle_low": {
        "ja": [
            "今はまだ、お互いの距離感を探る時期かもしれません。焦らず相手の考え方を知っていくことで、思いがけない接点が見えてくるでしょう。",
            "価値観の違いが出やすい相性ですが、その違いは関係を広げるきっかけにもなります。丁寧な言葉選びが、ふたりの流れを変えてくれます。",
            "すぐに答えを決めつけず、少しずつ歩み寄ることが大切です。今は修行編だと思えば、伸びしろはかなり大きめです。",
            "星は、まだ余白の多い関係を示しています。名探偵なら見逃さない小さな伏線が、これから効いてくるかもしれません。",
            "おふたりの関係には、慎重さと素直さの両方が必要です。秘密道具を探すより、まずは一言のやさしさが近道になります。",
        ],
        "zh-TW": [
            "現在或許還在摸索彼此距離的階段。不急不躁地去了解對方的想法，會發現意想不到的共同點。",
            "這是價值觀差異較容易浮現的契合，但這些差異也能成為拓展關係的契機。用心斟酌的話語，能改變兩人之間的流向。",
            "不要太快下定論，慢慢靠近彼此才是最重要的。把現在當作修煉篇的話，未來的成長空間是相當大的。",
            "星辰揭示著這是一段還有許多留白的關係。那些名偵探才不會錯過的小伏筆，說不定日後會發揮作用。",
            "你們的關係需要謹慎與坦率並存。比起尋找秘密道具，一句溫柔的話才是最近的捷徑。",
        ],
        "ko": [
            "지금은 아직 서로의 거리감을 탐색하는 시기일지 모릅니다. 서두르지 말고 상대방의 생각을 알아가다 보면 뜻밖의 접점이 보일 것입니다.",
            "가치관의 차이가 나타나기 쉬운 궁합이지만, 그 차이는 관계를 넓히는 계기가 되기도 합니다. 신중한 말 선택이 두 사람의 흐름을 바꿔줍니다.",
            "너무 빨리 답을 정하지 말고 조금씩 다가가는 것이 중요합니다. 지금을 수행 편이라고 생각하면 성장 여지는 꽤 큽니다.",
            "별은 아직 여백이 많은 관계를 보여주고 있습니다. 명탐정이라면 놓치지 않을 작은 복선이 앞으로 효과를 발휘할지 모릅니다.",
            "두 분의 관계에는 신중함과 솔직함이 모두 필요합니다. 비밀 도구를 찾기보다 먼저 한마디의 다정함이 지름길이 됩니다.",
        ],
        "vi": [
            "Hiện tại có thể vẫn là giai đoạn tìm hiểu khoảng cách của nhau. Đừng vội vàng, hãy từ từ hiểu cách nghĩ của đối phương, những điểm chung bất ngờ sẽ dần hiện ra.",
            "Đây là độ hợp dễ lộ khác biệt về quan niệm sống, nhưng khác biệt ấy cũng mở rộng mối quan hệ. Lời nói cẩn thận sẽ đổi dòng chảy của hai người.",
            "Đừng vội kết luận, từng bước tiến lại gần nhau mới là điều quan trọng. Coi hiện tại như phần huấn luyện thì tiềm năng phát triển là rất lớn.",
            "Tinh tú cho thấy đây là một mối quan hệ còn nhiều khoảng trống. Những chi tiết nhỏ mà nhà thám tử không bỏ lỡ có thể sẽ phát huy tác dụng sau này.",
            "Mối quan hệ của hai bạn cần cả sự cẩn trọng lẫn chân thành. Thay vì tìm công cụ bí mật, một lời nói dịu dàng chính là lối tắt ngắn nhất.",
        ],
    },
    "high": {
        "ja": [
            "お互いの存在が、自然と心を明るくしてくれる相性です。無理をしなくても距離が縮まりやすく、一緒にいるほど信頼が深まります。",
            "違いさえも魅力として受け止めやすい関係です。素直な気持ちを伝えることで、恋の流れはさらに前向きに進んでいくでしょう。",
            "惹かれ合う力が強く、支え合える相性です。ふたりで全集中すれば、日常の小さな壁も軽やかに越えていけそうです。",
            "テンポの合いやすい相性です。まるで息ぴったりのチーム戦のように、相手の一手を自然に受け取れるでしょう。",
        ],
        "zh-TW": [
            "彼此的存在能自然地讓心情明朗起來。不必勉強也能輕易拉近距離，越在一起就越加深信任。",
            "連差異都能輕易視為魅力的關係。坦率地表達心意，感情的走向會更加積極向前。",
            "互相吸引的力量很強，是能互相扶持的契合。兩人齊心協力的話，日常的小障礙也能輕鬆跨越。",
            "節奏非常合拍的契合。就像配合默契的團隊戰一樣，能自然地接住對方的每一步。",
        ],
        "ko": [
            "서로의 존재가 자연스럽게 마음을 밝게 해주는 궁합입니다. 무리하지 않아도 거리가 좁혀지고, 함께할수록 신뢰가 깊어집니다.",
            "차이조차 매력으로 받아들이기 쉬운 관계입니다. 솔직한 마음을 전하면 사랑의 흐름은 더욱 긍정적으로 나아갈 것입니다.",
            "끌어당기는 힘이 강하고 서로를 지탱할 수 있는 궁합입니다. 둘이 함께 전력을 다하면 일상의 작은 벽도 가뿐히 넘을 수 있을 것입니다.",
            "템포가 잘 맞는 궁합입니다. 마치 호흡이 완벽하게 맞는 팀전처럼 상대의 한 수를 자연스럽게 받아들일 수 있을 것입니다.",
        ],
        "vi": [
            "Sự hiện diện của nhau tự nhiên làm sáng lòng người. Không cần cố gắng cũng dễ dàng thu hẹp khoảng cách, càng ở bên nhau sự tin tưởng càng sâu sắc.",
            "Mối quan hệ mà cả sự khác biệt cũng dễ dàng coi là sức hấp dẫn. Bày tỏ tâm ý chân thành, dòng chảy tình cảm sẽ tiến triển tích cực hơn.",
            "Sức hấp dẫn lẫn nhau rất mạnh, là mức tương hợp có thể nâng đỡ nhau. Nếu hai người cùng tập trung, những rào cản nhỏ trong cuộc sống hàng ngày cũng có thể vượt qua nhẹ nhàng.",
            "Nhịp độ rất ăn ý. Giống như chiến đấu đồng đội nhịp nhàng, có thể tự nhiên đón nhận mỗi bước đi của đối phương.",
        ],
    },
    "mid": {
        "ja": [
            "穏やかに育っていく相性です。焦らず相手のペースを尊重することで、信頼はゆっくり確かなものになります。",
            "ときに価値観の違いを感じても、それはお互いを知るための大切なきっかけです。素直な言葉が、ふたりの距離を縮めてくれます。",
            "心地よい風のように、自然体で向き合える関係です。小さな感謝を重ねるほど、ふたりの時間は温かくなっていきます。",
            "まだ派手な展開ではありませんが、じわじわ効いてくる良いご縁です。日常回を大切にすると、ちゃんと名場面が増えていきます。",
        ],
        "zh-TW": [
            "這是穩穩成長的契合。不急不躁地尊重彼此的步調，信任會慢慢變得踏實。",
            "即使有時感受到價值觀的差異，那也是了解彼此的重要契機。坦率的話語能縮短兩人之間的距離。",
            "像舒適的微風一樣，是可以自然真實面對彼此的關係。越是累積小小的感謝，兩人的時光就會越來越溫暖。",
            "雖然還沒有太戲劇性的發展，但這是漸漸發酵的好緣分。珍惜日常的每一集，名場面一定會越來越多。",
        ],
        "ko": [
            "차분하게 자라나는 궁합입니다. 서두르지 않고 상대방의 속도를 존중하면 신뢰는 천천히 확고해집니다.",
            "때로 가치관의 차이를 느끼더라도, 그것은 서로를 알아가기 위한 소중한 계기입니다. 솔직한 말이 두 사람의 거리를 좁혀줍니다.",
            "기분 좋은 바람처럼 자연스럽게 마주할 수 있는 관계입니다. 작은 감사를 쌓을수록 두 사람의 시간은 따뜻해집니다.",
            "아직 화려한 전개는 아니지만 서서히 효과를 발휘하는 좋은 인연입니다. 일상의 에피소드를 소중히 하면 명장면이 분명 늘어날 것입니다.",
        ],
        "vi": [
            "Đây là mức tương hợp trưởng thành một cách bình yên. Không vội vàng, tôn trọng nhịp độ của đối phương, niềm tin sẽ từ trở nên vững chắc.",
            "Dù đôi khi khác quan niệm sống, đó vẫn là cơ hội để hiểu nhau. Lời nói chân thành sẽ kéo hai người lại gần.",
            "Như một làn gió dễ chịu, là mối quan hệ có thể tự nhiên đối mặt với nhau. Càng tích lũy những lời cảm ơn nhỏ bé, thời gian của hai người sẽ càng ấm áp.",
            "Dù chưa có diễn biến kịch tính, nhưng đây là duyên tốt đang dần phát huy tác dụng. Trân trọng những tập hàng ngày, cảnh hay chắc chắn sẽ tăng lên.",
        ],
    },
    "low": {
        "ja": [
            "今はまだ手探りでも、関係を育てる余地は十分にあります。違いを否定せず、面白がる気持ちが距離を近づけます。",
            "ゆっくり時間をかけるほど深まるご縁です。相手の小さな優しさに気づくことで、関係は少しずつ温まっていきます。",
            "最初はすれ違いがあっても、理解しようとする姿勢が流れを変えます。歩み寄るほど、星はふたりの味方をしてくれるでしょう。",
            "今はまだ序盤のライバル関係に見えますが、会話を重ねるほど印象は変わります。焦らず、次の話数を楽しみにしてみてください。",
        ],
        "zh-TW": [
            "現在雖然還在摸索，但培養關係的空間非常充足。不去否定差異，帶著好奇的心態去面對，距離就會慢慢拉近。",
            "這是越花時間越深厚的緣分。注意到對方微小的溫柔，關係就會一點一點變得溫暖。",
            "即使一開始有誤會，試圖理解的心態能改變一切。越是靠近彼此，星辰越會站在你們這邊。",
            "現在看起來像是初期對手關係，但隨著對話的累積印象會改變。不急不躁，期待下一集的發展吧。",
        ],
        "ko": [
            "지금은 아직 더듬거리는 단계지만 관계를 키울 여지는 충분합니다. 차이를 부정하지 않고 재미있어하는 마음이 거리를 좁혀줍니다.",
            "천천히 시간을 들일수록 깊어지는 인연입니다. 상대방의 작은 다정함을 알아채면 관계는 조금씩 따뜻해집니다.",
            "처음에는 엇갈림이 있어도 이해하려는 자세가 흐름을 바꿉니다. 다가갈수록 별은 두 분의 편이 되어줄 것입니다.",
            "지금은 아직 초반의 라이벌 관계로 보이지만 대화를 거듭할수록 인상은 바뀝니다. 서두르지 말고 다음 화를 기대해 보세요.",
        ],
        "vi": [
            "Dù hiện tại còn dò dẫm, vẫn còn nhiều chỗ để vun đắp quan hệ. Đừng phủ nhận khác biệt; sự tò mò sẽ kéo hai người lại gần.",
            "Đây là duyên phận càng dành thời gian càng sâu đậm. Khi chú ý đến sự dịu dàng nhỏ bé của đối phương, mối quan hệ sẽ dần ấm lên.",
            "Dù ban đầu có hiểu lầm, thái độ muốn thấu hiểu sẽ thay đổi mọi thứ. Càng tiến lại gần, tinh tú càng đứng về phía hai bạn.",
            "Hiện tại có vẻ như mối quan hệ đối đầu giai đoạn đầu, nhưng ấn tượng sẽ thay đổi khi trò chuyện nhiều hơn. Đừng vội, hãy mong chờ tập tiếp theo.",
        ],
    },
}


def pick_message(score: int, miracle: str | None, h: int, lang: str = "ja") -> str:
    lang = lang if lang in SUPPORTED_LANGS else "ja"
    if miracle == "high":
        m = MESSAGES["miracle_high"][lang]
        return m[h % len(m)]
    if miracle == "low":
        m = MESSAGES["miracle_low"][lang]
        return m[h % len(m)]
    bucket = "high" if score >= 70 else ("mid" if score >= 45 else "low")
    m = MESSAGES[bucket][lang]
    return m[h % len(m)]


# ── 名前モードのアスペクトラベル ─────────────────────────────────────

RESONANCE_LABELS = {
    "ja": {
        "miracle_high": "言霊が、必殺技のように響き合っています",
        "miracle_low":  "言霊が、まだ次回予告を待っているようです",
        82: "言霊が、ぴたりとコンビ技になっています",
        70: "ふたつの名前が、やさしく響き合っています",
        57: "名前の響きが、心地よく調和しています",
        42: "ふたつの響きが、少しずつ寄り添っています",
        0:  "名前の響きが、ゆっくり距離を縮めています",
    },
    "zh-TW": {
        "miracle_high": "言靈正以必殺技般的氣勢共鳴著",
        "miracle_low":  "言靈似乎還在等待下集預告",
        82: "言靈完美地組成了雙人技",
        70: "兩個名字正在溫柔地共鳴著",
        57: "名字的音韻正舒適地和諧著",
        42: "兩道音韻正一點一點地靠近彼此",
        0:  "名字的音韻正慢慢縮短距離",
    },
    "ko": {
        "miracle_high": "이름의 울림이 필살기처럼 맞아떨어집니다",
        "miracle_low":  "이름의 울림이 아직 다음 예고를 기다립니다",
        82: "이름의 울림이 완벽한 콤비 기술이 되었습니다",
        70: "두 이름이 부드럽게 울려 퍼지고 있습니다",
        57: "이름의 울림이 기분 좋게 조화를 이루고 있습니다",
        42: "두 울림이 조금씩 가까워지고 있습니다",
        0:  "이름의 울림이 천천히 거리를 좁히고 있습니다",
    },
    "vi": {
        "miracle_high": "Âm tên cộng hưởng như tuyệt chiêu",
        "miracle_low":  "Âm tên còn chờ lời báo trước",
        82: "Âm tên thành kỹ thuật đôi hoàn hảo",
        70: "Hai cái tên vang lên thật dịu",
        57: "Âm tên hòa hợp dễ chịu",
        42: "Hai âm tên đang lại gần",
        0:  "Âm tên chậm rãi thu hẹp khoảng cách",
    },
}


def name_resonance_label(score: int, miracle: str | None, lang: str = "ja") -> str:
    lang = lang if lang in SUPPORTED_LANGS else "ja"
    labels = RESONANCE_LABELS[lang]
    if miracle == "high":
        return labels["miracle_high"]
    if miracle == "low":
        return labels["miracle_low"]
    for threshold in [82, 70, 57, 42]:
        if score >= threshold:
            return labels[threshold]
    return labels[0]


# ── miracle 判定 ─────────────────────────────────────────────────────

def determine_miracle(score: int) -> str | None:
    if 91 <= score <= 99:
        return "high"
    if 5 <= score <= 17:
        return "low"
    return None


# ── ハッシュ（FNV-1a） ────────────────────────────────────────────────

def _hash_string(s: str) -> int:
    """FNV-1a hash matching the JS hashString function."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


# ── 名前の等冪計算の素 ──────────────────────────────────────────────

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

def _apply_score_distribution(raw: float, h3: int) -> dict:
    roll = h3 % 20
    if roll == 0:
        return {"score": 91 + ((h3 >> 8) & 0xFF) % 9, "miracle": "high"}
    if roll == 1:
        return {"score": 5 + ((h3 >> 8) & 0xFF) % 13, "miracle": "low"}
    bucket = (h3 >> 4) % 10
    v = (h3 >> 8) & 0xFFFFFF
    if bucket < 4:
        return {"score": 70 + v % 11, "miracle": None}
    if bucket < 7:
        return {"score": 80 + v % 11, "miracle": None}
    if bucket < 9:
        return {"score": 50 + v % 21, "miracle": None}
    return {"score": 30 + v % 21, "miracle": None}


# ── 黄道まわりの計算 ────────────────────────────────────────────────

def _sun_ecliptic_longitude(dt: datetime) -> float:
    epoch = datetime(1970, 1, 1)
    jd = (dt - epoch).total_seconds() / 86400.0 + 2440587.5
    n = jd - 2451545.0
    L = 280.460 + 0.9856474 * n
    g = (357.528 + 0.9856003 * n) * math.pi / 180.0
    lon = L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g)
    return ((lon % 360) + 360) % 360


def _sign_center(key: str) -> int:
    for i, z in enumerate(ZODIAC):
        if z["key"] == key:
            return i * 30 + 15
    return 0


def _ang_dist(a: float, b: float) -> float:
    d = ((a - b) % 360 + 360) % 360
    return 360 - d if d > 180 else d


# ── アスペクト（角度関係） ────────────────────────────────────────────

_ASPECTS = [
    {"a": 0,   "v": 0.88, "orb": 10},
    {"a": 60,  "v": 0.82, "orb": 8},
    {"a": 90,  "v": 0.40, "orb": 8},
    {"a": 120, "v": 0.98, "orb": 10},
    {"a": 150, "v": 0.38, "orb": 6},
    {"a": 180, "v": 0.62, "orb": 10},
]


def _aspect_harmony(deg: float) -> float:
    acc = 0.0
    wsum = 0.0
    for asp in _ASPECTS:
        w = max(0.0, 1 - abs(deg - asp["a"]) / asp["orb"])
        acc += asp["v"] * w
        wsum += w
    return acc / wsum if wsum > 0 else 0.5


_ASPECT_NAMES = {
    "ja": {
        0:   "重なり合うご縁（コンジャンクション）",
        30:  "ゆるやかに近づくご縁（セミセクスタイル）",
        60:  "心地よく支え合う関係（セクスタイル）",
        90:  "刺激し合い成長できる関係（スクエア）",
        120: "自然に響き合う関係（トライン）",
        150: "歩み寄りが鍵になる関係（インコンジャンクト）",
        180: "向き合うほど惹かれる関係（オポジション）",
    },
    "zh-TW": {
        0:   "重疊交織的緣分（合相）",
        30:  "緩緩靠近的緣分（半六分相）",
        60:  "舒適互助的關係（六分相）",
        90:  "互相刺激成長的關係（四分相）",
        120: "自然共鳴的關係（三分相）",
        150: "需要調整步調的關係（梅花相）",
        180: "越面對越被吸引的關係（對分相）",
    },
    "ko": {
        0:   "겹쳐지는 인연 (컨정션)",
        30:  "느긋하게 다가가는 인연 (세미섹스타일)",
        60:  "편안하게 서로를 돕는 관계 (섹스타일)",
        90:  "자극하며 성장할 수 있는 관계 (스퀘어)",
        120: "자연스럽게 공명하는 관계 (트라인)",
        150: "조율이 열쇠가 되는 관계 (퀸컨스)",
        180: "마주할수록 끌리는 관계 (오포지션)",
    },
    "vi": {
        0:   "Duyên trùng nhịp (góc hợp)",
        30:  "Duyên tiến gần (bán lục hợp)",
        60:  "Quan hệ nâng đỡ (lục hợp)",
        90:  "Quan hệ cùng lớn lên (góc vuông)",
        120: "Quan hệ cộng hưởng (tam hợp)",
        150: "Quan hệ cần chỉnh nhịp (150°)",
        180: "Càng đối diện càng hút (đối đỉnh)",
    },
}


def _aspect_name(sep: float, lang: str = "ja") -> str:
    lang = lang if lang in SUPPORTED_LANGS else "ja"
    s = round(sep / 30) * 30
    names = _ASPECT_NAMES[lang]
    fallback = {
        "ja": "星が示すご縁",
        "zh-TW": "星辰指引的緣分",
        "ko": "별이 보여주는 인연",
        "vi": "Duyên do sao chỉ lối",
    }
    return names.get(s, fallback.get(lang, fallback["ja"]))


def _zodiac_affinity_by_sun(key_left: str, key_right: str, sun_lon: float) -> dict:
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
    return {"score": score, "aspect_name": sep, "sun_sign": sun_sign}


# ── 統一入口：名前だけの相性 ──────────────────────────────────────────

def compute_by_name(name_left: str, name_right: str, lang: str = "ja") -> dict:
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
        "verdict": pick_verdict(dist["score"], dist["miracle"], h, lang),
        "message": pick_message(dist["score"], dist["miracle"], h, lang),
        "aspect": name_resonance_label(dist["score"], dist["miracle"], lang),
    }


# ── 統一入口：星座＋名前の相性 ───────────────────────────────────────

def compute_compatibility(
    name_left: str,
    zodiac_left: str,
    name_right: str,
    zodiac_right: str,
    lang: str = "ja",
) -> dict:
    z_left = find_zodiac(zodiac_left)
    z_right = find_zodiac(zodiac_right)
    parts = _name_seed_parts(name_left, name_right)
    raw, h, h3, now = parts["raw"], parts["h"], parts["h3"], parts["now"]

    sun_lon = _sun_ecliptic_longitude(now)
    z = _zodiac_affinity_by_sun(zodiac_left, zodiac_right, sun_lon)

    pre = _apply_score_distribution(raw, h3)
    if pre["miracle"]:
        score, miracle = pre["score"], pre["miracle"]
    else:
        same_sign = 0.04 if zodiac_left == zodiac_right else 0
        blended = max(0.0, min(1.0, raw * 0.5 + z["score"] * 0.5 + same_sign))
        score = round(20 + blended * 70)
        miracle = None

    sep = z["aspect_name"]

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
        "verdict": pick_verdict(score, miracle, h, lang),
        "message": pick_message(score, miracle, h, lang),
        "aspect": _aspect_name(sep, lang),
    }


# ── 管理者スコア指定ビルド ────────────────────────────────────────────

def build_outcome_with_score(
    score: int,
    mode: str,
    name_left: str,
    name_right: str,
    zodiac_left: str | None = None,
    zodiac_right: str | None = None,
    lang: str = "ja",
) -> dict:
    score = max(0, min(100, score))
    miracle = determine_miracle(score)
    h = random.randint(0, 1000000)
    verdict = pick_verdict(score, miracle, h, lang)
    message = pick_message(score, miracle, h, lang)
    aspect = name_resonance_label(score, miracle, lang)

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

    if mode == "zodiac" and z_left and z_right:
        now = datetime.now()
        sun_lon = _sun_ecliptic_longitude(now)
        z = _zodiac_affinity_by_sun(zodiac_left, zodiac_right, sun_lon)
        result["affinity"] = z["score"]
        result["sunSign"] = z["sun_sign"]
        sep = z["aspect_name"]
        result["aspect"] = _aspect_name(sep, lang)

    return result


# ── 互換：旧 build_outcome_normal ─────────────────────────────────────

def build_outcome_normal(
    mode: str,
    name_left: str,
    name_right: str,
    zodiac_left: str | None = None,
    zodiac_right: str | None = None,
    lang: str = "ja",
) -> dict:
    if mode == "zodiac" and zodiac_left and zodiac_right:
        return compute_compatibility(name_left, zodiac_left, name_right, zodiac_right, lang)
    return compute_by_name(name_left, name_right, lang)

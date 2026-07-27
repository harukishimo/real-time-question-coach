#!/usr/bin/env python3
"""Build a fresh, reference-inspired onboarding video storyboard.

The supplied reference uses a simple composition: explanatory copy on the
left, a wide product surface on the right, and a restrained enterprise UI.
This generator intentionally does not reuse the old phone/monitor layout.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Callable, Sequence

from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT = 1920, 1080
BG = (239, 243, 237)
INK = (25, 43, 51)
MUTED = (105, 119, 116)
NAVY = (8, 31, 52)
GREEN = (24, 126, 104)
GREEN_DARK = (14, 94, 80)
GREEN_PALE = (222, 239, 230)
GREEN_TINT = (232, 245, 236)
BLUE = (53, 111, 169)
BLUE_PALE = (229, 239, 249)
AMBER = (205, 143, 34)
AMBER_PALE = (250, 240, 211)
SURFACE = (248, 250, 248)
LINE = (210, 221, 216)
WHITE = (255, 255, 255)

FONT_REGULAR = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"
FONT_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size, index=0)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int,
         fill: tuple[int, int, int] = INK, bold: bool = False, anchor: str | None = None) -> None:
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def wrap(value: str, limit: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for char in value:
        if char == "\n":
            lines.append(line)
            line = ""
        elif len(line) >= limit:
            lines.append(line)
            line = char
        else:
            line += char
    if line:
        lines.append(line)
    return lines


def paragraph(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int,
              fill: tuple[int, int, int] = MUTED, limit: int = 16, gap: int = 9) -> None:
    x, y = xy
    for line in wrap(value, limit):
        text(draw, (x, y), line, size, fill=fill)
        y += size + gap


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int,
            fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None,
            width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], label: str,
         fill: tuple[int, int, int], fg: tuple[int, int, int] = INK,
         size: int = 13, pad_x: int = 12, pad_y: int = 6) -> tuple[int, int, int, int]:
    x, y = xy
    f = font(size, bold=True)
    left, top, right, bottom = draw.textbbox((x, y), label, font=f)
    box = (x, y, x + (right - left) + pad_x * 2, y + (bottom - top) + pad_y * 2)
    rounded(draw, box, (bottom - top + pad_y * 2) // 2, fill)
    text(draw, (x + pad_x, y + pad_y - 1), label, size, fill=fg, bold=True)
    return box


def check(draw: ImageDraw.ImageDraw, center: tuple[int, int], color: tuple[int, int, int] = GREEN) -> None:
    x, y = center
    draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=color)
    draw.line((x - 6, y, x - 1, y + 5, x + 8, y - 6), fill=WHITE, width=3, joint="curve")


def dot(draw: ImageDraw.ImageDraw, center: tuple[int, int], color: tuple[int, int, int], radius: int = 9) -> None:
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def draw_left_copy(draw: ImageDraw.ImageDraw, caption: str) -> None:
    pill(draw, (58, 88), "PRODUCT GUIDE", GREEN_PALE, fg=GREEN, size=13, pad_x=14, pad_y=7)
    text(draw, (58, 204), "リアルタイム", 43, fill=INK, bold=True)
    text(draw, (58, 258), "質問コーチ", 43, fill=INK, bold=True)
    text(draw, (58, 354), "会話中の文字起こしと", 17, fill=MUTED)
    text(draw, (58, 386), "AI補助カードで、次に聞くべき", 17, fill=MUTED)
    text(draw, (58, 418), "質問を見つける。", 17, fill=MUTED)
    for index, label in enumerate(("セッション設定", "文字起こし", "AI補助カード", "レポート保存")):
        y = 676 + index * 45
        dot(draw, (67, y + 8), GREEN, 7)
        text(draw, (91, y), label, 16, fill=INK, bold=True)
    text(draw, (58, 930), caption, 14, fill=GREEN, bold=True)
    text(draw, (58, 957), "画面の変化を順番に見ていきます", 12, fill=MUTED)


def draw_app_nav(draw: ImageDraw.ImageDraw, active: str) -> None:
    draw.rectangle((350, 60, 1858, 130), fill=NAVY)
    rounded(draw, (380, 80, 419, 119), 10, fill=(64, 157, 133))
    check(draw, (400, 100), NAVY)
    text(draw, (440, 83), "Realtime Question Coach", 20, fill=WHITE, bold=True)
    menu = ("セッション", "文字起こし", "AI補助", "レポート")
    for index, label in enumerate(menu):
        x = 820 + index * 142
        text(draw, (x, 86), label, 15, fill=WHITE if label == active else (177, 194, 202), bold=label == active)
        if label == active:
            draw.rectangle((x, 121, x + 74, 124), fill=(78, 174, 151))
    rounded(draw, (1584, 78, 1788, 117), 19, fill=(21, 57, 82))
    dot(draw, (1612, 98), (116, 182, 221), 11)
    text(draw, (1633, 87), "操作中", 12, fill=WHITE, bold=True)


def draw_app_surface(draw: ImageDraw.ImageDraw, active: str, renderer: Callable[[ImageDraw.ImageDraw], None]) -> None:
    # Shadow + rounded app surface mirror the supplied reference's product mock.
    rounded(draw, (366, 76, 1868, 1025), 24, fill=(210, 220, 211))
    rounded(draw, (350, 60, 1858, 1008), 24, fill=WHITE)
    draw_app_nav(draw, active)
    renderer(draw)


def draw_setup(draw: ImageDraw.ImageDraw) -> None:
    text(draw, (410, 169), "セッション設定", 26, fill=INK, bold=True)
    text(draw, (410, 207), "会話の目的と参加者を設定して、セッションを始めます。", 14, fill=MUTED)
    rounded(draw, (404, 258, 1090, 935), 16, fill=SURFACE, outline=LINE, width=1)
    rounded(draw, (1122, 258, 1800, 935), 16, fill=(243, 248, 244), outline=LINE, width=1)
    text(draw, (436, 291), "会話のタイプ", 15, fill=MUTED, bold=True)
    for i, label in enumerate(("要件定義", "商談", "1on1")):
        box = (436 + i * 170, 329, 588 + i * 170, 382)
        rounded(draw, box, 12, fill=GREEN_PALE if i == 0 else WHITE, outline=GREEN if i == 0 else LINE, width=2)
        text(draw, ((box[0] + box[2]) // 2, 355), label, 15, fill=GREEN if i == 0 else MUTED, bold=i == 0, anchor="mm")
    text(draw, (436, 432), "今回のゴール", 15, fill=MUTED, bold=True)
    rounded(draw, (436, 466, 1058, 532), 11, fill=WHITE, outline=LINE, width=2)
    text(draw, (458, 487), "MVPで確認すべき要件を整理する", 15, fill=INK)
    text(draw, (436, 582), "参加者（任意）", 15, fill=MUTED, bold=True)
    rounded(draw, (436, 616, 1058, 682), 11, fill=WHITE, outline=LINE, width=2)
    text(draw, (458, 637), "プロダクト担当 / 顧客担当", 15, fill=INK)
    rounded(draw, (436, 767, 1058, 830), 12, fill=GREEN)
    text(draw, (747, 798), "セッションを開始", 17, fill=WHITE, bold=True, anchor="mm")
    text(draw, (1156, 294), "開始前チェック", 15, fill=MUTED, bold=True)
    for index, label in enumerate(("会話タイプ", "今回の目的", "ブラウザマイク")):
        y = 364 + index * 112
        check(draw, (1167, y), GREEN)
        text(draw, (1194, y - 12), label, 15, fill=INK, bold=True)
        text(draw, (1194, y + 14), "設定済み", 12, fill=MUTED)


def transcript_item(draw: ImageDraw.ImageDraw, y: int, time: str, speaker: str, value: str,
                    color: tuple[int, int, int]) -> None:
    text(draw, (435, y), time, 12, fill=MUTED)
    dot(draw, (504, y + 10), color, 10)
    text(draw, (532, y - 4), speaker, 13, fill=color, bold=True)
    text(draw, (532, y + 22), value, 15, fill=INK)


def coach_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], title: str,
               question: str, detail: str, tone: tuple[int, int, int], priority: str,
               primary_label: str = "聞いた") -> None:
    x1, y1, x2, y2 = box
    if tone == AMBER:
        badge_fill, badge_fg = AMBER_PALE, AMBER
    elif tone == GREEN:
        badge_fill, badge_fg = GREEN_PALE, GREEN
    else:
        badge_fill, badge_fg = BLUE_PALE, BLUE
    rounded(draw, (x1 + 8, y1 + 9, x2 + 8, y2 + 9), 12, fill=(215, 225, 222))
    rounded(draw, box, 12, fill=WHITE, outline=(181, 204, 222), width=2)
    draw.rectangle((x1, y1, x1 + 8, y2), fill=tone)
    pill(draw, (x1 + 28, y1 + 20), priority, badge_fill, fg=badge_fg, size=11, pad_x=10, pad_y=5)
    text(draw, (x1 + 28, y1 + 69), title, 17, fill=INK, bold=True)
    paragraph(draw, (x1 + 28, y1 + 105), question, 14, fill=INK, limit=29, gap=6)
    text(draw, (x1 + 28, y1 + 157), detail, 12, fill=MUTED)
    rounded(draw, (x1 + 28, y2 - 48, x1 + 116, y2 - 16), 8, fill=GREEN)
    text(draw, (x1 + 72, y2 - 32), primary_label, 12, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (x1 + 130, y2 - 48, x1 + 224, y2 - 16), 8, fill=WHITE, outline=LINE, width=1)
    text(draw, (x1 + 177, y2 - 32), "あとで", 12, fill=MUTED, anchor="mm")


def draw_live(draw: ImageDraw.ImageDraw, transcript_count: int, card_stage: int) -> None:
    text(draw, (410, 169), "要件定義セッション", 26, fill=INK, bold=True)
    pill(draw, (410, 207), "音声接続中", GREEN_PALE, fg=GREEN, size=12, pad_x=12, pad_y=6)
    text(draw, (560, 218), "00:08", 13, fill=MUTED)
    rounded(draw, (404, 270, 1090, 942), 16, fill=(247, 251, 248), outline=LINE, width=1)
    rounded(draw, (1122, 270, 1800, 942), 16, fill=(241, 247, 250), outline=(193, 211, 219), width=1)
    rounded(draw, (404, 270, 1090, 333), 16, fill=GREEN_TINT)
    draw.rectangle((404, 310, 1090, 333), fill=GREEN_TINT)
    rounded(draw, (1122, 270, 1800, 333), 16, fill=BLUE_PALE)
    draw.rectangle((1122, 310, 1800, 333), fill=BLUE_PALE)
    text(draw, (438, 291), "リアルタイム文字起こし", 17, fill=INK, bold=True)
    text(draw, (1158, 291), "AI補助カード", 17, fill=INK, bold=True)
    transcript = (
        ("10:02", "あなた", "MVP対象は管理画面の権限設定までにしたい。", BLUE),
        ("10:03", "佐藤", "一般ユーザーは閲覧のみ、編集は管理者だけ。", GREEN),
        ("10:04", "あなた", "閲覧範囲は自部署だけか、全社かを決めたい。", BLUE),
        ("10:05", "田中", "緊急時はプロダクト責任者が承認します。", GREEN),
        ("10:06", "あなた", "監査ログは90日保存、削除権限は管理者のみで。", BLUE),
        ("10:07", "佐藤", "初期ユーザーはCSV登録、上限は500名です。", GREEN),
    )
    for index, item in enumerate(transcript[:transcript_count]):
        transcript_item(draw, 365 + index * 86, *item)
    draw.line((435, 855, 1052, 855), fill=LINE, width=1)
    text(draw, (435, 882), "発言・決定・不足情報を自動で整理しています", 13, fill=MUTED)
    if card_stage == 0:
        rounded(draw, (1160, 382, 1762, 590), 12, fill=(247, 250, 251), outline=LINE, width=1)
        text(draw, (1461, 456), "発言を論点ごとに分析中…", 15, fill=MUTED, anchor="mm")
        text(draw, (1461, 487), "誰・期限・条件・例外の不足を検出", 12, fill=MUTED, anchor="mm")
        draw.ellipse((1445, 507, 1477, 539), outline=GREEN, width=3)
    elif card_stage == 1:
        coach_card(draw, (1160, 365, 1762, 600), "閲覧範囲", "一般ユーザーは自部署だけか、全社を見られるか？",
                   "不足: 対象範囲 / 運用ルール", BLUE, "未確認")
    elif card_stage == 2:
        coach_card(draw, (1160, 365, 1762, 600), "閲覧範囲", "一般ユーザーは自部署だけか、全社を見られるか？",
                   "不足: 対象範囲 / 運用ルール", BLUE, "未確認")
        coach_card(draw, (1160, 625, 1762, 860), "例外時の承認", "緊急対応は誰が承認し、代替者は誰か？",
                   "不足: 承認者 / 期限 / 記録", AMBER, "未確認")
    elif card_stage == 3:
        coach_card(draw, (1160, 365, 1762, 600), "権限ルール", "一般ユーザーは閲覧のみ、編集は管理者に限定する。",
                   "確認済み: 一般=閲覧 / 管理者=編集", GREEN, "一部確認", "確定")
        coach_card(draw, (1160, 625, 1762, 860), "例外時の承認", "緊急対応は誰が承認し、代替者は誰か？",
                   "不足: 承認者 / 期限 / 記録", AMBER, "未確認")
    else:
        coach_card(draw, (1160, 365, 1762, 600), "権限ルール", "一般ユーザーは閲覧のみ、編集は管理者に限定する。",
                   "決定: 一般=閲覧 / 管理者=編集", GREEN, "確認済み", "確定")
        coach_card(draw, (1160, 625, 1762, 860), "監査ログ", "90日保存で法務要件を満たすか？CSV出力は必要か？",
                   "不足: 保存期間の根拠 / 出力要否", AMBER, "一部確認")
    card_count = 0 if card_stage == 0 else (1 if card_stage == 1 else 2)
    status_y = 895 if card_count > 1 else (650 if card_count == 1 else 618)
    text(draw, (1158, status_y), "会話中に定期更新", 13, fill=GREEN, bold=True)
    dot(draw, (1745, status_y - 4), GREEN, 8)


def draw_report(draw: ImageDraw.ImageDraw, detail_count: int) -> None:
    text(draw, (410, 169), "セッションレポート", 26, fill=INK, bold=True)
    pill(draw, (410, 207), "完了", GREEN_PALE, fg=GREEN, size=12, pad_x=12, pad_y=6)
    text(draw, (520, 218), "要件定義 / 18分 / 7月24日", 13, fill=MUTED)
    rounded(draw, (404, 270, 1160, 924), 16, fill=SURFACE, outline=LINE, width=1)
    rounded(draw, (1190, 270, 1800, 924), 16, fill=(243, 248, 244), outline=LINE, width=1)
    text(draw, (440, 311), "決定事項とアクション", 17, fill=MUTED, bold=True)
    columns = ((440, "論点"), (580, "決定・記録"), (925, "担当"), (1025, "期限"))
    for x, label in columns:
        text(draw, (x, 357), label, 12, fill=MUTED, bold=True)
    draw.line((440, 382, 1128, 382), fill=LINE, width=1)
    rows = (
        ("MVP範囲", "管理画面の権限設定まで", "佐藤", "7/31"),
        ("権限", "一般=閲覧 / 管理者=編集", "田中", "7/24"),
        ("例外承認", "責任者承認。代替者は未確認", "田中", "7/25"),
        ("監査ログ", "90日保存 / CSV出力は要確認", "鈴木", "7/26"),
        ("初期登録", "CSV・最大500名", "佐藤", "7/29"),
    )
    for index, row in enumerate(rows[:detail_count]):
        y = 414 + index * 72
        check(draw, (457, y + 7), GREEN if index < 2 else BLUE)
        text(draw, (480, y), row[0], 12, fill=INK, bold=True)
        text(draw, (580, y), row[1], 12, fill=INK)
        text(draw, (925, y), row[2], 12, fill=INK)
        text(draw, (1025, y), row[3], 12, fill=INK)
        draw.line((440, y + 43, 1128, y + 43), fill=(228, 235, 230), width=1)
    if detail_count < len(rows):
        text(draw, (440, 784), "残りの発言も整理しています…", 12, fill=MUTED)
    rounded(draw, (440, 800, 742, 860), 11, fill=GREEN)
    text(draw, (591, 830), "レポートを保存", 16, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (768, 800, 1070, 860), 11, fill=WHITE, outline=LINE, width=2)
    text(draw, (919, 830), "文字起こしを保存", 15, fill=INK, anchor="mm")
    text(draw, (1228, 311), "未確認論点", 17, fill=MUTED, bold=True)
    rounded(draw, (1228, 370, 1762, 492), 11, fill=AMBER_PALE, outline=(235, 209, 146), width=1)
    text(draw, (1252, 392), "閲覧範囲", 15, fill=INK, bold=True)
    text(draw, (1252, 424), "自部署のみ / 全社を決める", 13, fill=INK)
    text(draw, (1252, 454), "担当: 佐藤　期限: 7/24", 12, fill=MUTED)
    text(draw, (1228, 568), "次のアクション", 17, fill=MUTED, bold=True)
    for index, (owner, action) in enumerate((("田中", "代替承認者を決める"), ("鈴木", "監査ログの法務要件を確認"), ("佐藤", "CSVサンプルを共有"))):
        y = 625 + index * 62
        rounded(draw, (1228, y, 1250, y + 22), 5, fill=WHITE, outline=GREEN, width=2)
        text(draw, (1268, y - 1), action, 13, fill=INK, bold=True)
        text(draw, (1268, y + 24), f"担当: {owner}", 11, fill=MUTED)


def draw_final(draw: ImageDraw.ImageDraw) -> None:
    text(draw, (410, 169), "会話後に残るもの", 26, fill=INK, bold=True)
    text(draw, (410, 207), "決定事項・未確認論点・担当と期限を、そのまま持ち帰れます。", 14, fill=MUTED)
    rounded(draw, (404, 270, 1800, 924), 16, fill=SURFACE, outline=LINE, width=1)
    cards = (
        (640, "決定事項", "一般ユーザーは閲覧のみ", GREEN),
        (1100, "未確認論点", "閲覧範囲: 自部署 / 全社", AMBER),
        (1560, "アクション", "田中: 代替承認者を7/25まで", BLUE),
    )
    for x, heading, value, tone in cards:
        rounded(draw, (x - 170, 380, x + 170, 585), 14, fill=WHITE, outline=LINE, width=1)
        dot(draw, (x - 135, 425), tone, 9)
        text(draw, (x - 112, 413), heading, 16, fill=INK, bold=True)
        paragraph(draw, (x - 135, 478), value, 15, fill=INK, limit=14, gap=8)
    rounded(draw, (805, 690, 1395, 756), 12, fill=GREEN)
    text(draw, (1100, 723), "次のセッションを開始", 17, fill=WHITE, bold=True, anchor="mm")
    text(draw, (1100, 820), "話した内容が、次に使える議事録へ変わります。", 16, fill=INK, bold=True, anchor="mm")


SCENES: Sequence[dict[str, object]] = (
    {"caption": "目的と参加者を設定", "active": "セッション", "renderer": draw_setup},
    {"caption": "音声接続。会話を開始", "active": "セッション", "renderer": lambda draw: draw_live(draw, 1, 0)},
    {"caption": "発言が文字起こしされる", "active": "文字起こし", "renderer": lambda draw: draw_live(draw, 3, 0)},
    {"caption": "不足情報を質問カード化", "active": "AI補助", "renderer": lambda draw: draw_live(draw, 4, 1)},
    {"caption": "次の論点を追加で深掘り", "active": "AI補助", "renderer": lambda draw: draw_live(draw, 5, 2)},
    {"caption": "決定事項と不足情報を分離", "active": "AI補助", "renderer": lambda draw: draw_live(draw, 6, 3)},
    {"caption": "確認済みカードを更新", "active": "AI補助", "renderer": lambda draw: draw_live(draw, 6, 4)},
    {"caption": "議事録の骨子を生成", "active": "レポート", "renderer": lambda draw: draw_report(draw, 2)},
    {"caption": "担当と期限まで残す", "active": "レポート", "renderer": lambda draw: draw_report(draw, 5)},
    {"caption": "会話の次の一手を決める", "active": "レポート", "renderer": draw_final},
)


def render_scene(scene: dict[str, object]) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw_left_copy(draw, str(scene["caption"]))
    renderer = scene["renderer"]
    assert callable(renderer)
    draw_app_surface(draw, str(scene["active"]), renderer)
    return image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for index, scene in enumerate(SCENES):
        render_scene(scene).save(args.output / f"scene-{index:02d}.png", optimize=True)
    print(f"wrote {len(SCENES)} fresh scenes to {args.output}")


if __name__ == "__main__":
    main()

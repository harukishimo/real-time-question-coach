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
    rounded(draw, (1663, 78, 1828, 117), 19, fill=(21, 57, 82))
    dot(draw, (1690, 98), (116, 182, 221), 11)
    text(draw, (1711, 87), "操作中", 12, fill=WHITE, bold=True)


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
               question: str, tone: tuple[int, int, int], priority: str) -> None:
    x1, y1, x2, y2 = box
    rounded(draw, (x1 + 8, y1 + 9, x2 + 8, y2 + 9), 12, fill=(215, 225, 222))
    rounded(draw, box, 12, fill=WHITE, outline=(181, 204, 222), width=2)
    draw.rectangle((x1, y1, x1 + 8, y2), fill=tone)
    pill(draw, (x1 + 28, y1 + 20), priority, AMBER_PALE if tone == AMBER else BLUE_PALE,
         fg=AMBER if tone == AMBER else BLUE, size=11, pad_x=10, pad_y=5)
    text(draw, (x1 + 28, y1 + 69), title, 17, fill=INK, bold=True)
    paragraph(draw, (x1 + 28, y1 + 105), question, 14, fill=INK, limit=29, gap=6)
    rounded(draw, (x1 + 28, y2 - 48, x1 + 116, y2 - 16), 8, fill=GREEN)
    text(draw, (x1 + 72, y2 - 32), "聞いた", 12, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (x1 + 130, y2 - 48, x1 + 224, y2 - 16), 8, fill=WHITE, outline=LINE, width=1)
    text(draw, (x1 + 177, y2 - 32), "あとで", 12, fill=MUTED, anchor="mm")


def draw_live(draw: ImageDraw.ImageDraw, transcript_count: int, card_count: int) -> None:
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
        ("10:02", "あなた", "MVPの範囲をまず決めたいです。", BLUE),
        ("10:03", "相手", "権限まわりは管理者だけで良さそうです。", GREEN),
        ("10:04", "あなた", "例外のときはどうしますか？", BLUE),
    )
    for index, item in enumerate(transcript[:transcript_count]):
        transcript_item(draw, 385 + index * 130, *item)
    draw.line((435, 770, 1052, 770), fill=LINE, width=1)
    text(draw, (435, 798), "話した内容を自動で整理しています", 13, fill=MUTED)
    if card_count == 0:
        rounded(draw, (1160, 382, 1762, 590), 12, fill=(247, 250, 251), outline=LINE, width=1)
        text(draw, (1461, 476), "会話を分析中…", 15, fill=MUTED, anchor="mm")
        draw.ellipse((1445, 507, 1477, 539), outline=GREEN, width=3)
    else:
        coach_card(draw, (1160, 365, 1762, 600), "権限の確認", "管理者以外は、どこまで操作できますか？", BLUE, "未確認")
        if card_count > 1:
            coach_card(draw, (1160, 625, 1762, 860), "例外条件", "想定外のケースはありますか？", AMBER, "未確認")
    status_y = 895 if card_count > 1 else (650 if card_count == 1 else 618)
    text(draw, (1158, status_y), "会話中に定期更新", 13, fill=GREEN, bold=True)
    dot(draw, (1745, status_y - 4), GREEN, 8)


def draw_report(draw: ImageDraw.ImageDraw) -> None:
    text(draw, (410, 169), "セッションレポート", 26, fill=INK, bold=True)
    pill(draw, (410, 207), "完了", GREEN_PALE, fg=GREEN, size=12, pad_x=12, pad_y=6)
    text(draw, (520, 218), "要件定義 / 18分", 13, fill=MUTED)
    rounded(draw, (404, 270, 1160, 924), 16, fill=SURFACE, outline=LINE, width=1)
    rounded(draw, (1190, 270, 1800, 924), 16, fill=(243, 248, 244), outline=LINE, width=1)
    text(draw, (440, 311), "確認できたこと", 17, fill=MUTED, bold=True)
    for index, label in enumerate(("MVPの対象範囲", "管理者の操作", "次回の宿題")):
        y = 370 + index * 80
        check(draw, (457, y), GREEN)
        text(draw, (492, y - 12), label, 15, fill=INK, bold=True)
        text(draw, (492, y + 16), "会話から確認済み", 12, fill=MUTED)
    text(draw, (1228, 311), "未確認のこと", 17, fill=MUTED, bold=True)
    rounded(draw, (1228, 370, 1762, 490), 11, fill=AMBER_PALE, outline=(235, 209, 146), width=1)
    text(draw, (1252, 393), "例外時の承認フロー", 15, fill=INK, bold=True)
    text(draw, (1252, 426), "次回の会話で確認しましょう", 12, fill=MUTED)
    rounded(draw, (440, 800, 742, 860), 11, fill=GREEN)
    text(draw, (591, 830), "レポートを保存", 16, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (768, 800, 1070, 860), 11, fill=WHITE, outline=LINE, width=2)
    text(draw, (919, 830), "文字起こしを保存", 15, fill=INK, anchor="mm")
    text(draw, (1228, 620), "保存先", 14, fill=MUTED, bold=True)
    text(draw, (1228, 660), "この端末", 16, fill=INK, bold=True)
    text(draw, (1228, 694), "ブラウザから保存できます", 12, fill=MUTED)


def draw_final(draw: ImageDraw.ImageDraw) -> None:
    text(draw, (410, 169), "次の会話へ", 26, fill=INK, bold=True)
    text(draw, (410, 207), "画面の案内に沿って、すぐに始められます。", 14, fill=MUTED)
    rounded(draw, (404, 270, 1800, 924), 16, fill=SURFACE, outline=LINE, width=1)
    text(draw, (1100, 405), "会話に集中して、", 27, fill=INK, bold=True, anchor="mm")
    text(draw, (1100, 452), "次の質問はAIに任せる。", 27, fill=GREEN, bold=True, anchor="mm")
    rounded(draw, (930, 560, 1270, 625), 12, fill=GREEN)
    text(draw, (1100, 592), "新しいセッション", 17, fill=WHITE, bold=True, anchor="mm")
    for index, label in enumerate(("目的を設定", "音声で話す", "AIカードを確認", "レポートを保存")):
        x = 670 + index * 290
        check(draw, (x, 760), GREEN)
        text(draw, (x, 810), label, 14, fill=INK, bold=True, anchor="mm")


SCENES: Sequence[dict[str, object]] = (
    {"caption": "会話の目的を設定", "active": "セッション", "renderer": draw_setup},
    {"caption": "音声接続を開始", "active": "セッション", "renderer": lambda draw: draw_live(draw, 1, 0)},
    {"caption": "文字起こしが流れる", "active": "文字起こし", "renderer": lambda draw: draw_live(draw, 2, 1)},
    {"caption": "右側に質問カードが増える", "active": "AI補助", "renderer": lambda draw: draw_live(draw, 3, 2)},
    {"caption": "レポートを保存", "active": "レポート", "renderer": draw_report},
    {"caption": "次の会話へ", "active": "レポート", "renderer": draw_final},
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

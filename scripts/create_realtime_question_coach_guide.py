#!/usr/bin/env python3
"""Create the desktop onboarding stills for Realtime Question Coach."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Callable, Sequence

from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT = 1280, 900
BG = (246, 248, 245)
INK = (28, 51, 48)
MUTED = (103, 117, 111)
GREEN = (13, 119, 108)
GREEN_DARK = (11, 76, 69)
GREEN_PALE = (223, 239, 230)
BLUE = (44, 100, 151)
BLUE_PALE = (232, 239, 248)
AMBER = (198, 140, 42)
AMBER_PALE = (250, 241, 214)
LINE = (211, 220, 214)
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
    current = ""
    for char in value:
        if char == "\n":
            lines.append(current)
            current = ""
        elif len(current) >= limit:
            lines.append(current)
            current = char
        else:
            current += char
    if current:
        lines.append(current)
    return lines


def paragraph(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int,
              fill: tuple[int, int, int] = MUTED, limit: int = 18, gap: int = 10) -> None:
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
    w, h = right - left, bottom - top
    box = (x, y, x + w + pad_x * 2, y + h + pad_y * 2)
    rounded(draw, box, (h + pad_y * 2) // 2, fill)
    text(draw, (x + pad_x, y + pad_y - 1), label, size, fill=fg, bold=True)
    return box


def draw_check(draw: ImageDraw.ImageDraw, center: tuple[int, int], color: tuple[int, int, int] = GREEN) -> None:
    x, y = center
    draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill=color)
    draw.line((x - 5, y, x - 1, y + 4, x + 7, y - 5), fill=WHITE, width=3, joint="curve")


def draw_desktop_shell(draw: ImageDraw.ImageDraw) -> tuple[int, int, int, int]:
    """Draw a wide desktop browser window instead of a phone mock."""
    outer = (355, 108, 925, 694)
    rounded(draw, outer, 20, fill=(21, 58, 53))
    window = (368, 121, 912, 681)
    rounded(draw, window, 14, fill=WHITE)
    draw.rectangle((368, 121, 912, 165), fill=(240, 245, 241))
    for x, color in ((390, (227, 127, 111)), (410, (234, 187, 88)), (430, (103, 174, 135))):
        draw.ellipse((x, 137, x + 10, 147), fill=color)
    text(draw, (466, 133), "Realtime Question Coach", 14, fill=INK, bold=True)
    text(draw, (888, 134), "●", 14, fill=GREEN, anchor="mm")
    screen = (383, 177, 897, 667)
    rounded(draw, screen, 8, fill=(249, 251, 249))
    # Monitor stand and base make the desktop context unambiguous.
    draw.rectangle((626, 694, 654, 759), fill=(21, 58, 53))
    rounded(draw, (556, 758, 724, 774), 8, fill=(21, 58, 53))
    return screen


def draw_app_header(draw: ImageDraw.ImageDraw, title: str, status: str | None = None) -> None:
    text(draw, (407, 197), "RQC", 15, fill=GREEN, bold=True)
    text(draw, (450, 197), title, 14, fill=INK, bold=True)
    draw.ellipse((851, 188, 873, 210), fill=GREEN_PALE, outline=GREEN, width=1)
    text(draw, (862, 199), "H", 11, fill=GREEN, bold=True, anchor="mm")
    if status:
        pill(draw, (407, 220), status, GREEN_PALE, fg=GREEN, size=10, pad_x=9, pad_y=4)


def draw_setup(draw: ImageDraw.ImageDraw) -> None:
    draw_app_header(draw, "セッション設定")
    text(draw, (407, 270), "会話の目的を選ぶ", 20, fill=INK, bold=True)
    text(draw, (407, 300), "目的が決まると、質問の方向も揃います。", 11, fill=MUTED)
    for i, label in enumerate(("要件定義", "商談", "1on1")):
        box = (407 + i * 101, 335, 494 + i * 101, 371)
        rounded(draw, box, 9, fill=GREEN_PALE if i == 0 else WHITE, outline=GREEN if i == 0 else LINE, width=2)
        text(draw, ((box[0] + box[2]) // 2, 353), label, 11, fill=GREEN if i == 0 else MUTED, bold=i == 0, anchor="mm")
    text(draw, (407, 405), "今回のゴール", 11, fill=MUTED, bold=True)
    rounded(draw, (407, 427, 744, 470), 8, fill=WHITE, outline=LINE, width=2)
    text(draw, (421, 449), "MVPで確認すべき要件を整理する", 11, fill=INK)
    text(draw, (407, 504), "参加者（任意）", 11, fill=MUTED, bold=True)
    rounded(draw, (407, 526, 744, 569), 8, fill=WHITE, outline=LINE, width=2)
    text(draw, (421, 548), "プロダクト担当 / 顧客担当", 11, fill=INK)
    rounded(draw, (407, 606, 744, 652), 9, fill=GREEN)
    text(draw, (575, 629), "セッションを開始", 13, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (766, 270, 872, 652), 10, fill=(240, 246, 242), outline=LINE, width=1)
    text(draw, (784, 291), "設定内容", 11, fill=MUTED, bold=True)
    for y, label, value in ((335, "タイプ", "要件定義"), (401, "目的", "MVPの整理"), (467, "音声", "ブラウザマイク")):
        text(draw, (784, y), label, 10, fill=MUTED)
        text(draw, (784, y + 22), value, 11, fill=INK, bold=True)


def transcript_line(draw: ImageDraw.ImageDraw, y: int, speaker: str, value: str, color: tuple[int, int, int]) -> None:
    draw.ellipse((407, y + 2, 423, y + 18), fill=color)
    text(draw, (431, y - 1), speaker, 9, fill=color, bold=True)
    text(draw, (431, y + 17), value, 10, fill=INK)


def draw_live_stage(draw: ImageDraw.ImageDraw, transcript_count: int, card_count: int) -> None:
    """Render the live two-pane state; successive stills create visible motion."""
    draw_app_header(draw, "要件定義", status="音声接続中")
    rounded(draw, (407, 270, 640, 648), 9, fill=WHITE, outline=LINE, width=1)
    rounded(draw, (651, 270, 872, 648), 9, fill=WHITE, outline=LINE, width=1)
    text(draw, (423, 292), "リアルタイム文字起こし", 13, fill=INK, bold=True)
    transcript = (
        ("あなた", "MVPの範囲をまず決めたいです。", BLUE),
        ("相手", "権限まわりは管理者だけで良さそうです。", GREEN),
        ("あなた", "例外のときはどうしますか？", BLUE),
    )
    for index, (speaker, value, color) in enumerate(transcript[:transcript_count]):
        transcript_line(draw, 331 + index * 68, speaker, value, color)
    divider_y = 331 + max(transcript_count, 1) * 68 + 6
    draw.line((423, divider_y, 624, divider_y), fill=LINE, width=1)
    text(draw, (423, divider_y + 19), "話した内容を自動で整理", 10, fill=MUTED)
    text(draw, (667, 292), "AI補助カード", 13, fill=INK, bold=True)
    if card_count == 0:
        rounded(draw, (667, 333, 856, 484), 9, fill=(247, 250, 248), outline=LINE, width=1)
        text(draw, (761, 397), "会話を分析中…", 11, fill=MUTED, anchor="mm")
        draw.ellipse((752, 423, 770, 441), outline=GREEN, width=2)
    else:
        card_data = (
            ("権限の確認", "管理者以外は、どこまで操作できますか？", BLUE),
            ("例外条件", "想定外のケースはありますか？", AMBER),
        )
        for index, (title, question, tone) in enumerate(card_data[:card_count]):
            y = 333 + index * 155
            rounded(draw, (667, y, 856, y + 136), 9, fill=(250, 252, 251), outline=(181, 203, 224), width=2)
            draw.rectangle((667, y, 673, y + 136), fill=tone)
            text(draw, (681, y + 20), title, 11, fill=INK, bold=True)
            paragraph(draw, (681, y + 49), question, 10, fill=INK, limit=18, gap=4)
            rounded(draw, (681, y + 100, 738, y + 125), 6, fill=GREEN)
            text(draw, (710, y + 112), "聞いた", 9, fill=WHITE, bold=True, anchor="mm")
            rounded(draw, (746, y + 100, 805, y + 125), 6, fill=WHITE, outline=LINE, width=1)
            text(draw, (775, y + 112), "あとで", 9, fill=MUTED, anchor="mm")
    status_y = 632 if card_count == 2 else 612
    text(draw, (667, status_y), "音声接続中", 10, fill=GREEN, bold=True)
    draw.ellipse((835, status_y - 2, 847, status_y + 10), fill=GREEN)


def draw_live_initial(draw: ImageDraw.ImageDraw) -> None:
    draw_live_stage(draw, transcript_count=1, card_count=0)


def draw_live_one_card(draw: ImageDraw.ImageDraw) -> None:
    draw_live_stage(draw, transcript_count=2, card_count=1)


def draw_live_two_cards(draw: ImageDraw.ImageDraw) -> None:
    draw_live_stage(draw, transcript_count=3, card_count=2)


def draw_cards(draw: ImageDraw.ImageDraw) -> None:
    draw_app_header(draw, "AI補助カード")
    text(draw, (407, 270), "次に聞く質問", 20, fill=INK, bold=True)
    text(draw, (407, 301), "未確認の論点をもとに提案します。", 11, fill=MUTED)
    for y, title, question, tone in (
        (345, "期限の確認", "いつまでに、何を決めますか？", AMBER),
        (493, "例外条件", "想定外のケースはありますか？", BLUE),
    ):
        rounded(draw, (407, y, 744, y + 112), 9, fill=WHITE, outline=LINE, width=2)
        draw.rectangle((407, y, 413, y + 112), fill=tone)
        text(draw, (428, y + 17), title, 12, fill=INK, bold=True)
        paragraph(draw, (428, y + 47), question, 10, fill=INK, limit=20, gap=4)
        pill(draw, (428, y + 81), "未確認", AMBER_PALE if tone == AMBER else BLUE_PALE,
             fg=AMBER if tone == AMBER else BLUE, size=9, pad_x=8, pad_y=4)
    rounded(draw, (766, 270, 872, 605), 10, fill=(240, 246, 242), outline=LINE, width=1)
    text(draw, (784, 292), "カードの使い方", 11, fill=MUTED, bold=True)
    for i, (label, value) in enumerate((("1", "質問を選ぶ"), ("2", "会話で確認"), ("3", "状態を更新"))):
        y = 345 + i * 86
        draw.ellipse((784, y, 808, y + 24), fill=GREEN_PALE, outline=GREEN, width=1)
        text(draw, (796, y + 12), label, 10, fill=GREEN, bold=True, anchor="mm")
        text(draw, (820, y + 1), value, 10, fill=INK, bold=True)
        text(draw, (820, y + 22), "抜け漏れを減らします", 9, fill=MUTED)


def draw_report(draw: ImageDraw.ImageDraw) -> None:
    draw_app_header(draw, "セッションレポート")
    text(draw, (407, 270), "会話の振り返り", 20, fill=INK, bold=True)
    pill(draw, (407, 304), "完了", GREEN_PALE, fg=GREEN, size=10, pad_x=9, pad_y=4)
    text(draw, (480, 314), "要件定義 / 18分", 11, fill=MUTED)
    rounded(draw, (407, 359, 592, 606), 9, fill=WHITE, outline=LINE, width=1)
    rounded(draw, (608, 359, 744, 606), 9, fill=WHITE, outline=LINE, width=1)
    text(draw, (423, 381), "確認できたこと", 11, fill=MUTED, bold=True)
    for i, label in enumerate(("MVPの対象範囲", "管理者の操作", "次回の宿題")):
        y = 423 + i * 42
        draw_check(draw, (436, y + 3), GREEN)
        text(draw, (457, y - 5), label, 10, fill=INK)
    text(draw, (624, 381), "未確認のこと", 11, fill=MUTED, bold=True)
    rounded(draw, (624, 423, 728, 496), 8, fill=AMBER_PALE, outline=(234, 208, 147), width=1)
    text(draw, (638, 439), "例外時の承認", 10, fill=INK, bold=True)
    text(draw, (638, 462), "次回の確認へ", 9, fill=MUTED)
    rounded(draw, (407, 636, 592, 681), 9, fill=GREEN)
    text(draw, (500, 658), "レポートを保存", 12, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (608, 636, 744, 681), 9, fill=WHITE, outline=LINE, width=2)
    text(draw, (676, 658), "文字起こしを保存", 11, fill=INK, anchor="mm")
    rounded(draw, (766, 270, 872, 681), 10, fill=(240, 246, 242), outline=LINE, width=1)
    text(draw, (784, 292), "保存先", 11, fill=MUTED, bold=True)
    text(draw, (784, 349), "この端末", 11, fill=INK, bold=True)
    text(draw, (784, 374), "ブラウザから保存できます", 9, fill=MUTED)
    text(draw, (784, 455), "サーバーには", 10, fill=MUTED)
    text(draw, (784, 478), "会話本文を保存しません", 10, fill=INK, bold=True)


def draw_finish(draw: ImageDraw.ImageDraw) -> None:
    draw_app_header(draw, "Realtime Question Coach")
    text(draw, (640, 310), "これだけで、会話の抜け漏れを減らせます", 20, fill=INK, bold=True, anchor="mm")
    text(draw, (640, 350), "PCブラウザでセッションを開始しましょう。", 12, fill=MUTED, anchor="mm")
    rounded(draw, (502, 415, 778, 469), 10, fill=GREEN)
    text(draw, (640, 442), "新しいセッションを始める", 13, fill=WHITE, bold=True, anchor="mm")
    for i, label in enumerate(("目的を設定", "音声で話す", "AIカードを確認", "レポートを保存")):
        x = 445 + i * 102
        draw_check(draw, (x, 544), GREEN)
        text(draw, (x, 577), label, 10, fill=INK, bold=True, anchor="ma")


SceneDrawer = Callable[[ImageDraw.ImageDraw], None]
SCENES: Sequence[dict[str, object]] = (
    {"caption": "会話の目的を設定", "draw": draw_setup},
    {"caption": "音声接続を開始", "draw": draw_live_initial},
    {"caption": "文字起こしが流れる", "draw": draw_live_one_card},
    {"caption": "右側に質問カードが表示", "draw": draw_live_two_cards},
    {"caption": "レポートを保存", "draw": draw_report},
    {"caption": "次の会話へ", "draw": draw_finish},
)


def draw_scene(scene: dict[str, object]) -> Image.Image:
    stage = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(stage)
    draw_desktop_shell(draw)
    drawer = scene["draw"]
    assert callable(drawer)
    drawer(draw)
    # Remove the monitor bezel entirely and show the product surface edge-to-edge.
    return stage.crop((383, 177, 897, 667)).resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for index, scene in enumerate(SCENES):
        draw_scene(scene).save(args.output / f"scene-{index:02d}.png", optimize=True)
    print(f"wrote {len(SCENES)} scenes to {args.output}")


if __name__ == "__main__":
    main()

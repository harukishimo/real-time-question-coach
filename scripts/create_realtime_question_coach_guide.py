#!/usr/bin/env python3
"""Create the stills used by the Realtime Question Coach onboarding video.

The visual language follows the supplied Charge Queue mock: a quiet background,
large explanation on the left, a phone-sized product view in the middle, and a
numbered journey on the right.  The stills are intentionally self contained so
the video can be regenerated without the running web app.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Sequence

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
RED = (177, 76, 67)
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
              fill: tuple[int, int, int] = MUTED, limit: int = 18, gap: int = 12) -> None:
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
         size: int = 15, pad_x: int = 14, pad_y: int = 7) -> tuple[int, int, int, int]:
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
    draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=color)
    draw.line((x - 6, y, x - 1, y + 5, x + 8, y - 6), fill=WHITE, width=3, joint="curve")


def draw_phone_shell(draw: ImageDraw.ImageDraw) -> tuple[int, int, int, int]:
    outer = (423, 47, 857, 853)
    rounded(draw, outer, 44, fill=(21, 58, 53))
    draw.rounded_rectangle((434, 59, 846, 842), radius=36, fill=(241, 245, 242))
    screen = (446, 73, 834, 828)
    rounded(draw, screen, 29, fill=WHITE)
    rounded(draw, (598, 83, 682, 96), 8, fill=(21, 58, 53))
    return screen


def draw_phone_header(draw: ImageDraw.ImageDraw, title: str, status: str | None = None) -> None:
    text(draw, (472, 123), "RQC", 18, fill=GREEN, bold=True)
    text(draw, (515, 123), title, 16, fill=INK, bold=True)
    draw.ellipse((788, 114, 812, 138), fill=GREEN_PALE, outline=GREEN, width=1)
    text(draw, (800, 126), "H", 12, fill=GREEN, bold=True, anchor="mm")
    if status:
        pill(draw, (474, 151), status, GREEN_PALE, fg=GREEN, size=12, pad_x=10, pad_y=5)


def draw_steps(draw: ImageDraw.ImageDraw, active: int | None) -> None:
    steps = [
        "ログインする",
        "APIキーを設定",
        "会話を準備",
        "音声で話す",
        "AIカードを確認",
        "レポートを保存",
    ]
    x = 965
    text(draw, (x, 168), "HOW IT WORKS", 13, fill=MUTED, bold=True)
    for index, label in enumerate(steps, 1):
        y = 232 + (index - 1) * 94
        if index < len(steps):
            draw.line((x + 17, y + 30, x + 17, y + 92), fill=LINE, width=2)
        is_active = active == index
        if active is None or index < (active or 99):
            fill, outline, fg = GREEN, GREEN, WHITE
        elif is_active:
            fill, outline, fg = INK, INK, WHITE
        else:
            fill, outline, fg = WHITE, LINE, MUTED
        draw.ellipse((x, y, x + 34, y + 34), fill=fill, outline=outline, width=2)
        text(draw, (x + 17, y + 17), f"{index:02}", 10, fill=fg, bold=True, anchor="mm")
        text(draw, (x + 51, y + 8), label, 17, fill=INK if is_active else MUTED, bold=is_active)


def draw_login(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "ようこそ")
    text(draw, (640, 250), "Realtime", 26, fill=INK, bold=True, anchor="mm")
    text(draw, (640, 285), "Question Coach", 26, fill=GREEN, bold=True, anchor="mm")
    text(draw, (640, 340), "会話中の聞き漏れを減らし、\n次に聞く質問を提案します。", 14, fill=MUTED, anchor="ma")
    rounded(draw, (493, 429, 787, 483), 13, fill=GREEN)
    text(draw, (640, 456), "Googleでログイン", 16, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (493, 504, 787, 558), 13, fill=WHITE, outline=LINE, width=2)
    text(draw, (640, 531), "メールアドレスで続ける", 15, fill=INK, anchor="mm")
    text(draw, (640, 610), "初回ログイン後に、あなたの設定を保存します。", 12, fill=MUTED, anchor="mm")


def draw_credentials(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "初回設定")
    text(draw, (475, 215), "AIを使う準備", 22, fill=INK, bold=True)
    text(draw, (475, 252), "APIキーは暗号化して保存されます。", 12, fill=MUTED)
    text(draw, (475, 324), "OpenAI API key", 12, fill=MUTED, bold=True)
    rounded(draw, (474, 349, 806, 406), 10, fill=(248, 250, 248), outline=LINE, width=2)
    text(draw, (493, 377), "sk-••••••••••••••••", 16, fill=INK)
    draw.ellipse((776, 368, 798, 390), fill=GREEN_PALE)
    draw.line((783, 379, 789, 385, 797, 373), fill=GREEN, width=2)
    text(draw, (475, 435), "あとからユーザー設定で変更できます。", 12, fill=MUTED)
    rounded(draw, (474, 507, 806, 560), 11, fill=GREEN)
    text(draw, (640, 534), "保存して続ける", 15, fill=WHITE, bold=True, anchor="mm")
    pill(draw, (474, 605), "SECURE", GREEN_PALE, fg=GREEN, size=11, pad_x=10, pad_y=5)
    text(draw, (578, 614), "キーの値は画面に再表示されません", 11, fill=MUTED)


def draw_setup(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "セッション設定")
    text(draw, (475, 203), "どんな会話ですか？", 21, fill=INK, bold=True)
    text(draw, (475, 238), "目的を選ぶと、質問の方向が揃います。", 12, fill=MUTED)
    for i, label in enumerate(("要件定義", "商談", "1on1")):
        box = (474 + i * 106, 286, 568 + i * 106, 326)
        rounded(draw, box, 10, fill=GREEN_PALE if i == 0 else WHITE, outline=GREEN if i == 0 else LINE, width=2)
        text(draw, ((box[0] + box[2]) // 2, 306), label, 12, fill=GREEN if i == 0 else MUTED, bold=i == 0, anchor="mm")
    text(draw, (475, 376), "今回のゴール", 12, fill=MUTED, bold=True)
    rounded(draw, (474, 400, 806, 453), 9, fill=(248, 250, 248), outline=LINE, width=2)
    text(draw, (493, 427), "MVPで確認すべき要件を整理する", 13, fill=INK)
    text(draw, (475, 493), "参加者（任意）", 12, fill=MUTED, bold=True)
    rounded(draw, (474, 517, 806, 570), 9, fill=(248, 250, 248), outline=LINE, width=2)
    text(draw, (493, 544), "プロダクト担当 / 顧客担当", 13, fill=INK)
    rounded(draw, (474, 629, 806, 682), 11, fill=GREEN)
    text(draw, (640, 656), "セッションを開始", 15, fill=WHITE, bold=True, anchor="mm")


def transcript_line(draw: ImageDraw.ImageDraw, y: int, speaker: str, value: str, color: tuple[int, int, int]) -> None:
    draw.ellipse((476, y + 3, 494, y + 21), fill=color)
    text(draw, (503, y), speaker, 10, fill=color, bold=True)
    text(draw, (503, y + 20), value, 11, fill=INK)


def draw_live(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "要件定義", status="音声接続中")
    text(draw, (475, 213), "リアルタイム文字起こし", 16, fill=INK, bold=True)
    transcript_line(draw, 259, "あなた", "MVPの範囲をまず決めたいです。", BLUE)
    transcript_line(draw, 333, "相手", "権限まわりは、管理者だけで良さそうです。", GREEN)
    draw.line((474, 412, 806, 412), fill=LINE, width=1)
    pill(draw, (474, 437), "AI補助カード", BLUE_PALE, fg=BLUE, size=12, pad_x=10, pad_y=5)
    rounded(draw, (474, 492, 806, 634), 10, fill=(250, 252, 251), outline=(181, 203, 224), width=2)
    text(draw, (493, 517), "権限の確認", 14, fill=INK, bold=True)
    paragraph(draw, (493, 550), "管理者以外は、どこまで操作できますか？", 12, fill=INK, limit=24, gap=5)
    rounded(draw, (493, 596, 570, 623), 7, fill=GREEN)
    text(draw, (531, 609), "聞いた", 10, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (580, 596, 646, 623), 7, fill=WHITE, outline=LINE, width=1)
    text(draw, (613, 609), "あとで", 10, fill=MUTED, anchor="mm")
    text(draw, (474, 698), "会話中に定期更新", 11, fill=MUTED)
    draw.ellipse((780, 698, 792, 710), fill=GREEN)


def draw_cards(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "AI補助カード")
    text(draw, (475, 203), "次に聞く質問", 21, fill=INK, bold=True)
    text(draw, (475, 238), "未確認の論点をもとに提案します。", 12, fill=MUTED)
    for y, title, question, tone in (
        (292, "期限の確認", "いつまでに、何を決めますか？", AMBER),
        (462, "例外条件", "想定外のケースはありますか？", BLUE),
    ):
        rounded(draw, (474, y, 806, y + 136), 10, fill=WHITE, outline=LINE, width=2)
        draw.rectangle((474, y, 481, y + 136), fill=tone)
        text(draw, (495, y + 20), title, 14, fill=INK, bold=True)
        paragraph(draw, (495, y + 55), question, 12, fill=INK, limit=21, gap=4)
        pill(draw, (495, y + 101), "未確認", AMBER_PALE if tone == AMBER else BLUE_PALE,
             fg=AMBER if tone == AMBER else BLUE, size=10, pad_x=9, pad_y=4)
    text(draw, (475, 750), "カードは聞いた／あとで／不要で整理できます。", 11, fill=MUTED)


def draw_report(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "セッションレポート")
    text(draw, (475, 203), "会話の振り返り", 21, fill=INK, bold=True)
    pill(draw, (475, 241), "完了", GREEN_PALE, fg=GREEN, size=11, pad_x=10, pad_y=5)
    text(draw, (552, 251), "要件定義 / 18分", 12, fill=MUTED)
    text(draw, (475, 317), "確認できたこと", 12, fill=MUTED, bold=True)
    for i, label in enumerate(("MVPの対象範囲", "管理者の操作", "次回の宿題")):
        y = 349 + i * 42
        draw_check(draw, (488, y + 5), GREEN)
        text(draw, (515, y), label, 12, fill=INK)
    text(draw, (475, 493), "未確認のこと", 12, fill=MUTED, bold=True)
    rounded(draw, (474, 525, 806, 580), 9, fill=AMBER_PALE, outline=(234, 208, 147), width=1)
    text(draw, (493, 543), "例外時の承認フロー", 12, fill=INK, bold=True)
    text(draw, (493, 563), "次回、最初に確認しましょう", 11, fill=MUTED)
    rounded(draw, (474, 638, 806, 691), 11, fill=GREEN)
    text(draw, (640, 665), "レポートを保存", 15, fill=WHITE, bold=True, anchor="mm")
    rounded(draw, (474, 706, 806, 759), 11, fill=WHITE, outline=LINE, width=2)
    text(draw, (640, 733), "文字起こしを保存", 14, fill=INK, anchor="mm")


def draw_finish(draw: ImageDraw.ImageDraw) -> None:
    draw_phone_header(draw, "次のセッション")
    text(draw, (640, 235), "準備完了", 26, fill=INK, bold=True, anchor="mm")
    text(draw, (640, 281), "次の会話も、質問コーチと一緒に。", 13, fill=MUTED, anchor="mm")
    for i, label in enumerate(("ログイン", "会話の設定", "音声接続", "AIカード", "レポート")):
        y = 345 + i * 52
        draw_check(draw, (500, y + 3), GREEN)
        text(draw, (528, y - 6), label, 14, fill=INK, bold=True)
        text(draw, (528, y + 17), "いつでも確認できます", 10, fill=MUTED)
    rounded(draw, (493, 662, 787, 716), 12, fill=GREEN)
    text(draw, (640, 689), "新しいセッション", 15, fill=WHITE, bold=True, anchor="mm")


SCENES: Sequence[dict[str, object]] = (
    {"eyebrow": "WELCOME GUIDE", "title": "会話前に3分で準備", "body": "はじめての方も、画面の案内に沿って進めるだけ。", "active": 1, "draw": draw_login},
    {"eyebrow": "01 / ACCOUNT", "title": "まずはログイン", "body": "アカウントを作成して、あなた専用の設定を始めます。", "active": 1, "draw": draw_credentials},
    {"eyebrow": "02 / SETUP", "title": "会話の目的を選ぶ", "body": "目的が決まると、AIが出す質問の方向も揃います。", "active": 3, "draw": draw_setup},
    {"eyebrow": "03 / LIVE", "title": "音声をつなぐ", "body": "話した内容はリアルタイムに文字起こしされます。", "active": 4, "draw": draw_live},
    {"eyebrow": "04 / COACH", "title": "次に聞く質問が届く", "body": "未確認の論点をもとに、深掘り質問を提案します。", "active": 5, "draw": draw_cards},
    {"eyebrow": "05 / FINISH", "title": "終わったら、すぐ振り返る", "body": "レポートで抜け漏れを確認し、必要なら端末に保存できます。", "active": 6, "draw": draw_report},
    {"eyebrow": "READY TO START", "title": "最初のセッションを始めよう", "body": "ログイン → 設定 → 音声接続。あとはAIに任せられます。", "active": None, "draw": draw_finish},
)


def draw_scene(scene: dict[str, object]) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    # A subtle baseline keeps the composition close to the supplied mock.
    draw.line((66, 808, 1214, 808), fill=LINE, width=1)
    text(draw, (90, 85), str(scene["eyebrow"]), 14, fill=MUTED, bold=True)
    text(draw, (90, 299), str(scene["title"]), 38, fill=INK, bold=True)
    paragraph(draw, (90, 365), str(scene["body"]), 18, fill=MUTED, limit=17, gap=10)
    text(draw, (90, 731), "Realtime Question Coach", 13, fill=GREEN, bold=True)
    text(draw, (90, 754), "会話の中で、次に聞くべきことを見つける。", 12, fill=MUTED)
    draw_phone_shell(draw)
    scene["draw"](draw)  # type: ignore[index]
    draw_steps(draw, scene["active"] if isinstance(scene["active"], int) else None)
    pill(draw, (1077, 770), "PRODUCT GUIDE", GREEN_PALE, fg=GREEN, size=10, pad_x=10, pad_y=5)
    return image


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

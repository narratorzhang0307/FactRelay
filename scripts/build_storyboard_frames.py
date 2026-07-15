#!/usr/bin/env python3
"""Build clean 16:9 storyboard frames aligned one-to-one with the subtitle master."""

from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from build_demo_video import (
    BLACK,
    CYAN,
    FONT_BOLD,
    FONT_CN,
    FONT_REGULAR,
    HEIGHT,
    LIME,
    PAPER,
    PINK,
    VIOLET,
    WIDTH,
    YELLOW,
    architecture_frame,
    close_frame,
    font,
)
from build_subtitle_master import SUBTITLES


ROOT = Path(__file__).resolve().parents[1]
DELIVERY = ROOT / "FactRelay_黑客松交付包"
SHOTS = DELIVERY / "03_截图"
OUT = DELIVERY / "05_逐句配图"
PRIMARY = OUT / "01_逐句画面_19张"
BONUS = OUT / "02_备用转场_4张"
GONKA = OUT / "03_Gonka核心架构_4张"


PLAN = [
    ("01_黑盒问题", "01_首页_来源卡片.png", "full", None, "首页与证据卡组建立问题"),
    ("02_可追溯证据链", "02_首页_质疑卡片.png", "full", None, "卡片堆叠与左右翻页"),
    ("03_三种输入", "04_实时核查进行中.png", "focus", (0.00, 0.00, 0.34, 0.62), "文本、链接、图片输入区"),
    ("04_实时检索", "04_实时核查进行中.png", "full", None, "真实核查进行状态"),
    ("05_长城主张", "04_实时核查进行中.png", "focus", (0.00, 0.16, 0.43, 0.79), "待核查原始主张"),
    ("06_双模型调用", None, "gonka_sequence", None, "Gonka 双模型调用与确定性评分序列"),
    ("07_结论与评分", "05_真实结果_01_结论.png", "focus", (0.21, 0.03, 0.99, 0.91), "结论、Truth Score 与信心"),
    ("08_确定性评分", "05_真实结果_01_结论.png", "focus", (0.22, 0.47, 0.99, 0.99), "评分信号与确定性公式"),
    ("09_来源账本", "06_真实结果_02_来源.png", "focus", (0.20, 0.04, 0.99, 0.94), "来源、日期、立场与可信度"),
    ("10_来源编号约束", "06_真实结果_02_来源.png", "focus", (0.31, 0.33, 0.99, 0.99), "模型可引用的编号证据清单"),
    ("11_Kimi调查方", "07_真实结果_03_双模型审查.png", "focus", (0.32, 0.26, 0.67, 0.99), "Kimi 调查方证据判断"),
    ("12_MiniMax质疑方", "07_真实结果_03_双模型审查.png", "focus", (0.60, 0.26, 0.94, 0.99), "MiniMax 对抗式质疑"),
    ("13_真实请求回执", "08_真实结果_04_Gonka回执.png", "focus", (0.20, 0.10, 0.99, 0.90), "Gonka Request ID 与执行顺序"),
    ("14_回执不是事实证明", "08_真实结果_04_Gonka回执.png", "focus", (0.38, 0.30, 0.99, 0.98), "回执边界与可重放轨迹"),
    ("15_Gonka推理边界", None, "architecture", None, "Gonka-only 推理架构"),
    ("16_安全可信边界", None, "safety", None, "评分、SSRF 与预览回执约束"),
    ("17_四张可检查卡片", None, "mosaic", None, "结论、来源、审查、回执四卡总览"),
    ("18_可复核证据链", None, "chain", None, "从主张到回执的完整链路"),
    ("19_品牌收尾", None, "close", None, "项目名、在线 Demo 与 GitHub"),
]


def full(source: Path) -> Image.Image:
    return Image.open(source).convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def focus(source: Path, box: tuple[float, float, float, float], accent: str) -> Image.Image:
    image = Image.open(source).convert("RGB")
    blurred = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(20))
    shade = Image.new("RGBA", (WIDTH, HEIGHT), (7, 8, 6, 125))
    background = Image.alpha_composite(blurred.convert("RGBA"), shade).convert("RGB")
    width, height = image.size
    crop = image.crop((int(width * box[0]), int(height * box[1]), int(width * box[2]), int(height * box[3])))
    crop.thumbnail((1720, 940), Image.Resampling.LANCZOS)
    x = (WIDTH - crop.width) // 2
    y = (HEIGHT - crop.height) // 2
    draw = ImageDraw.Draw(background)
    draw.rounded_rectangle((x - 16, y - 16, x + crop.width + 16, y + crop.height + 16), radius=28, fill=accent)
    draw.rounded_rectangle((x - 6, y - 6, x + crop.width + 6, y + crop.height + 6), radius=22, fill="#171815")
    background.paste(crop, (x, y))
    return background


def safety_frame() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((88, 70), "FACTRELAY · EXPLICIT TRUST BOUNDARY", font=font(FONT_BOLD, 26), fill=VIOLET)
    draw.text((88, 122), "What the system proves—and what it never claims.", font=font(FONT_BOLD, 58), fill=BLACK)
    draw.text((90, 203), "系统证明什么，也明确说明它不证明什么。", font=font(FONT_CN, 36), fill="#50524d")

    cards = [
        (LIME, "TESTED SCORE", "可测试评分", "Truth Score 由代码计算\n不让模型随口给分"),
        (CYAN, "SSRF GUARD", "链接安全防护", "拒绝本机、内网与\n危险重定向地址"),
        (YELLOW, "NULL PREVIEW", "预览回执为空", "预览模式不伪造\nGonka Request ID"),
        (PINK, "RECEIPT ≠ TRUTH", "回执不等于真相", "回执证明调用来源\n事实仍由证据支持"),
    ]
    for index, (fill, title, chinese, body) in enumerate(cards):
        x1 = 88 + index * 448
        x2 = x1 + 396
        draw.rounded_rectangle((x1 + 12, 340 + 12, x2 + 12, 760 + 12), radius=34, fill=VIOLET)
        draw.rounded_rectangle((x1, 340, x2, 760), radius=34, fill=fill, outline=BLACK, width=4)
        draw.text((x1 + 30, 382), f"0{index + 1}", font=font(FONT_BOLD, 22), fill=BLACK)
        draw.text((x1 + 30, 442), title, font=font(FONT_BOLD, 28), fill=BLACK)
        draw.text((x1 + 30, 500), chinese, font=font(FONT_CN, 25), fill="#41433e")
        draw.multiline_text((x1 + 30, 585), body, font=font(FONT_CN, 23), fill=BLACK, spacing=14)
    footer_en = "SAFE FAILURE     /     NO FABRICATED RECEIPTS"
    draw.text((90, 930), footer_en, font=font(FONT_BOLD, 25), fill=VIOLET)
    footer_width = draw.textbbox((0, 0), footer_en, font=font(FONT_BOLD, 25))[2]
    draw.text((110 + footer_width, 927), "可解释失败 / 不伪造回执", font=font(FONT_CN, 23), fill=VIOLET)
    return image


def mosaic_frame() -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(canvas)
    title_en = "FOUR INSPECTABLE BLOCKS"
    draw.text((70, 45), title_en, font=font(FONT_BOLD, 28), fill=LIME)
    title_width = draw.textbbox((0, 0), title_en, font=font(FONT_BOLD, 28))[2]
    draw.text((90 + title_width, 43), "· 四张可检查证据卡", font=font(FONT_CN, 25), fill=LIME)
    sources = [
        ("05_真实结果_01_结论.png", "01  VERDICT", "结论", PINK),
        ("06_真实结果_02_来源.png", "02  SOURCES", "来源", YELLOW),
        ("07_真实结果_03_双模型审查.png", "03  REVIEW", "审查", VIOLET),
        ("08_真实结果_04_Gonka回执.png", "04  PROOF", "回执", CYAN),
    ]
    positions = [(70, 115), (980, 115), (70, 585), (980, 585)]
    for (filename, label, chinese, accent), (x, y) in zip(sources, positions):
        shot = Image.open(SHOTS / filename).convert("RGB").resize((850, 478), Image.Resampling.LANCZOS)
        shot = shot.crop((0, 0, 850, 390))
        draw.rounded_rectangle((x + 10, y + 10, x + 870, y + 430), radius=24, fill=accent)
        canvas.paste(shot, (x, y))
        draw.rectangle((x, y + 390, x + 850, y + 430), fill=accent)
        draw.text((x + 22, y + 397), label, font=font(FONT_BOLD, 21), fill=BLACK)
        label_width = draw.textbbox((0, 0), label, font=font(FONT_BOLD, 21))[2]
        draw.text((x + 34 + label_width, y + 395), "· " + chinese, font=font(FONT_CN, 19), fill=BLACK)
    return canvas


def chain_frame() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(image)
    draw.text((76, 60), "ONE CLAIM IN. A REVIEWABLE CHAIN OUT.", font=font(FONT_BOLD, 58), fill=PAPER)
    draw.text((78, 145), "输入一条主张，输出一条能够复核的证据链。", font=font(FONT_CN, 38), fill=LIME)
    steps = [
        ("01", "CLAIM", "主张", LIME),
        ("02", "EVIDENCE", "证据", YELLOW),
        ("03", "KIMI", "调查", CYAN),
        ("04", "MINIMAX", "质疑", VIOLET),
        ("05", "VERDICT", "结论", PINK),
        ("06", "RECEIPTS", "回执", LIME),
    ]
    for index, (number, title, chinese, accent) in enumerate(steps):
        x1 = 70 + index * 304
        x2 = x1 + 244
        draw.rounded_rectangle((x1 + 12, 355 + 12, x2 + 12, 710 + 12), radius=30, fill=accent)
        draw.rounded_rectangle((x1, 355, x2, 710), radius=30, fill=PAPER, outline=BLACK, width=4)
        draw.rounded_rectangle((x1 + 24, 380, x1 + 84, 424), radius=20, fill=accent)
        draw.text((x1 + 40, 388), number, font=font(FONT_BOLD, 18), fill=BLACK)
        draw.text((x1 + 24, 490), title, font=font(FONT_BOLD, 24), fill=BLACK)
        draw.text((x1 + 24, 552), chinese, font=font(FONT_CN, 31), fill="#464842")
        if index < len(steps) - 1:
            draw.line((x2 + 18, 530, x2 + 54, 530), fill=LIME, width=7)
            draw.polygon([(x2 + 50, 516), (x2 + 50, 544), (x2 + 72, 530)], fill=LIME)
    draw.rounded_rectangle((70, 830, 1850, 950), radius=28, fill="#171815", outline="#3f413b", width=3)
    draw.text((110, 867), "PUBLIC EVIDENCE  +  TWO DISTINCT MODEL ROLES  +  UNTOUCHED REQUEST IDs", font=font(FONT_BOLD, 27), fill=CYAN)
    return image


def gonka_router_frame() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(image)
    draw.text((72, 55), "GONKA ROUTER · MANDATORY INFERENCE PATH", font=font(FONT_BOLD, 28), fill=LIME)
    draw.text((72, 112), "Every AI decision crosses one visible boundary.", font=font(FONT_BOLD, 62), fill=PAPER)
    draw.text((74, 195), "所有 AI 推理与信息验证，都经过同一条可见边界。", font=font(FONT_CN, 36), fill="#d7d8d2")

    blocks = [
        (70, 385, 370, 675, PAPER, LIME, "INPUT", "输入", "Text · URL · image"),
        (430, 385, 730, 675, PAPER, YELLOW, "LIVE DATA", "实时数据", "HTML · Google/Bing RSS"),
        (800, 330, 1260, 730, LIME, VIOLET, "GONKA ROUTER", "Gonka 推理入口", "api.gonkarouter.io/v1\n/chat/completions"),
        (1330, 290, 1660, 505, PAPER, CYAN, "KIMI-K2.6", "调查方", "Evidence investigation"),
        (1330, 555, 1660, 770, PAPER, VIOLET, "MINIMAX-M2.7", "质疑方", "Adversarial review"),
        (1720, 385, 1860, 675, PAPER, PINK, "OUTPUT", "输出", "Score\nTrace\nIDs"),
    ]
    for x1, y1, x2, y2, fill, accent, title, chinese, body in blocks:
        draw.rounded_rectangle((x1 + 10, y1 + 10, x2 + 10, y2 + 10), radius=28, fill=accent)
        draw.rounded_rectangle((x1, y1, x2, y2), radius=28, fill=fill, outline="#171815", width=4)
        draw.text((x1 + 24, y1 + 36), title, font=font(FONT_BOLD, 25 if x2 - x1 > 180 else 18), fill=BLACK)
        draw.text((x1 + 24, y1 + 88), chinese, font=font(FONT_CN, 24 if x2 - x1 > 180 else 19), fill="#454741")
        draw.multiline_text((x1 + 24, y1 + 160), body, font=font(FONT_REGULAR, 19), fill=BLACK, spacing=8)
    arrows = [(370, 530, 430), (730, 530, 800), (1260, 420, 1330), (1260, 650, 1330), (1660, 420, 1720), (1660, 650, 1720)]
    for x1, y, x2 in arrows:
        draw.line((x1 + 10, y, x2 - 18, y), fill=LIME, width=7)
        draw.polygon([(x2 - 23, y - 13), (x2 - 23, y + 13), (x2 - 3, y)], fill=LIME)
    draw.rounded_rectangle((70, 855, 1860, 960), radius=26, fill="#181915", outline="#41423d", width=3)
    draw.text((105, 887), "NON-AI RETRIEVAL", font=font(FONT_BOLD, 23), fill=YELLOW)
    draw.text((345, 884), "检索层不调用其他 AI", font=font(FONT_CN, 22), fill=YELLOW)
    draw.text((760, 887), "ALL SEMANTIC INFERENCE", font=font(FONT_BOLD, 23), fill=CYAN)
    draw.text((1080, 884), "全部语义推理进入 Gonka", font=font(FONT_CN, 22), fill=CYAN)
    return image


def gonka_sequence_frame() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((76, 60), "GONKA EXECUTION SEQUENCE", font=font(FONT_BOLD, 28), fill=VIOLET)
    draw.text((76, 116), "Two models. Distinct responsibilities. Preserved receipts.", font=font(FONT_BOLD, 57), fill=BLACK)
    draw.text((78, 194), "双模型分工，而不是重复回答；每次调用都保留真实回执。", font=font(FONT_CN, 35), fill="#555750")
    steps = [
        ("01", "RETRIEVE", "检索实时证据", YELLOW, "No AI call"),
        ("02", "KIMI", "形成调查判断", CYAN, "Gonka Request ID #1"),
        ("03", "MINIMAX", "执行对抗审查", VIOLET, "Gonka Request ID #2"),
        ("04", "VALIDATE", "拒绝越界来源", LIME, "Source indexes checked"),
        ("05", "SCORE", "确定性计算评分", PINK, "55% models + 45% evidence"),
    ]
    for index, (number, title, chinese, accent, detail) in enumerate(steps):
        x1 = 72 + index * 360
        x2 = x1 + 306
        draw.rounded_rectangle((x1 + 12, 360 + 12, x2 + 12, 735 + 12), radius=32, fill=VIOLET)
        draw.rounded_rectangle((x1, 360, x2, 735), radius=32, fill=accent, outline=BLACK, width=4)
        draw.rounded_rectangle((x1 + 24, 385, x1 + 88, 432), radius=20, fill=PAPER, outline=BLACK, width=2)
        draw.text((x1 + 43, 394), number, font=font(FONT_BOLD, 19), fill=BLACK)
        draw.text((x1 + 26, 485), title, font=font(FONT_BOLD, 28), fill=BLACK)
        draw.text((x1 + 26, 544), chinese, font=font(FONT_CN, 25), fill="#3f413c")
        draw.multiline_text((x1 + 26, 635), detail, font=font(FONT_REGULAR, 18), fill=BLACK, spacing=7)
        if index < len(steps) - 1:
            draw.line((x2 + 14, 550, x2 + 48, 550), fill=BLACK, width=6)
            draw.polygon([(x2 + 45, 537), (x2 + 45, 563), (x2 + 66, 550)], fill=BLACK)
    draw.rounded_rectangle((72, 845, 1848, 960), radius=26, fill=BLACK)
    draw.text((110, 882), "FAILED CALLS REMAIN PARTIAL IN THE TRACE", font=font(FONT_BOLD, 24), fill=LIME)
    draw.text((750, 879), "失败调用保留在轨迹中，不被隐藏", font=font(FONT_CN, 23), fill=LIME)
    return image


def gonka_requirements_frame() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((76, 52), "TRACK 3 REQUIREMENTS · IMPLEMENTATION MAP", font=font(FONT_BOLD, 28), fill=VIOLET)
    draw.text((76, 107), "What the brief requires. What FactRelay ships.", font=font(FONT_BOLD, 60), fill=BLACK)
    draw.text((78, 188), "赛道三要求什么，FactRelay 就展示什么。", font=font(FONT_CN, 36), fill="#53554f")
    rows = [
        ("MANDATORY ROUTER", "所有 AI 推理经 gonkarouter.io", "api.gonkarouter.io/v1/chat/completions", LIME),
        ("MULTI-MODEL", "至少两款模型交叉核验", "Kimi-K2.6 × MiniMax-M2.7", CYAN),
        ("INPUT + LIVE DATA", "链接、文本、图片与实时数据", "Text · URL · image + HTML/RSS", YELLOW),
        ("TRACEABLE OUTPUT", "0–100 Score、轨迹与 Request ID", "Truth Score + ledger + untouched IDs", PINK),
    ]
    for index, (requirement, chinese, shipped, accent) in enumerate(rows):
        y1 = 315 + index * 160
        draw.rounded_rectangle((78, y1, 1842, y1 + 132), radius=26, fill="#FFFFFF", outline=BLACK, width=3)
        draw.rounded_rectangle((96, y1 + 30, 200, y1 + 96), radius=28, fill=accent, outline=BLACK, width=2)
        draw.text((120, y1 + 46), "PASS", font=font(FONT_BOLD, 17), fill=BLACK)
        draw.text((238, y1 + 25), requirement, font=font(FONT_BOLD, 24), fill=BLACK)
        draw.text((238, y1 + 72), chinese, font=font(FONT_CN, 22), fill="#555750")
        draw.text((1040, y1 + 49), shipped, font=font(FONT_BOLD, 22), fill=VIOLET)
    draw.text((78, 984), "Source: official AI³ Growth Hackathon Track 3 brief · 依据：赛事官方赛道三说明", font=font(FONT_CN, 18), fill="#777972")
    return image


def gonka_proof_frame() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(image)
    proof_title = "PRODUCTION PROOF"
    draw.text((76, 55), proof_title, font=font(FONT_BOLD, 28), fill=LIME)
    proof_width = draw.textbbox((0, 0), proof_title, font=font(FONT_BOLD, 28))[2]
    draw.text((94 + proof_width, 53), "· 公开站真实运行证明", font=font(FONT_CN, 26), fill=LIME)
    draw.text((76, 116), "Connected is a runtime fact—not a slide claim.", font=font(FONT_BOLD, 59), fill=PAPER)
    draw.text((78, 196), "接入不是口号，而是公开环境中的真实运行状态。", font=font(FONT_CN, 36), fill="#d2d3cd")
    cards = [
        ("HEALTH", "liveReady: true", "Provider: GonkaRouter", LIME),
        ("MODEL 01", "Kimi-K2.6", "Request ID present", CYAN),
        ("MODEL 02", "MiniMax-M2.7", "Request ID present", VIOLET),
        ("LIVE CASE", "Truth Score 18", "5 public sources", PINK),
    ]
    for index, (label, value, detail, accent) in enumerate(cards):
        x1 = 76 + index * 448
        x2 = x1 + 394
        draw.rounded_rectangle((x1 + 12, 340 + 12, x2 + 12, 735 + 12), radius=34, fill=accent)
        draw.rounded_rectangle((x1, 340, x2, 735), radius=34, fill=PAPER, outline=BLACK, width=4)
        draw.text((x1 + 28, 380), label, font=font(FONT_BOLD, 21), fill=VIOLET)
        draw.text((x1 + 28, 475), value, font=font(FONT_BOLD, 31), fill=BLACK)
        draw.text((x1 + 28, 555), detail, font=font(FONT_REGULAR, 21), fill="#4d4f49")
        draw.rounded_rectangle((x1 + 28, 650, x1 + 128, 695), radius=20, fill=accent, outline=BLACK, width=2)
        draw.text((x1 + 54, 661), "PASS", font=font(FONT_BOLD, 17), fill=BLACK)
    draw.rounded_rectangle((76, 850, 1844, 962), radius=26, fill="#181915", outline="#41423d", width=3)
    draw.text((110, 885), "UPSTREAM response.id → requestId · UNCHANGED", font=font(FONT_BOLD, 24), fill=CYAN)
    draw.text((785, 882), "上游回执原样保存并显示", font=font(FONT_CN, 23), fill=CYAN)
    return image


def contact_sheet(frames: list[Path]) -> Image.Image:
    sheet = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(sheet)
    cell_w, cell_h = 384, 270
    for index, frame_path in enumerate(frames):
        row, col = divmod(index, 5)
        x, y = col * cell_w, row * cell_h
        thumb = Image.open(frame_path).convert("RGB").resize((356, 200), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x + 14, y + 12))
        start, end, _, _ = SUBTITLES[index]
        label = f"{index + 1:02d}  {start[3:8]} → {end[3:8]}"
        draw.text((x + 16, y + 220), label, font=font(FONT_BOLD, 17), fill=BLACK)
        draw.text((x + 16, y + 244), PLAN[index][4], font=font(FONT_CN, 14), fill="#5c5e58")
    return sheet


def seconds(timestamp: str) -> float:
    hours, minutes, remainder = timestamp.split(":")
    seconds_text, millis = remainder.split(",")
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds_text) + int(millis) / 1000


def main() -> None:
    if len(PLAN) != len(SUBTITLES):
        raise SystemExit("Storyboard plan must match the 19 subtitle cues exactly.")
    PRIMARY.mkdir(parents=True, exist_ok=True)
    BONUS.mkdir(parents=True, exist_ok=True)
    GONKA.mkdir(parents=True, exist_ok=True)
    for directory in (PRIMARY, BONUS, GONKA):
        for old in directory.glob("*.png"):
            old.unlink()

    accents = [VIOLET, LIME, CYAN, YELLOW, PINK]
    generated: list[Path] = []
    rows = []
    for index, ((slug, source_name, mode, box, purpose), subtitle) in enumerate(zip(PLAN, SUBTITLES), start=1):
        start, end, chinese, english = subtitle
        filename = f"{index:02d}_{start.replace(':', '-').replace(',', '-')}_{slug}.png"
        destination = PRIMARY / filename
        if mode == "full":
            image = full(SHOTS / source_name)
        elif mode == "focus":
            image = focus(SHOTS / source_name, box, accents[(index - 1) % len(accents)])
        elif mode == "architecture":
            architecture_frame(destination)
            image = None
        elif mode == "gonka_sequence":
            image = gonka_sequence_frame()
        elif mode == "safety":
            image = safety_frame()
        elif mode == "mosaic":
            image = mosaic_frame()
        elif mode == "chain":
            image = chain_frame()
        elif mode == "close":
            close_frame(destination)
            image = None
        else:
            raise ValueError(mode)
        if image is not None:
            image.save(destination, quality=95)
        generated.append(destination)
        rows.append((index, start, end, seconds(end) - seconds(start), filename, purpose, chinese, english))

    bonus_sources = [
        ("B01_来源卡片转场.png", "01_首页_来源卡片.png"),
        ("B02_质疑卡片转场.png", "02_首页_质疑卡片.png"),
        ("B03_回执卡片转场.png", "03_首页_回执卡片.png"),
        ("B04_证据缺口转场.png", "09_真实结果_05_证据缺口.png"),
    ]
    for filename, source in bonus_sources:
        full(SHOTS / source).save(BONUS / filename, quality=95)

    gonka_frames = [
        ("G01_所有AI推理通过GonkaRouter.png", gonka_router_frame()),
        ("G02_双模型交叉核验执行序列.png", gonka_sequence_frame()),
        ("G03_赛道三要求逐项对照.png", gonka_requirements_frame()),
        ("G04_公开站真实运行证明.png", gonka_proof_frame()),
    ]
    for filename, image in gonka_frames:
        image.save(GONKA / filename, quality=95)

    contact_sheet(generated).save(OUT / "00_逐句配图总览.png", quality=95)

    with (OUT / "00_剪辑时间表.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["序号", "开始", "结束", "时长秒", "画面文件", "画面内容", "中文口播/字幕", "English subtitle"])
        writer.writerows(rows)

    lines = [
        "# FactRelay 逐句配图与字幕对应表",
        "",
        "19 张主画面与现有 19 条字幕严格一一对应；另有 4 张备用转场图和 4 张 Gonka 核心架构图。所有画面均为 1920×1080，不含烧录字幕和音频。",
        "",
        "| # | 时间码 | 时长 | 文件 | 画面 | 中文口播/字幕 |",
        "| ---: | --- | ---: | --- | --- | --- |",
    ]
    for index, start, end, duration, filename, purpose, chinese, _ in rows:
        lines.append(f"| {index:02d} | {start} → {end} | {duration:.1f}s | `{filename}` | {purpose} | {chinese} |")
    lines.extend([
        "",
        "## 使用方式",
        "",
        "1. 按文件名前两位数字顺序导入剪辑软件。",
        "2. 每张图片的停留时间直接使用表中的时间码；总时长正好 150 秒。",
        "3. 录制口播时严格按中文列朗读即可；自然停顿可以留在每条字幕末尾。",
        "4. 真人口播交回后，再进行降噪、响度统一、画面对齐与最终字幕合成。",
        "5. `02_备用转场_4张` 只在口播有额外停顿时使用，不改变主时间轴。",
        "6. `03_Gonka核心架构_4张` 用于技术说明、答辩或替换第 15–18 段，依次展示强制推理边界、双模型序列、赛道要求映射和公开站运行证明。",
        "",
    ])
    (OUT / "00_字幕与配图对应表.md").write_text("\n".join(lines), encoding="utf-8")
    print(
        f"Generated {len(generated)} primary frames, {len(bonus_sources)} transitions, "
        f"{len(gonka_frames)} Gonka diagrams, one contact sheet, CSV, and mapping."
    )


if __name__ == "__main__":
    main()

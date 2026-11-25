"""앱 아이콘(1024, 투명도 없음)과 스플래시(2732) 생성. 실행: python3 resources/make_icons.py"""
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
import os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
IOS = os.path.join(ROOT, '..', 'ios', 'App', 'App', 'Assets.xcassets')
FONT_CANDIDATES = [
    '/System/Library/Fonts/AppleSDGothicNeo.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
]
FONT = next((f for f in FONT_CANDIDATES if os.path.exists(f)), None)
if not FONT:
    sys.exit('한글 폰트를 찾을 수 없습니다')

def icon(size=1024):
    S = size
    im = Image.new('RGB', (S, S), (6, 6, 8))
    d = ImageDraw.Draw(im)
    # 객차 통로 원근: 바깥 사각형 → 안쪽 소실 사각형
    cx, cy = S // 2, int(S * 0.44)
    inner = (cx - S * 0.07, cy - S * 0.08, cx + S * 0.07, cy + S * 0.08)
    # 천장/바닥/벽 면
    d.polygon([(0, 0), (S, 0), (inner[2], inner[1]), (inner[0], inner[1])], fill=(58, 58, 54))
    d.polygon([(0, S), (S, S), (inner[2], inner[3]), (inner[0], inner[3])], fill=(34, 33, 31))
    d.polygon([(0, 0), (inner[0], inner[1]), (inner[0], inner[3]), (0, S)], fill=(44, 46, 52))
    d.polygon([(S, 0), (inner[2], inner[1]), (inner[2], inner[3]), (S, S)], fill=(44, 46, 52))
    # 파란 의자 띠
    for side in (-1, 1):
        x0 = 0 if side < 0 else S
        xi = inner[0] if side < 0 else inner[2]
        d.polygon([(x0, S * 0.80), (xi, inner[3] - S * 0.035), (xi, inner[3] - S * 0.02), (x0, S * 0.92)], fill=(36, 62, 120))
    # 형광등 두 줄 (하나는 붉게)
    glow = Image.new('RGB', (S, S), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    for i in range(6):
        t0 = i / 6
        t1 = t0 + 0.09
        for side in (-1, 1):
            def p(t, off):
                x = cx + side * (S * 0.30 * (1 - t) + S * 0.035 * t) + off
                y = (S * 0.02) * (1 - t) + inner[1] * t
                return (x, y)
            col = (255, 40, 40) if (i == 2 and side == 1) else (235, 240, 255)
            w = S * 0.05 * (1 - t0) + 3
            g.polygon([p(t0, -w), p(t0, w), p(t1, w * 0.8), p(t1, -w * 0.8)], fill=col)
    im = Image.composite(glow, im, glow.convert('L').point(lambda v: 255 if v > 10 else 0))
    blur = glow.filter(ImageFilter.GaussianBlur(S * 0.03))
    lit = ImageChops.add(im, blur.point(lambda v: v // 2))
    # 끝 문 (밝은 창)
    d = ImageDraw.Draw(lit)
    d.rectangle(inner, fill=(150, 154, 160))
    wx = (inner[2] - inner[0]) * 0.25
    d.rectangle((inner[0] + wx, inner[1] + (inner[3] - inner[1]) * 0.18, inner[2] - wx, inner[1] + (inner[3] - inner[1]) * 0.52), fill=(12, 12, 14))
    # 비네팅
    vig = Image.new('L', (S, S), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse((-S * 0.25, -S * 0.25, S * 1.25, S * 1.25), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(S * 0.12))
    lit = Image.composite(lit, Image.new('RGB', (S, S), (0, 0, 0)), vig)
    # 글자
    d = ImageDraw.Draw(lit)
    f = ImageFont.truetype(FONT, int(S * 0.2))
    text = '막차'
    tw = d.textlength(text, font=f)
    d.text(((S - tw) / 2 + 6, S * 0.67 + 6), text, font=f, fill=(0, 0, 0))
    d.text(((S - tw) / 2, S * 0.67), text, font=f, fill=(240, 236, 226))
    return lit

def splash(size=2732):
    im = Image.new('RGB', (size, size), (0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 96)
    text = '막차 이상현상'
    tw = d.textlength(text, font=f)
    d.text(((size - tw) / 2, size / 2 - 60), text, font=f, fill=(110, 106, 98))
    return im

if __name__ == '__main__':
    ic = icon()
    ic.save(os.path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'))
    ic.save(os.path.join(ROOT, 'icon-1024.png'))
    sp = splash()
    for n in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        sp.save(os.path.join(IOS, 'Splash.imageset', n))
    print('ok')

# 얼음싹싹 로고 생성: Pretendard Black 글리프를 패스로 바꿔 SVG에 넣는다.
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

S, OUT = sys.argv[1], sys.argv[2]
font = TTFont(S + '/package/dist/public/static/Pretendard-Black.otf')
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm

BLUE, INK, WHITE = '#0b5ad9', '#111a23', '#ffffff'

def word(text, size, x0, baseline, track=-0.012):
    """글자별 패스 목록 [(char, d)]과 끝 x 좌표"""
    sc = size / upm; x = x0; out = []
    for ch in text:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, baseline)))
        out.append((ch, pen.getCommands()))
        x += gs[g].width * sc + track * size
    return out, x - track * size

def ink_bounds(text, size):
    sc = size / upm; bp = BoundsPen(gs); x = 0
    for ch in text:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(bp, (sc, 0, 0, -sc, x, 0)))
        x += gs[g].width * sc - 0.012 * size
    return bp.bounds  # (xmin, ymin, xmax, ymax), y 아래가 +

def _rounded(pts, r):
    import math
    d = ''
    for i in range(len(pts)):
        p0, p1, p2 = pts[i-1], pts[i], pts[(i+1) % len(pts)]
        def tw(a, b, t):
            L = math.dist(a, b); return (a[0]+(b[0]-a[0])*t/L, a[1]+(b[1]-a[1])*t/L)
        a, b = tw(p1, p0, r), tw(p1, p2, r)
        d += ('M' if i == 0 else 'L') + f'{a[0]:.2f} {a[1]:.2f} Q{p1[0]:.2f} {p1[1]:.2f} {b[0]:.2f} {b[1]:.2f} '
    return d + 'Z'

def mark(x, y, s, bg=BLUE, fg=WHITE):
    """얼음 조각 심볼: 모서리를 깎은 각얼음(팔각형) + 닦아 낸 두 줄(싹·싹) + 반짝임. 64 단위 기준."""
    k = s / 64
    c = 13  # 모서리 깎는 길이
    pts = [(c,0),(64-c,0),(64,c),(64,64-c),(64-c,64),(c,64),(0,64-c),(0,c)]
    pts = [(x + px*k, y + py*k) for px, py in pts]
    T = lambda px, py: f"{x + px * k:.2f} {y + py * k:.2f}"
    cx, cy, r = 45, 44, 9; q = r * 0.12
    star = (f"M{T(cx,cy-r)} C{T(cx+q,cy-q)} {T(cx+q,cy-q)} {T(cx+r,cy)} C{T(cx+q,cy+q)} {T(cx+q,cy+q)} {T(cx,cy+r)} "
            f"C{T(cx-q,cy+q)} {T(cx-q,cy+q)} {T(cx-r,cy)} C{T(cx-q,cy-q)} {T(cx-q,cy-q)} {T(cx,cy-r)} Z")
    return (f'<path d="{_rounded(pts, 3.5*k)}" fill="{bg}"/>'
            f'<g stroke="{fg}" stroke-width="{6.2*k:.2f}" stroke-linecap="round" fill="none">'
            f'<path d="M{T(13,29)} L{T(29,13)}"/><path d="M{T(13,42)} L{T(42,13)}"/></g>'
            f'<path d="{star}" fill="{fg}"/>')

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

NAME = '얼음싹싹'
# 가로형: 심볼 64 + 간격 16 + 글자(캡 높이에 맞춤)
size = 52
bx = ink_bounds(NAME, size)  # 글자 실제 잉크 범위
glyph_h = bx[3] - bx[1]
H = 64
baseline = (H - glyph_h) / 2 - bx[1]
def horizontal(c1, c2, mbg, mfg):
    letters, end = word(NAME, size, 64 + 16 - bx[0], baseline)
    body = mark(0, 0, 64, mbg, mfg)
    body += ''.join(f'<path fill="{c1 if i < 2 else c2}" d="{d}"/>' for i, (ch, d) in enumerate(letters))
    return svg(end + 2, H, body, NAME)

open(OUT + '/logo.svg', 'w').write(horizontal(INK, BLUE, BLUE, WHITE))
open(OUT + '/logo-white.svg', 'w').write(horizontal(WHITE, WHITE, WHITE, BLUE))
open(OUT + '/logo-mono.svg', 'w').write(horizontal(INK, INK, INK, WHITE))
open(OUT + '/logo-mark.svg', 'w').write(svg(64, 64, mark(0, 0, 64), NAME + ' 심볼'))
open(OUT + '/favicon.svg', 'w').write(svg(64, 64, mark(0, 0, 64), NAME))

# 세로형: 심볼 위, 글자 아래 가운데
size2 = 40
b2 = ink_bounds(NAME, size2); w2 = b2[2] - b2[0]
W = max(w2, 96) + 8
letters, end = word(NAME, size2, (W - w2) / 2 - b2[0], 96 + 18 - b2[1])
body = mark((W - 96) / 2, 0, 96) + ''.join(f'<path fill="{INK if i < 2 else BLUE}" d="{d}"/>' for i, (ch, d) in enumerate(letters))
open(OUT + '/logo-stacked.svg', 'w').write(svg(W, 96 + 18 + (b2[3] - b2[1]) + 2, body, NAME))
print('ok', round(end), glyph_h)

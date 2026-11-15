"""Generates the Loyalty Loop logo family SVGs into ../ (brand/).
Run: python brand/src/build.py [path-to-BricolageGrotesque_600SemiBold.ttf]
Requires fonttools (only to outline the wordmark so SVGs need no installed font).
"""
import math, sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = os.path.join(os.path.dirname(__file__), '..')
FONT = sys.argv[1] if len(sys.argv) > 1 else 'BricolageGrotesque_600SemiBold.ttf'

# Colours sampled from the existing logo (apps/web/public/logo-for-emails.png)
PAL = {
  'colour':   dict(a='#5E6839', b='#CF7A37', c='#AA521E', text='#5E6839'),
  'reversed': dict(a='#B4C386', b='#EE9A52', c='#E2784A', text='#F8E4C6'),
  'dark':     dict(a='#1C2620', b='#1C2620', c='#1C2620', text='#1C2620'),
  'white':    dict(a='#FFFFFF', b='#FFFFFF', c='#FFFFFF', text='#FFFFFF'),
}

def pol(cx, cy, th, r):
    t = math.radians(th)
    return (cx + r*math.cos(t), cy + r*math.sin(t))

def blade(start, span, r_out, wmax, tip_r=None, cx=128, cy=128):
    """One clockwise crescent-arrow: fat back, long tapering point in the loop direction."""
    n = 40; po, pi_ = [], []
    for k in range(n+1):
        t = k/n
        th = start + span*t
        w = wmax * math.sin(math.pi * t**0.72)
        po.append(pol(cx, cy, th, r_out))
        pi_.append(pol(cx, cy, th, r_out - w))
    pts = po + pi_[::-1]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'

def drop(th, r, size, cx=128, cy=128):
    """Orange teardrop used in the detailed (primary) mark only."""
    x, y = pol(cx, cy, th, r)
    rot = th + 90
    s = size
    return (f'<path transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({s})" '
            f'd="M0 -1 C.55 -.35 .6 .5 0 .62 C-.6 .5 -.55 -.35 0 -1Z"/>')

def mark_simple(p, cx=128, cy=128):
    cols = [p['a'], p['b'], p['c'], p['a']]
    g = []
    for i, c in enumerate(cols):
        d = blade(-100 + 90*i, 82, 118, 60)
        g.append(f'<path fill="{c}" d="{d}"/>')
    return ''.join(g)

def mark_detailed(p):
    cols = [p['a'], p['a'], p['c'], p['a']]
    g = []
    for i, c in enumerate(cols):
        g.append(f'<path fill="{c}" d="{blade(-100 + 90*i, 76, 104, 50)}"/>')
    drops = ''.join(drop(-28 + 90*i, 112, 22) for i in range(4))
    return ''.join(g) + f'<g fill="{p["b"]}">{drops}</g>'

# --- wordmark outlining ---------------------------------------------------
font = TTFont(FONT); gs = font.getGlyphSet(); cmap = font.getBestCmap(); hmtx = font['hmtx']
upm = font['head'].unitsPerEm
kern = {}
def text_path(txt, size, x0=0, y0=0, tracking=0):
    s = size/upm; x = 0; parts = []
    for ch in txt:
        gn = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (s, 0, 0, -s, x0 + x, y0))
        gs[gn].draw(tp)
        parts.append(pen.getCommands())
        x += hmtx[gn][0]*s + tracking
    return ' '.join(parts), x - tracking

def svg(w, h, body, bg=None, title='The Loyalty Loop'):
    r = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{r}{body}</svg>\n')

def wr(name, content):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f: f.write(content)

def primary(p):  # stacked, detailed: the existing logo's layout
    d, wd = text_path('The Loyalty Loop', 56, 0, 0, tracking=0.5)
    W = max(wd, 256) + 80; H = 256 + 28 + 56 + 40
    tx = (W - wd)/2
    d, _ = text_path('The Loyalty Loop', 56, tx, 256 + 28 + 44, tracking=0.5)
    return svg(W, H, f'<g transform="translate({(W-256)/2:.1f} 20)">{mark_detailed(p)}</g><path fill="{p["text"]}" d="{d}"/>'), (W, H)

def secondary(p):  # horizontal: simple mark + wordmark
    d, wd = text_path('The Loyalty Loop', 76, 0, 0, tracking=0.4)
    d, _ = text_path('The Loyalty Loop', 76, 256 + 36, 128 + 27, tracking=0.4)
    W = 256 + 36 + wd; H = 256
    return svg(W, H, f'{mark_simple(p)}<path fill="{p["text"]}" d="{d}"/>'), (W, H)

def brandmark(p):
    return svg(256, 256, mark_simple(p)), (256, 256)

BG = {'colour': None, 'reversed': None, 'dark': None, 'white': None}
sizes = {}
for var, p in PAL.items():
    for nm, fn in (('primary', primary), ('secondary', secondary), ('mark', brandmark)):
        s, wh = fn(p)
        wr(f'loyalty-loop-{nm}-{var}.svg', s); sizes[nm] = wh

# App-icon sources: mark centred on a tile, with a safe zone.
def tile(bg, p, scale, name):
    off = (1024 - 256*scale)/2
    body = f'<rect width="1024" height="1024" fill="{bg}"/><g transform="translate({off:.1f} {off:.1f}) scale({scale})">{mark_simple(p)}</g>'
    wr(name, svg(1024, 1024, body))
tile('#F8E4C6', PAL['colour'], 2.5, 'app-icon/app-icon-paper.svg')       # iOS / store icon: mark ~62% of tile
tile('#1C2620', PAL['reversed'], 2.5, 'app-icon/app-icon-dark.svg')
# Android adaptive: transparent foreground inside the 66% safe zone, monochrome = single colour.
wr('app-icon/android-foreground.svg', svg(1024, 1024, f'<g transform="translate(272 272) scale(1.9375)">{mark_simple(PAL["colour"])}</g>'))
wr('app-icon/android-monochrome.svg', svg(1024, 1024, f'<g transform="translate(272 272) scale(1.9375)">{mark_simple(PAL["white"])}</g>'))
wr('app-icon/favicon.svg', svg(256, 256, mark_simple(PAL['colour']), title='The Loyalty Loop'))
print(sizes)

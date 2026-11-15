"""Hand-written vector mascots for The Loyalty Loop.

Run: python brand/mascot/src/build.py
Writes brand/mascot/svg/<name>-<pose>.svg (light) and svg/dark/<name>-<pose>.svg (near-black backgrounds).
Three characters (dot, whirl, pip) x six poses. No image generation is involved: every shape is written here.
"""
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MARK = pathlib.Path(__file__).resolve().parents[2] / 'loyalty-loop-mark-colour.svg'
PATHS = re.findall(r'<path fill="(#[0-9A-F]+)" d="([^"]+)"', MARK.read_text())  # four blades

LIGHT = dict(O='#5E6839', A='#CF7A37', R='#AA521E', P='#F8E4C6', W='#FFF8EA', INK='#2B1A10', OUT='#2B1A10', dark=False)
DARK = dict(O='#B4C386', A='#EE9A52', R='#E2784A', P='#F8E4C6', W='#FFF8EA', INK='#2B1A10', OUT='#F8E4C6', dark=True)
POSES = ['wave', 'stamp', 'celebrate', 'sleepy', 'think', 'thumbs']

# hand targets shared by dot and whirl: (right hand, left hand)
HANDS = {
    'wave': ((238, 82), (30, 178)),
    'stamp': ((176, 196), (36, 196)),
    'celebrate': ((236, 66), (20, 66)),
    'sleepy': ((216, 188), (40, 188)),
    'think': ((150, 176), (38, 184)),
    'thumbs': ((236, 118), (40, 186)),
}
BEND = {'wave': (-26, 14), 'stamp': (14, 14), 'celebrate': (-22, 22), 'sleepy': (10, -10), 'think': (22, 10), 'thumbs': (-20, -12)}


def f(n):
    return f'{n:.1f}'.rstrip('0').rstrip('.')


def mark_group(t, scale, cx, cy, rot=0, outline=None, ow=0):
    cols = [t['O'], t['A'], t['R'], t['O']]
    items = []
    for (_, d), c in zip(PATHS, cols):
        st = f' stroke="{outline}" stroke-width="{f(ow / scale)}" stroke-linejoin="round"' if outline else ''
        items.append(f'<path fill="{c}" d="{d}"{st}/>')
    return f'<g transform="translate({f(cx)} {f(cy)}) rotate({rot}) scale({scale}) translate(-128 -128)">{"".join(items)}</g>'


def arm(t, sh, hand_p, bend, col):
    (x1, y1), (x2, y2) = sh, hand_p
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1
    cx, cy = mx - dy / length * bend, my + dx / length * bend
    d = f'M{f(x1)} {f(y1)} Q{f(cx)} {f(cy)} {f(x2)} {f(y2)}'
    return (f'<path d="{d}" fill="none" stroke="{t["OUT"]}" stroke-width="20" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{col}" stroke-width="12" stroke-linecap="round"/>')


def hand(t, p, col, r=11, outline=True):
    st = f' stroke="{t["OUT"]}" stroke-width="4"' if outline else ''
    return f'<circle cx="{f(p[0])}" cy="{f(p[1])}" r="{r}" fill="{col}"{st}/>'


def thumb(t, p, col):
    x, y = p
    return (f'<rect x="{f(x - 9)}" y="{f(y - 27)}" width="17" height="24" rx="8.5" fill="{col}" stroke="{t["OUT"]}" stroke-width="4"/>'
            + hand(t, p, col, 13) + f'<rect x="{f(x - 6)}" y="{f(y - 20)}" width="11" height="14" fill="{col}"/>')


def sparkle(x, y, s, col):
    return (f'<path d="M{f(x)} {f(y - s)} Q{f(x)} {f(y)} {f(x + s)} {f(y)} Q{f(x)} {f(y)} {f(x)} {f(y + s)} '
            f'Q{f(x)} {f(y)} {f(x - s)} {f(y)} Q{f(x)} {f(y)} {f(x)} {f(y - s)}Z" fill="{col}"/>')


def confetti(t):
    out = []
    pieces = [(60, 30, 20, 'A'), (196, 22, 40, 'O'), (128, 14, 70, 'R'), (24, 112, 10, 'O'), (232, 120, 55, 'A'),
              (88, 40, 30, 'O'), (170, 40, 15, 'R'), (36, 38, 60, 'R'), (222, 52, 5, 'A')]
    for x, y, rot, c in pieces:
        out.append(f'<rect x="{x - 5}" y="{y - 3}" width="10" height="6" rx="1.5" fill="{t[c]}" transform="rotate({rot} {x} {y})"/>')
    out.append(sparkle(112, 22, 8, t['A']))
    return ''.join(out)


def zzz(t, x, y):
    col = t['OUT']

    def z(px, py, s):
        return (f'<path d="M{f(px)} {f(py)} H{f(px + s)} L{f(px)} {f(py + s)} H{f(px + s)}" fill="none" stroke="{col}" '
                f'stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')
    return z(x, y, 10) + z(x + 14, y - 20, 14) + z(x + 36, y - 46, 18)


def bubble(t, x, y):
    o, w = t['OUT'], t['W']
    q = (f'<path d="M{x - 6} {y - 8} Q{x - 6} {y - 17} {x + 1} {y - 17} Q{x + 9} {y - 17} {x + 9} {y - 9} Q{x + 9} {y - 3} {x + 1} {y} V{y + 3}" '
         f'fill="none" stroke="{t["R"]}" stroke-width="5" stroke-linecap="round"/><circle cx="{x + 1}" cy="{y + 10}" r="3" fill="{t["R"]}"/>')
    return (f'<circle cx="{x - 30}" cy="{y + 34}" r="4" fill="{w}" stroke="{o}" stroke-width="3"/>'
            f'<circle cx="{x - 18}" cy="{y + 22}" r="7" fill="{w}" stroke="{o}" stroke-width="3"/>'
            f'<ellipse cx="{x}" cy="{y - 2}" rx="30" ry="22" fill="{w}" stroke="{o}" stroke-width="3.5"/>' + q)


def card(t, x, y, w=104, h=52, rot=0, filled=3):
    s = [f'<g transform="rotate({rot} {x + w / 2} {y + h / 2})"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" '
         f'fill="{t["W"]}" stroke="{t["OUT"]}" stroke-width="4"/>']
    for i in range(4):
        cx = x + 20 + i * 21.3
        cy = y + h / 2 + 4
        if i < filled:
            s.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="8" fill="{t["O"]}"/><path d="M{f(cx - 3.5)} {f(cy)} l2.5 3 l5 -6" fill="none" '
                     f'stroke="{t["W"]}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>')
        else:
            s.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="8" fill="none" stroke="{t["R"]}" stroke-width="2.5" stroke-dasharray="3.5 3"/>')
    s.append(f'<rect x="{x + 12}" y="{y + 9}" width="34" height="5" rx="2.5" fill="{t["R"]}"/></g>')
    return ''.join(s)


def stamp(t, p, outline=True):
    x, y = p
    st = f' stroke="{t["OUT"]}" stroke-width="4"' if outline else ''
    return (f'<rect x="{x - 8}" y="{y - 34}" width="16" height="22" rx="7" fill="{t["R"]}"{st}/>'
            f'<rect x="{x - 18}" y="{y - 14}" width="36" height="12" rx="4" fill="{t["R"]}"{st}/>')


# ---------- faces ----------
def eye(t, kind, x, y, googly=False, look=(0, 0)):
    ink = t['INK']
    if kind == 'happy':
        return f'<path d="M{x - 9} {y + 4} Q{x} {y - 10} {x + 9} {y + 4}" fill="none" stroke="{ink}" stroke-width="4.5" stroke-linecap="round"/>'
    if kind == 'closed':
        return f'<path d="M{x - 9} {y - 2} Q{x} {y + 8} {x + 9} {y - 2}" fill="none" stroke="{ink}" stroke-width="4.5" stroke-linecap="round"/>'
    lx, ly = look
    if googly:
        return (f'<circle cx="{x}" cy="{y}" r="17" fill="{t["W"]}" stroke="{ink}" stroke-width="3.5"/>'
                f'<circle cx="{x + lx * 8}" cy="{y + ly * 8}" r="8" fill="{ink}"/>'
                f'<circle cx="{x + lx * 8 + 3}" cy="{y + ly * 8 - 3}" r="2.6" fill="{t["W"]}"/>')
    return (f'<ellipse cx="{x + lx * 2}" cy="{y + ly * 2}" rx="5.5" ry="7.5" fill="{ink}"/>'
            f'<circle cx="{x + lx * 2 + 2}" cy="{y + ly * 2 - 2.5}" r="2" fill="{t["W"]}"/>')


def mouth(t, kind, x, y, w=14):
    ink = t['INK']
    if kind == 'smile':
        return f'<path d="M{x - w} {y} Q{x} {y + w * 0.9} {x + w} {y}" fill="none" stroke="{ink}" stroke-width="4.5" stroke-linecap="round"/>'
    if kind == 'grin':
        return (f'<path d="M{x - w} {y - 2} Q{x} {y + w * 0.35} {x + w} {y - 2} Q{x + w * 0.7} {y + w * 1.5} {x} {y + w * 1.5} '
                f'Q{x - w * 0.7} {y + w * 1.5} {x - w} {y - 2}Z" fill="{ink}" stroke="{ink}" stroke-width="3" stroke-linejoin="round"/>'
                f'<path d="M{x - w * 0.5} {y + w * 1.2} Q{x} {y + w * 0.6} {x + w * 0.5} {y + w * 1.2} Q{x} {y + w * 1.5} {x - w * 0.5} {y + w * 1.2}Z" fill="{t["R"]}"/>')
    if kind == 'o':
        return f'<ellipse cx="{x}" cy="{y + 3}" rx="5" ry="6" fill="{ink}"/>'
    if kind == 'flat':
        return f'<path d="M{x - w * 0.6} {y + 2} Q{x} {y - 2} {x + w * 0.6} {y + 3}" fill="none" stroke="{ink}" stroke-width="4.5" stroke-linecap="round"/>'
    if kind == 'smirk':
        return f'<path d="M{x - w} {y + 3} Q{x + 2} {y + w * 0.95} {x + w} {y - 6}" fill="none" stroke="{ink}" stroke-width="4.5" stroke-linecap="round"/>'
    raise ValueError(kind)


FACE = {  # pose -> (eyes, look, mouth)
    'wave': ('open', (0, 0), 'grin'),
    'stamp': ('open', (0, 1), 'smile'),
    'celebrate': ('happy', (0, 0), 'grin'),
    'sleepy': ('closed', (0, 0), 'o'),
    'think': ('open', (-1, -1), 'flat'),
    'thumbs': ('wink', (0, 0), 'grin'),
}


def draw_face(t, pose, ex, ey, mx, my, googly=False, w=14):
    kind, look, m = FACE[pose]
    el, er = ex
    if pose == 'thumbs':
        left, right = eye(t, 'open', el, ey, googly, look), eye(t, 'happy', er, ey, googly, look)
    else:
        left, right = eye(t, kind, el, ey, googly, look), eye(t, kind, er, ey, googly, look)
    mm = 'smirk' if (googly and pose in ('thumbs', 'wave')) else m
    return left + right + mouth(t, mm, mx, my, w)


def svg(body, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="{label}">'
            f'<title>{label}</title>{body}</svg>')


def waves(t):
    return (f'<path d="M222 40 Q236 32 246 44 M214 24 Q232 10 250 28" fill="none" stroke="{t["OUT"]}" '
            f'stroke-width="4" stroke-linecap="round"/>')


# ---------- DOT: round friendly blob ----------
def dot(t, pose):
    out, A, R, O = t['OUT'], t['A'], t['R'], t['O']
    rh, lh = HANDS[pose]
    br, bl = BEND[pose]
    rs, ls = (196, 150), (60, 150)
    s = []
    cy = 144 + (3 if pose == 'sleepy' else 0)
    droop = -32 if pose == 'sleepy' else (8 if pose == 'celebrate' else 0)
    s.append(f'<ellipse cx="102" cy="{cy + 78}" rx="17" ry="10" fill="{R}" stroke="{out}" stroke-width="4"/>'
             f'<ellipse cx="154" cy="{cy + 78}" rx="17" ry="10" fill="{R}" stroke="{out}" stroke-width="4"/>')
    s.append(arm(t, ls, lh, bl, R))
    if pose not in ('think', 'stamp'):
        s.append(arm(t, rs, rh, br, R))
    s.append(f'<g transform="rotate({droop} 128 {cy - 72})"><path d="M128 {cy - 68} C118 {cy - 100} 140 {cy - 122} 172 {cy - 116} '
             f'C174 {cy - 88} 156 {cy - 64} 128 {cy - 68}Z" fill="{O}" stroke="{out}" stroke-width="4" stroke-linejoin="round"/>'
             f'<path d="M130 {cy - 68} Q146 {cy - 90} 162 {cy - 108}" fill="none" stroke="{t["P"]}" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>')
    s.append(f'<ellipse cx="128" cy="{cy}" rx="80" ry="76" fill="{A}" stroke="{out}" stroke-width="5"/>')
    s.append(f'<circle cx="84" cy="{cy + 14}" r="10" fill="{R}" opacity=".55"/><circle cx="172" cy="{cy + 14}" r="10" fill="{R}" opacity=".55"/>')
    s.append(f'<circle cx="128" cy="{cy + 52}" r="26" fill="{t["P"]}" stroke="{out}" stroke-width="3"/>' + mark_group(t, 0.15, 128, cy + 52))
    s.append(draw_face(t, pose, (102, 154), cy - 12, 128, cy + 8, googly=False, w=15))
    if pose == 'stamp':
        s.append(card(t, 78, 188, 104, 52, filled=3))
        sp = (164, 190)
        hp = (164, 152)
        s.append(arm(t, rs, hp, 12, R) + stamp(t, sp) + hand(t, hp, R, 10))
    elif pose == 'think':
        s.append(arm(t, rs, rh, br, R) + hand(t, rh, R) + bubble(t, 214, 36))
    else:
        s.append(thumb(t, rh, R) if pose == 'thumbs' else hand(t, rh, R))
    s.append(hand(t, lh, R))
    if pose == 'celebrate':
        s.append(confetti(t))
    if pose == 'sleepy':
        s.append(zzz(t, 190, 70))
    if pose == 'wave':
        s.append(waves(t))
    return svg(''.join(s), f'Dot the loyalty mascot, {pose}')


# ---------- WHIRL: cheeky loop with arms and legs ----------
def whirl(t, pose, small=False):
    out, O, R = t['OUT'], t['O'], t['R']
    rh, lh = HANDS[pose]
    br, bl = BEND[pose]
    rs, ls = (192, 148), (64, 148)
    cx, cy = 128, 136
    tilt = {'wave': -8, 'stamp': 0, 'celebrate': 20, 'sleepy': -14, 'think': 6, 'thumbs': -6}[pose]
    s = []
    lk = 10 if pose == 'celebrate' else 0
    for sx, ex_, flip in ((110, 98 - lk, -1), (148, 160 + lk, 1)):
        d = f'M{sx} 200 Q{(sx + ex_) / 2} 222 {ex_} 236'
        s.append(f'<path d="{d}" fill="none" stroke="{out}" stroke-width="18" stroke-linecap="round"/>'
                 f'<path d="{d}" fill="none" stroke="{O}" stroke-width="10" stroke-linecap="round"/>')
        s.append(f'<ellipse cx="{ex_ + flip * 6}" cy="240" rx="16" ry="8" fill="{R}" stroke="{out}" stroke-width="4"/>')
    s.append(arm(t, ls, lh, bl, O))
    if pose not in ('think', 'stamp'):
        s.append(arm(t, rs, rh, br, O))
    s.append(f'<circle cx="{cx}" cy="{cy}" r="56" fill="{t["P"]}"/>')
    s.append(mark_group(t, 0.70 if small else 0.63, cx, cy, tilt, outline=out, ow=5.5 if small else 4.2))
    ey = cy - 6
    ink = t['INK']

    def brow(x1, y1, x2, y2):
        return f'<path d="M{x1} {y1} Q{(x1 + x2) / 2} {min(y1, y2) - 10} {x2} {y2}" fill="none" stroke="{ink}" stroke-width="5" stroke-linecap="round"/>'
    b = ''
    if pose in ('wave', 'thumbs', 'celebrate'):
        b = brow(88, ey - 24, 112, ey - 24) + brow(146, ey - 28, 170, ey - 24)
    if pose == 'think':
        b = brow(88, ey - 22, 112, ey - 22) + brow(146, ey - 32, 170, ey - 28)
    if small:
        # plain face: no brows, solid pupils, big smile; reads at 32 px
        kind, look, m = FACE[pose]
        def se(x):
            if kind in ('happy', 'closed') or (pose == 'thumbs' and x > 128):
                return eye(t, 'happy' if kind != 'closed' else 'closed', x, ey)
            return (f'<circle cx="{x}" cy="{ey}" r="15" fill="{t["W"]}" stroke="{ink}" stroke-width="4"/>'
                    f'<circle cx="{x + look[0] * 6}" cy="{ey + look[1] * 6}" r="8" fill="{ink}"/>')
        mm = {'grin': 'smile', 'smirk': 'smile'}.get(m, m)
        s.append(se(108) + se(148) + mouth(t, mm, 128, cy + 24, 15))
    else:
        s.append(draw_face(t, pose, (106, 150), ey, 128, cy + 22, googly=True, w=14))
        s.append(b)
    if pose == 'stamp':
        s.append(card(t, 80, 190, 104, 50, rot=-3, filled=3))
        sp = (164, 190)
        hp = (164, 152)
        s.append(arm(t, rs, hp, 12, O) + stamp(t, sp) + hand(t, hp, O, 10))
    elif pose == 'think':
        s.append(arm(t, rs, rh, br, O) + hand(t, rh, O) + bubble(t, 214, 36))
    else:
        s.append(thumb(t, rh, O) if pose == 'thumbs' else hand(t, rh, O))
    s.append(hand(t, lh, O))
    if pose == 'celebrate':
        s.append(confetti(t))
    if pose == 'sleepy':
        s.append(zzz(t, 192, 66))
    if pose == 'wave':
        s.append(waves(t))
    return svg(''.join(s), f'Whirl the loyalty mascot, {pose}')


# ---------- PIP: the mark itself with a quiet face and floating mitten hands ----------
def pip(t, pose):
    cx, cy = 128, 118
    rot = {'wave': 0, 'stamp': 0, 'celebrate': 45, 'sleepy': -20, 'think': 0, 'thumbs': 0}[pose]
    sc = 0.74
    s = [f'<circle cx="{cx}" cy="{cy}" r="{f(118 * sc - 20)}" fill="{t["P"]}"/>', mark_group(t, sc, cx, cy, rot),
         draw_face(t, pose, (cx - 19, cx + 19), cy - 8, cx, cy + 13, googly=False, w=11)]

    def mitten(p, r=12):
        return f'<circle cx="{p[0]}" cy="{p[1]}" r="{r}" fill="{t["A"]}" stroke="{t["OUT"]}" stroke-width="4"/>'
    if pose == 'wave':
        s.append(mitten((228, 62)) + f'<path d="M238 36 Q250 30 254 42 M224 22 Q240 10 254 24" fill="none" stroke="{t["OUT"]}" stroke-width="4" stroke-linecap="round"/>')
    elif pose == 'stamp':
        s.append(card(t, 66, 204, 112, 46, filled=3))
        s.append(stamp(t, (160, 206)) + mitten((160, 172)))
    elif pose == 'celebrate':
        s.append(mitten((234, 60)) + mitten((22, 60)) + confetti(t))
    elif pose == 'sleepy':
        s.append(zzz(t, 196, 66))
    elif pose == 'think':
        s.append(mitten((170, 178)) + bubble(t, 214, 36))
    elif pose == 'thumbs':
        x, y = 224, 130
        s.append(f'<rect x="{x - 9}" y="{y - 29}" width="17" height="24" rx="8.5" fill="{t["A"]}" stroke="{t["OUT"]}" stroke-width="4"/>' + mitten((x, y)) + f'<rect x="{x - 6}" y="{y - 22}" width="11" height="14" fill="{t["A"]}"/>')
    return svg(''.join(s), f'Pip the loyalty mascot, {pose}')


CHARS = {'dot': dot, 'whirl': whirl, 'pip': pip}
SMALL = lambda t, pose: whirl(t, pose, small=True)


def main():
    for sub, t in (('', LIGHT), ('dark', DARK)):
        d = ROOT / 'svg' / sub
        d.mkdir(parents=True, exist_ok=True)
        for name, fn in CHARS.items():
            for pose in POSES:
                (d / f'{name}-{pose}.svg').write_text(fn(t, pose), encoding='utf-8')
            (d / f'whirl-small-{pose}.svg').write_text(SMALL(t, pose), encoding='utf-8') if False else None
        for pose in POSES:
            (d / f'whirl-small-{pose}.svg').write_text(SMALL(t, pose), encoding='utf-8')
    print('wrote', len(list((ROOT / 'svg').rglob('*.svg'))), 'svgs')


if __name__ == '__main__':
    main()

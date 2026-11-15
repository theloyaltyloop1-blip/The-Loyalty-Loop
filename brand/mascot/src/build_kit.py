"""Layered Whirl art for the shared kit (packages/whirl).

Run: python brand/mascot/src/build_kit.py
Writes packages/whirl/art.generated.ts: for light and dark, every pose (the six originals plus oops, point, peek)
as named layers (legs, body, props, armL, armR) so a limb can really move, plus a plain `mini` set for 40 px and below
and the four loop-mark blades for the spinner. Uses the hand-written shapes in build.py (nothing is traced or generated).
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import build as B  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[3] / 'packages' / 'whirl' / 'art.generated.ts'
POSES = ['wave', 'stamp', 'celebrate', 'sleepy', 'think', 'thumbs', 'oops', 'point', 'peek']

B.HANDS.update({'oops': ((232, 124), (24, 124)), 'point': ((228, 120), (40, 186)), 'peek': ((214, 108), (84, 172))})
B.BEND.update({'oops': (-14, 14), 'point': (-6, -12), 'peek': (-18, 8)})
B.FACE.update({'oops': ('open', (1, 0), 'flat'), 'point': ('open', (1, 0), 'smile'), 'peek': ('open', (0, 0), 'grin')})
TILT = {'wave': -8, 'stamp': 0, 'celebrate': 20, 'sleepy': -14, 'think': 6, 'thumbs': -6, 'oops': 4, 'point': 6, 'peek': 0}
VIEWBOX = {p: [0, 0, 256, 256] for p in POSES}
VIEWBOX['peek'] = [0, 50, 256, 136]
SHOULDER = {'armR': [192, 148], 'armL': [64, 148]}


def g(items):
    return ''.join(items)


def sweat(t, x, y):
    return (f'<path d="M{x} {y} Q{x + 11} {y + 20} {x} {y + 28} Q{x - 11} {y + 20} {x} {y}Z" fill="{t["W"]}" '
            f'stroke="{t["OUT"]}" stroke-width="3.5" stroke-linejoin="round"/>')


def finger(t, p, col):
    return f'<rect x="{p[0] - 2}" y="{p[1] - 6}" width="24" height="12" rx="6" fill="{col}" stroke="{t["OUT"]}" stroke-width="4"/>'


def full_parts(t, pose, small):
    out, O, R = t['OUT'], t['O'], t['R']
    rh, lh = B.HANDS[pose]
    br, bl = B.BEND[pose]
    rs, ls = (192, 148), (64, 148)
    cx, cy = 128, 136
    ink = t['INK']
    ey = cy - 6
    legs = ''
    if pose != 'peek':
        lk = 10 if pose == 'celebrate' else 0
        parts = []
        for sx, ex_, flip in ((110, 98 - lk, -1), (148, 160 + lk, 1)):
            d = f'M{sx} 200 Q{(sx + ex_) / 2} 222 {ex_} 236'
            parts.append(f'<path d="{d}" fill="none" stroke="{out}" stroke-width="18" stroke-linecap="round"/>'
                         f'<path d="{d}" fill="none" stroke="{O}" stroke-width="10" stroke-linecap="round"/>'
                         f'<ellipse cx="{ex_ + flip * 6}" cy="240" rx="16" ry="8" fill="{R}" stroke="{out}" stroke-width="4"/>')
        legs = g(parts)
    body = [f'<circle cx="{cx}" cy="{cy}" r="56" fill="{t["P"]}"/>',
            B.mark_group(t, 0.70 if small else 0.63, cx, cy, TILT[pose], outline=out, ow=5.5 if small else 4.2)]

    def brow(x1, y1, x2, y2):
        return f'<path d="M{x1} {y1} Q{(x1 + x2) / 2} {min(y1, y2) - 10} {x2} {y2}" fill="none" stroke="{ink}" stroke-width="5" stroke-linecap="round"/>'
    b = ''
    if pose in ('wave', 'thumbs', 'celebrate', 'peek'):
        b = brow(88, ey - 24, 112, ey - 24) + brow(146, ey - 28, 170, ey - 24)
    if pose == 'think':
        b = brow(88, ey - 22, 112, ey - 22) + brow(146, ey - 32, 170, ey - 28)
    if pose == 'oops':
        b = brow(88, ey - 18, 112, ey - 30) + brow(146, ey - 30, 170, ey - 18)
    if small:
        kind, look, m = B.FACE[pose]

        def se(x):
            if kind in ('happy', 'closed') or (pose == 'thumbs' and x > 128):
                return B.eye(t, 'happy' if kind != 'closed' else 'closed', x, ey)
            return (f'<circle cx="{x}" cy="{ey}" r="15" fill="{t["W"]}" stroke="{ink}" stroke-width="4"/>'
                    f'<circle cx="{x + look[0] * 6}" cy="{ey + look[1] * 6}" r="8" fill="{ink}"/>')
        mm = {'grin': 'smile', 'smirk': 'smile'}.get(m, m)
        body.append(se(108) + se(148) + B.mouth(t, mm, 128, cy + 24, 15))
    else:
        body.append(B.draw_face(t, pose, (106, 150), ey, 128, cy + 22, googly=True, w=14))
        body.append(b)
    props = []
    armL = B.arm(t, ls, lh, bl, O) + B.hand(t, lh, O)
    if pose == 'stamp':
        props.append(B.card(t, 80, 190, 104, 50, rot=-3, filled=3))
        hp = (164, 152)
        armR = B.arm(t, rs, hp, 12, O) + B.stamp(t, (164, 190)) + B.hand(t, hp, O, 10)
    elif pose == 'think':
        armR = B.arm(t, rs, rh, br, O) + B.hand(t, rh, O)
        props.append(B.bubble(t, 214, 36))
    elif pose == 'thumbs':
        armR = B.arm(t, rs, rh, br, O) + B.thumb(t, rh, O)
    elif pose == 'point':
        armR = B.arm(t, rs, rh, br, O) + finger(t, rh, O) + B.hand(t, rh, O)
    else:
        armR = B.arm(t, rs, rh, br, O) + B.hand(t, rh, O)
        if pose == 'wave':
            armR += B.waves(t)
    if pose == 'celebrate':
        props.append(B.confetti(t))
    if pose == 'sleepy':
        props.append(B.zzz(t, 192, 66))
    if pose == 'oops':
        props.append(sweat(t, 180, 62))
    return legs, g(body), g(props), armL, armR


def mini_parts(t, pose):
    out, ink = t['OUT'], t['INK']
    cx, cy = 128, 132
    body = [f'<circle cx="{cx}" cy="{cy}" r="72" fill="{t["P"]}"/>',
            B.mark_group(t, 0.95, cx, cy, TILT[pose] // 2, outline=out, ow=7)]
    kind, look, m = B.FACE[pose]
    ey = cy - 8

    def se(x):
        if kind in ('happy', 'closed') or (pose == 'thumbs' and x > 128):
            return B.eye(t, 'happy' if kind != 'closed' else 'closed', x, ey)
        return (f'<circle cx="{x}" cy="{ey}" r="17" fill="{t["W"]}" stroke="{ink}" stroke-width="5"/>'
                f'<circle cx="{x + look[0] * 6}" cy="{ey + look[1] * 6}" r="9" fill="{ink}"/>')
    mm = {'grin': 'smile', 'smirk': 'smile'}.get(m, m)
    body.append(se(104) + se(152) + B.mouth(t, mm, 128, cy + 26, 17))
    props, armR = [], ''
    if pose == 'celebrate':
        props.append(''.join(f'<circle cx="{x}" cy="{y}" r="7" fill="{t[c]}"/>' for x, y, c in ((40, 40, 'A'), (216, 36, 'O'), (128, 14, 'R'))))
    elif pose == 'sleepy':
        props.append(B.zzz(t, 206, 70))
    elif pose == 'oops':
        props.append(sweat(t, 206, 40))
    elif pose == 'think':
        props.append(f'<path d="M206 34 Q206 18 220 18 Q234 18 234 30 Q234 40 220 46 V52" fill="none" stroke="{t["R"]}" stroke-width="9" stroke-linecap="round"/>'
                     f'<circle cx="220" cy="68" r="5.5" fill="{t["R"]}"/>')
    elif pose == 'wave':
        armR = B.hand(t, (232, 84), t['O'], 15) + B.waves(t)
    elif pose == 'point':
        armR = finger(t, (214, 140), t['O']) + B.hand(t, (214, 140), t['O'], 14)
    elif pose == 'thumbs':
        armR = B.thumb(t, (226, 136), t['O'])
    return '', g(body), g(props), '', armR


def pack(parts, vb):
    legs, body, props, armL, armR = parts
    layers = []
    for lid, s in (('legs', legs), ('body', body), ('props', props), ('armL', armL), ('armR', armR)):
        if s:
            layers.append({'id': lid, 'svg': s, **({'pivot': SHOULDER[lid]} if lid in SHOULDER else {})})
    return {'vb': vb, 'layers': layers}


def main():
    art = {}
    for variant, t in (('light', B.LIGHT), ('dark', B.DARK)):
        art[variant] = {
            'full': {p: pack(full_parts(t, p, False), VIEWBOX[p]) for p in POSES},
            'mini': {p: pack(mini_parts(t, p), [0, 0, 256, 256]) for p in POSES},
            'blades': [{'fill': c, 'd': d} for (_, d), c in zip(B.PATHS, [t['O'], t['A'], t['R'], t['O']])],
        }
    ts = ('// Generated by brand/mascot/src/build_kit.py. Do not edit by hand.\n'
          'export type WhirlPose = ' + ' | '.join(json.dumps(p) for p in POSES) + '\n'
          'export type WhirlLayerId = "legs" | "body" | "props" | "armL" | "armR"\n'
          'export interface WhirlLayer { id: WhirlLayerId; svg: string; pivot?: [number, number] }\n'
          'export interface WhirlPoseArt { vb: [number, number, number, number]; layers: WhirlLayer[] }\n'
          'export interface WhirlArtSet { full: Record<WhirlPose, WhirlPoseArt>; mini: Record<WhirlPose, WhirlPoseArt>; blades: { fill: string; d: string }[] }\n'
          'export const WHIRL_POSES: WhirlPose[] = ' + json.dumps(POSES) + '\n'
          'export const WHIRL_ART: { light: WhirlArtSet; dark: WhirlArtSet } = ' + json.dumps(art, separators=(',', ':')) + ' as unknown as { light: WhirlArtSet; dark: WhirlArtSet }\n')
    OUT.write_text(ts, encoding='utf-8')
    prev = pathlib.Path(__file__).resolve().parents[1] / 'svg' / 'kit'
    for variant in ('light', 'dark'):
        d = prev / variant
        d.mkdir(parents=True, exist_ok=True)
        for kind in ('full', 'mini'):
            for p in POSES:
                a = art[variant][kind][p]
                vb = ' '.join(map(str, a['vb']))
                (d / f'whirl-{kind}-{p}.svg').write_text(
                    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">' + ''.join(l['svg'] for l in a['layers']) + '</svg>',
                    encoding='utf-8')
    print('wrote', OUT, OUT.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()

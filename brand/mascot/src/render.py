"""Rasterise the mascot SVGs with headless Chrome and build the contact sheet.
Run from repo root after build.py:  python brand/mascot/src/render.py
Outputs: brand/mascot/png/<name>-<pose>.png (512, transparent), png/dark/..., concepts.png, sizes.png
"""
import pathlib
import subprocess
import tempfile

CH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
B = pathlib.Path(__file__).resolve().parents[1]
NAMES = [('dot', 'Dot', 'A round, cheerful blob who is always pleased you came. Soft, bouncy, a little daft.', 'The friendly one'),
         ('whirl', 'Whirl', 'A cheeky loop with big googly eyes, arms and legs. Teases you kindly, cheers louder than anyone.', 'The cheeky one'),
         ('pip', 'Pip', 'The logo itself with a quiet face and floating mitten hands. Calm, dry, never shouts.', 'The calm one')]
POSES = ['wave', 'stamp', 'celebrate', 'sleepy', 'think', 'thumbs']
POSE_LABEL = {'wave': 'Wave', 'stamp': 'Stamping a card', 'celebrate': 'Reward!', 'sleepy': 'Empty screen', 'think': 'Thinking', 'thumbs': 'Thumbs-up'}


def shot(html, w, h, out, transparent=False):
    f = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8')
    f.write(html)
    f.close()
    args = [CH, '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files']
    if transparent:
        args.append('--default-background-color=00000000')
    subprocess.run(args + [f'--screenshot={out}', f'--window-size={w},{h}', pathlib.Path(f.name).as_uri()], check=True, capture_output=True)


def uri(name, pose, dark):
    return (B / 'svg' / ('dark' if dark else '') / f'{name}-{pose}.svg').as_uri()


def main():
    for dark in (False, True):
        d = B / 'png' / ('dark' if dark else '')
        d.mkdir(parents=True, exist_ok=True)
        for name in [n[0] for n in NAMES] + ['whirl-small']:
            for pose in POSES:
                html = f'<body style="margin:0;background:transparent"><img src="{uri(name, pose, dark)}" width="512" height="512" style="display:block"></body>'
                shot(html, 512, 512, str(d / f'{name}-{pose}.png'), transparent=True)

    # contact sheet: per concept a light row on paper and a dark row on near-black
    rows = []
    for name, title, blurb, tag in NAMES:
        light = ''.join(f'<div class="c"><img src="{uri(name, p, False)}"><span>{POSE_LABEL[p]}</span></div>' for p in POSES)
        dark = ''.join(f'<div class="c"><img src="{uri(name, p, True)}"></div>' for p in POSES)
        sm = ''.join(f'<img src="{uri(name, "wave", False)}" width="{s}" height="{s}">' for s in (96, 64, 48, 32))
        smd = ''.join(f'<img src="{uri(name, "wave", True)}" width="{s}" height="{s}">' for s in (96, 64, 48, 32))
        rows.append(f'''<section><div class="lab"><h2>{title}</h2><b>{tag}</b><p>{blurb}</p></div>
          <div class="grid"><div class="row light">{light}</div><div class="row dark">{dark}</div></div>
          <div class="sz"><div class="light">{sm}</div><div class="dark">{smd}</div></div></section>''')
    html = f'''<meta charset="utf-8"><style>
    body{{margin:0;background:#F8E4C6;font-family:"Segoe UI",Arial,sans-serif;color:#2B1A10;width:1920px}}
    header{{padding:28px 40px 6px}} h1{{margin:0;font-size:34px}} header p{{margin:4px 0 0;font-size:16px;color:#5a4330}}
    section{{display:flex;align-items:stretch;gap:18px;padding:10px 40px;}}
    .lab{{width:230px;padding-top:30px}} .lab h2{{margin:0;font-size:32px}} .lab b{{color:#AA521E;font-size:15px}} .lab p{{font-size:14px;line-height:1.4}}
    .grid{{flex:1}} .row{{display:flex;border-radius:18px;padding:6px 10px}} .row.light{{background:#F8E4C6;border:2px solid #E2C99C}}
    .row.dark{{background:#121714;margin-top:8px}} .c{{flex:1;text-align:center}} .c img{{width:210px;height:210px;display:block;margin:0 auto}}
    .c span{{font-size:14px;font-weight:600;display:block;margin-top:-6px;padding-bottom:6px}}
    .sz{{width:300px;display:flex;flex-direction:column;gap:8px;padding-top:6px}} .sz div{{display:flex;align-items:flex-end;gap:12px;border-radius:14px;padding:10px 14px;height:100px;box-sizing:border-box}}
    .sz .light{{background:#F8E4C6;border:2px solid #E2C99C}} .sz .dark{{background:#121714;}}
    footer{{padding:6px 40px 24px;font-size:13px;color:#5a4330}}
    </style><header><h1>The Loyalty Loop mascot concepts</h1><p>Three characters, six poses each (wave, stamping a card, reward, empty screen, thinking, thumbs-up), shown on paper and on near-black, with 96/64/48/32 px checks on the right.</p></header>
    {''.join(rows)}<footer>Concept art only, hand-written vector (brand/mascot/svg). Not wired into any app.</footer>'''
    shot(html, 1920, 1700, str(B / 'concepts.png'))

    # 48px / 32px legibility check for all six poses of all three concepts
    cells = []
    for name, title in [(n[0], n[1]) for n in NAMES] + [('whirl-small', 'Whirl small')]:
        for dark in (False, True):
            bg = '#121714' if dark else '#F8E4C6'
            imgs = ''.join(f'<img src="{uri(name, p, dark)}" width="48" height="48">' for p in POSES) + ''.join(f'<img src="{uri(name, p, dark)}" width="32" height="32">' for p in POSES)
            cells.append(f'<div style="background:{bg};padding:10px;display:flex;gap:8px;align-items:center;margin-bottom:6px">{imgs}</div>')
    shot(f'<body style="margin:0;padding:10px;background:#888;width:640px">{"".join(cells)}</body>', 660, 640, str(B / 'sizes.png'))


if __name__ == '__main__':
    main()

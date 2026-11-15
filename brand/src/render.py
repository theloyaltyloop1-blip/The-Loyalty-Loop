"""Rasterise brand SVGs to PNG with headless Chrome (transparent background).
Run from repo root: python brand/src/render.py"""
import subprocess, os, tempfile, pathlib
CH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
B = pathlib.Path(__file__).resolve().parent.parent
def shot(html, w, h, out):
    f = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8'); f.write(html); f.close()
    subprocess.run([CH, '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        '--default-background-color=00000000', f'--screenshot={out}', f'--window-size={w},{h}', pathlib.Path(f.name).as_uri()],
        check=True, capture_output=True)
def img(svg, w, h, bg='transparent', pad=0, extra=''):
    u = (B/svg).as_uri()
    return (f'<body style="margin:0;background:{bg};width:{w}px;height:{h}px;display:flex;align-items:center;justify-content:center">'
            f'<img src="{u}" style="max-width:{w-2*pad}px;max-height:{h-2*pad}px;{extra}"></body>')
P = lambda n: str(B/'png'/n)
shot(img('app-icon/app-icon-paper.svg', 1024, 1024, extra='width:1024px;height:1024px'), 1024, 1024, P('app-icon-1024.png'))
shot(img('app-icon/app-icon-dark.svg', 1024, 1024, extra='width:1024px;height:1024px'), 1024, 1024, P('app-icon-dark-1024.png'))
shot(img('app-icon/android-foreground.svg', 1024, 1024, extra='width:1024px;height:1024px'), 1024, 1024, P('android-icon-foreground.png'))
shot(img('app-icon/android-monochrome.svg', 1024, 1024, extra='width:1024px;height:1024px'), 1024, 1024, P('android-icon-monochrome.png'))
# splash: transparent mark filling the canvas (Expo scales via imageWidth)
shot(img('loyalty-loop-mark-colour.svg', 1024, 1024, extra='width:1024px;height:1024px'), 1024, 1024, P('splash-icon.png'))
shot(img('loyalty-loop-mark-colour.svg', 512, 512, extra='width:512px;height:512px'), 512, 512, P('mark-512.png'))
# favicons / touch icon (paper tile so it is not transparent on dark launchers)
for s in (16, 32, 48, 64):
    shot(img('app-icon/favicon.svg', s, s, extra=f'width:{s}px;height:{s}px'), s, s, P(f'favicon-{s}.png'))
shot(img('loyalty-loop-mark-colour.svg', 180, 180, bg='#F8E4C6', extra='width:132px;height:132px'), 180, 180, P('apple-touch-icon-180.png'))
shot(img('loyalty-loop-mark-colour.svg', 1024, 1024, bg='#F8E4C6', extra='width:640px;height:640px'), 1024, 1024, P('wallet-logo-1024.png'))
# in-app square mark on paper (shopper header / onboarding)
shot(img('loyalty-loop-mark-colour.svg', 512, 512, extra='width:512px;height:512px'), 512, 512, P('in-app-mark-512.png'))
# open graph
shot(img('loyalty-loop-primary-colour.svg', 1200, 630, bg='#F8E4C6', extra='height:470px'), 1200, 630, P('og-image-1200x630.png'))
shot(img('loyalty-loop-primary-colour.svg', 1200, 840, extra='width:1100px'), 1200, 840, P('primary-colour-1200.png'))
print('ok')

"""Export the reviewed website palette as CSS, JSON and a visual reference.

Local deterministic export; does not claim UI Color Palette MCP output.
"""
import colorsys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
SCALES = {
    'orange': ['#FFF5EF', '#FCE6D8', '#F8D2B7', '#F2B18B', '#EC905F', '#E8703B', '#CE5A25', '#B9471D', '#923819', '#702D18', '#3B190F'],
    'olive': ['#F3F6F0', '#E9EFDF', '#DEE8D6', '#C1D1B4', '#9DB68E', '#7A966B', '#5D7850', '#48643F', '#354D3D', '#24331F', '#142219'],
    'neutral': ['#FFFDF9', '#F5F4EE', '#E7E8E0', '#D2D6CC', '#A7AEA2', '#788275', '#566250', '#424D3D', '#303C2D', '#1C2620', '#121A15'],
    'blue': ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#172554'],
    'slate': ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155', '#1E293B', '#172033', '#0F172A'],
    'green': ['#F0FDF4', '#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D', '#052E16'],
    'amber': ['#FFFBEB', '#FEF3C7', '#FDE68A', '#FCD34D', '#F2B544', '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F', '#451A03'],
    'red': ['#FFF1F2', '#FFE4E6', '#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E', '#E11D48', '#BE123C', '#9F1239', '#881337', '#4C0519'],
}

def ref(family, stop):
    return f'{family}-{stop}'

light = {
    'background': ref('neutral', 100), 'foreground': ref('neutral', 900),
    'card': ref('neutral', 50), 'card-foreground': ref('neutral', 900),
    'primary': ref('orange', 700), 'primary-foreground': ref('neutral', 50),
    'primary-hover': ref('orange', 800), 'primary-glow': ref('orange', 500),
    'secondary': ref('neutral', 200), 'secondary-foreground': ref('neutral', 900),
    'accent': ref('orange', 500), 'accent-foreground': ref('orange', 950),
    'ink': ref('neutral', 900), 'fun-green': ref('green', 800), 'fun-violet': ref('olive', 700),
    'destructive': ref('red', 700), 'destructive-foreground': ref('neutral', 50),
    'destructive-subtle': ref('red', 50), 'destructive-border': ref('red', 700),
    'border': ref('neutral', 300), 'input': ref('neutral', 500), 'ring': ref('orange', 700),
    'muted': ref('neutral', 200), 'muted-foreground': ref('neutral', 600),
    'popover': ref('neutral', 50), 'popover-foreground': ref('neutral', 900),
    'olive': ref('olive', 800), 'olive-ink': ref('olive', 50),
    'sage': ref('olive', 200), 'sage-ink': ref('olive', 900),
    'peach': ref('orange', 100), 'peach-ink': ref('orange', 900),
    'amber': ref('amber', 400), 'amber-ink': ref('amber', 950),
    'orange': ref('orange', 500), 'orange-ink': ref('orange', 950),
    'success': ref('green', 800), 'success-subtle': ref('green', 50), 'success-foreground': ref('neutral', 50), 'success-border': ref('green', 700),
    'warning': ref('amber', 800), 'warning-subtle': ref('amber', 50), 'warning-foreground': ref('neutral', 50), 'warning-border': ref('amber', 700),
    'info': ref('blue', 700), 'info-subtle': ref('blue', 50), 'info-foreground': ref('neutral', 50), 'info-border': ref('blue', 600),
    'chart-1': ref('blue', 600), 'chart-2': '#0E7490', 'chart-3': '#7C3AED', 'chart-4': ref('amber', 700), 'chart-5': ref('green', 700),
}
dark = dict(light, **{
    'background': ref('neutral', 950), 'foreground': ref('neutral', 100),
    'card': ref('neutral', 900), 'card-foreground': ref('neutral', 100),
    'primary': ref('orange', 300), 'primary-foreground': ref('orange', 950), 'primary-hover': ref('orange', 200),
    'secondary': ref('neutral', 800), 'secondary-foreground': ref('neutral', 100),
    'accent': ref('orange', 300), 'accent-foreground': ref('orange', 950), 'ink': ref('neutral', 100),
    'border': ref('neutral', 700), 'input': ref('neutral', 500), 'ring': ref('orange', 300),
    'muted': ref('neutral', 800), 'muted-foreground': ref('neutral', 400),
    'popover': ref('neutral', 900), 'popover-foreground': ref('neutral', 100),
    'olive': ref('olive', 900), 'olive-ink': ref('olive', 50), 'sage': ref('olive', 950), 'sage-ink': ref('olive', 200),
    'peach': ref('orange', 950), 'peach-ink': ref('orange', 200),
    'destructive': ref('red', 300), 'destructive-foreground': ref('red', 950), 'destructive-subtle': ref('red', 950), 'destructive-border': ref('red', 400),
    'success': ref('green', 300), 'success-foreground': ref('green', 950), 'success-subtle': ref('green', 950), 'success-border': ref('green', 400),
    'warning': ref('amber', 300), 'warning-foreground': ref('amber', 950), 'warning-subtle': ref('amber', 950), 'warning-border': ref('amber', 400),
    'info': ref('blue', 300), 'info-foreground': ref('blue', 950), 'info-subtle': ref('blue', 950), 'info-border': ref('blue', 400),
    'fun-green': ref('green', 300), 'fun-violet': ref('olive', 300),
    'chart-1': ref('blue', 400), 'chart-2': '#67E8F9', 'chart-3': '#C4B5FD', 'chart-4': ref('amber', 300), 'chart-5': ref('green', 300),
})
admin = dict(light, **{
    'background': ref('slate', 50), 'foreground': ref('slate', 900), 'card': '#FFFFFF', 'card-foreground': ref('slate', 900),
    'primary': ref('blue', 600), 'primary-hover': ref('blue', 700), 'primary-foreground': '#FFFFFF', 'ring': ref('blue', 600),
    'border': ref('slate', 200), 'input': ref('slate', 500), 'muted-foreground': ref('slate', 600), 'secondary': ref('slate', 100),
    'secondary-foreground': ref('slate', 900), 'muted': ref('slate', 100), 'popover': '#FFFFFF', 'popover-foreground': ref('slate', 900),
    'olive': ref('blue', 600), 'olive-ink': '#FFFFFF', 'sage': ref('blue', 50), 'sage-ink': ref('blue', 800), 'peach': ref('blue', 50), 'peach-ink': ref('blue', 800),
})
primitives = {f'{family}-{stop}': value for family, values in SCALES.items() for stop, value in zip(STOPS, values)}
def css_value(value):
    return value if value.startswith('#') else f'var(--palette-{value})'
def resolved(roles):
    return {key: primitives.get(value, value) for key, value in roles.items()}
css = '/* Generated by scripts/build-website-palette.py. Edit the generator, then rebuild. */\n:root {\n'
css += ''.join(f'  --palette-{key}: {value};\n' for key, value in primitives.items()) + '}\n\n'
for selector, roles in [('@theme', light), ('html.dark', dark), ('.admin-panel', admin)]:
    css += selector + ' {\n' + ''.join(f'  --color-{key}: {css_value(value)};\n' for key, value in roles.items()) + '}\n\n'
(ROOT / 'apps/web/src/color-system.css').write_text(css.rstrip() + '\n', encoding='utf-8')
doc_dir = ROOT / 'docs/design'
doc_dir.mkdir(parents=True, exist_ok=True)
formats = {}
for key, value in primitives.items():
    rgb = tuple(int(value[i:i+2], 16) for i in (1, 3, 5))
    hue, lightness, saturation = colorsys.rgb_to_hls(*(channel / 255 for channel in rgb))
    formats[key] = {'hex': value, 'rgb': f'rgb{rgb}', 'hsl': f'hsl({hue*360:.1f} {saturation*100:.1f}% {lightness*100:.1f}%)'}
(doc_dir / 'website-palette.json').write_text(json.dumps({'primitives': formats, 'themes': {name: resolved(roles) for name, roles in [('light', light), ('dark', dark), ('admin', admin)]}}, indent=2) + '\n', encoding='utf-8')
html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>The Loyalty Loop colour system</title><style>body{font:16px system-ui;margin:32px;background:#f5f4ee;color:#1c2620}section{padding:24px;border-radius:16px;margin:24px 0}.swatches{display:flex;flex-wrap:wrap;gap:8px}.swatch{padding:14px;border-radius:8px;min-width:96px}button{padding:12px 18px;border:0;border-radius:24px;font:inherit}code{display:block;font-size:12px;margin-top:8px}</style><h1>The Loyalty Loop colour system</h1><p>Local palette export. Orange/olive consumer brand; blue admin workspace. Use semantic roles in components.</p>'
for name, roles in [('Light', light), ('Dark', dark), ('Admin', admin)]:
    r = resolved(roles)
    html += f'<section style="background:{r["background"]};color:{r["foreground"]}"><h2>{name}</h2><p style="color:{r["muted-foreground"]}">Secondary text and readable status colours</p><button style="background:{r["primary"]};color:{r["primary-foreground"]}">Primary action</button><div class="swatches">'
    for key in ['olive','sage','peach','amber','orange','success','warning','info','destructive']:
        background = r.get(key + '-subtle', r[key])
        ink = r.get(key + '-ink', r[key])
        html += f'<p class="swatch" style="background:{background};color:{ink}">{key}<code>{background} / {ink}</code></p>'
    html += '</div></section>'
for family, values in SCALES.items():
    html += f'<h2>{family}</h2><div class="swatches">'
    for stop, value in zip(STOPS, values):
        # Swatch metadata is below each colour so all labels remain readable.
        html += f'<div><div style="background:{value};width:96px;height:64px;border-radius:8px"></div><code>{stop}: {value}</code></div>'
    html += '</div>'
(doc_dir / 'website-palette.html').write_text(html + '</html>', encoding='utf-8')
print('Exported 88 primitive shades and three semantic themes.')

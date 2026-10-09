"""WCAG 2.1 contrast audit of exported, supported semantic pairings.

This checks palette contracts, not every rendered element or APCA compliance.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
themes = json.loads((root / 'docs/design/website-palette.json').read_text())['themes']
def luminance(color):
    channels = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
    return sum(c * weight for c, weight in zip(linear, [.2126, .7152, .0722]))
def contrast(first, second):
    low, high = sorted([luminance(first), luminance(second)])
    return (high + .05) / (low + .05)
pairs = []
for surface in ['background','card','secondary','popover']:
    pairs.extend([('foreground', surface, 4.5), ('muted-foreground', surface, 4.5)])
for role in ['primary','accent','destructive','success','warning','info']:
    pairs.append((role + '-foreground', role, 4.5))
for role in ['primary','destructive','success','warning','info']:
    pairs.extend([(role, 'background', 4.5), (role, 'card', 4.5)])
pairs.append(('primary-foreground','primary-hover',4.5))
for role in ['olive','sage','peach','amber','orange']:
    pairs.append((role + '-ink', role, 4.5))
for role in ['destructive','success','warning','info']:
    pairs.append((role, role + '-subtle', 4.5))
for role in ['ring','input']:
    pairs.extend([(role, 'card', 3), (role, 'background', 3)])
for index in range(1, 6):
    pairs.append((f'chart-{index}', 'card', 3))
rows, failures = [], []
for name, colors in themes.items():
    for text, background, minimum in pairs:
        ratio = contrast(colors[text], colors[background])
        passed = ratio >= minimum
        rows.append({'theme': name, 'foreground': text, 'background': background, 'ratio': round(ratio, 2), 'minimum': minimum, 'pass': passed})
        if not passed:
            failures.append(f'{name}: {text} / {background} = {ratio:.2f}, needs {minimum}')
(root / 'docs/design/website-palette-contrast.json').write_text(json.dumps(rows, indent=2) + '\n')
print(f'{len(rows) - len(failures)}/{len(rows)} supported pairings pass WCAG AA.')
print('\n'.join(failures))
raise SystemExit(bool(failures))

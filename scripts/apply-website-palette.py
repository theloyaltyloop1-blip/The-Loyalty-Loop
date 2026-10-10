"""One-time migration to semantic website colours. Run only on the old palette."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / 'apps/web/src'
path = src / 'index.css'
css = path.read_text(encoding='utf-8')
css = css.replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@import "./color-system.css";')
css = re.sub(r'^  --color-[^\n]+\n', '', css, flags=re.M)
css = css.replace('background-color: #1A201C;', 'background-color: var(--color-card);').replace('border-color: #2E3630;', 'border-color: var(--color-input);')
css = css.replace('color: rgb(244 246 240 / 0.46)', 'color: var(--color-muted-foreground)')
css = css.replace('background-color: #1A201C; color:', 'background-color: var(--color-card); color:')
css = css.replace('background: #F2B48F;', 'background: var(--color-peach);').replace('color: #1C2620;', 'color: var(--color-foreground);')
css = css.replace('color: white;\n    padding:', 'color: var(--color-background);\n    padding:')
css = css.replace('input, textarea, select {\n    font-size: 16px;', 'input, textarea, select {\n    font-size: 16px;')
css = css.replace('  p { text-wrap: pretty; }', '  p { text-wrap: pretty; }\n\n  input::placeholder, textarea::placeholder { color: var(--color-muted-foreground); opacity: 1; }')
path.write_text(css, encoding='utf-8')

path = src / 'pages/landing.css'
css = path.read_text(encoding='utf-8')
for key in ['olive', 'olive-ink', 'sage', 'peach', 'amber', 'orange']:
    css = re.sub(rf'--lp-{key}: #[0-9A-Fa-f]+;', f'--lp-{key}: var(--color-{key});', css)
css = re.sub(r'html.dark \.lp \{[^}]+\}', '', css)
for old, new in {'#F3F1EA': 'var(--color-olive-ink)', '#2A2410': 'var(--color-amber-ink)', '#2A1408': 'var(--color-orange-ink)', '#1C2620': 'var(--color-foreground)', '#F3F4EF': 'var(--color-background)'}.items():
    css = css.replace(old, new)
path.write_text(css, encoding='utf-8')

# Move admin CSS literals onto the same primitives/roles, retaining its light identity.
path = src / 'pages/admin-panel.css'
css = path.read_text(encoding='utf-8')
css = re.sub(r'\.admin-panel \{[^}]+\}', '.admin-panel { color:var(--color-foreground); background:var(--color-background); font-family:var(--font-body); color-scheme:light; }', css, count=1)
admin_hex = {'#f5f7fb':'background','#172033':'foreground','#fff':'card','#ffffff':'card','#526176':'muted-foreground','#64748b':'muted-foreground','#94a3b8':'muted-foreground','#2563eb':'primary','#1d4ed8':'primary-hover','#e2e8f0':'border','#eef2f7':'secondary','#f1f5f9':'secondary','#f8fafc':'background','#dbeafe':'info-subtle','#eff6ff':'info-subtle','#1e40af':'info','#fff1f2':'destructive-subtle','#9f1239':'destructive','#fecdd3':'destructive-border','#be123c':'destructive','#047857':'success'}
css = re.sub(r'#[0-9a-fA-F]{3,8}\b', lambda m: f'var(--color-{admin_hex[m[0].lower()]})' if m[0].lower() in admin_hex else m[0], css)
# White foregrounds belong to the filled role, rather than the card surface.
css = css.replace('color:var(--color-card)', 'color:var(--color-primary-foreground)')
path.write_text(css, encoding='utf-8')

brand_hex = {'#3E5235':'olive','#F1F4EC':'olive-ink','#DCE6D2':'sage','#24331F':'sage-ink','#F8DCCB':'peach','#6E2C0F':'peach-ink','#C4531F':'primary'}
changed = []
for path in src.rglob('*.tsx'):
    before = text = path.read_text(encoding='utf-8')
    for value, role in brand_hex.items():
        text = re.sub(rf'(bg|text|border)-\[{value}\]', lambda m: f'{m[1]}-{role}', text, flags=re.I)
    # Status utilities now follow semantic colours in every theme.
    def semantic(m):
        prop, family, shade = m.groups()
        role = {'emerald':'success','green':'success','blue':'info','red':'destructive','rose':'destructive','amber':'warning','yellow':'warning'}[family]
        if prop == 'text': return f'text-{role}'
        if prop in ('border', 'ring'): return f'{prop}-{role}-border'
        return f'bg-{role}-subtle' if int(shade) <= 200 else f'bg-{role}'
    text = re.sub(r'\b(bg|text|border|ring)-(emerald|green|blue|red|rose|amber|yellow)-(\d+)\b', semantic, text)
    # Admin neutral tools inherit the scoped theme rather than Tailwind defaults.
    def neutral(m):
        prop, shade = m.groups()
        if prop == 'text': return 'text-muted-foreground' if int(shade) <= 600 else 'text-foreground'
        if prop in ('border','ring'): return f'{prop}-border'
        return 'bg-secondary' if int(shade) == 100 else 'bg-background'
    text = re.sub(r'\b(bg|text|border|ring)-slate-(\d+)\b', neutral, text)
    if path.name in ('AccessTools.tsx', 'AccessPanel.tsx', 'TrendingAdmin.tsx', 'ShopRequests.tsx', 'kit.tsx') or path.parent.name == 'admin':
        text = text.replace('bg-white', 'bg-card')
    # Correct filled controls, including dark mode, without changing photo overlays.
    def filled(m):
        segment = m[0]
        for role in ['primary','destructive','success','info','fun-green']:
            if re.search(rf'\bbg-{role}(?![\w/-])', segment):
                foreground = 'success-foreground' if role == 'fun-green' else f'{role}-foreground'
                segment = re.sub(r'\btext-white\b', f'text-{foreground}', segment)
        return segment
    text = re.sub(r'''(?:"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)''', filled, text)
    if path.name == 'home-collection.tsx':
        for value, role in brand_hex.items():
            text = text.replace(f"'{value}'", f"'var(--color-{role})'")
        text = text.replace("`${ink}35`", "`color-mix(in srgb, ${ink} 20%, transparent)`")
        text = text.replace("'#617257'", "'color-mix(in srgb, var(--color-olive-ink) 25%, var(--color-olive))'")
        text = text.replace("'#FFFFFF'", "'var(--color-primary-foreground)'")
    if path.name == 'Settings.tsx' and path.parent.name == 'owner':
        text = text.replace("color: '#1a1a1a', bg: '#00000010'", "color: 'var(--color-muted-foreground)', bg: 'var(--color-muted)'")
        for old, new in {"color: '#B8860B', bg: '#FFF3D6'":"color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)'", "color: '#3FA34D', bg: '#DFF3E3'":"color: 'var(--color-success)', bg: 'var(--color-success-subtle)'", "color: '#C0392B', bg: '#FBE4E1'":"color: 'var(--color-destructive)', bg: 'var(--color-destructive-subtle)'"}.items():
            text = text.replace(old,new)
        text = text.replace("? '#1a1a1a' : 'transparent'", "? 'var(--color-foreground)' : 'transparent'")
    if path.name == 'Onboarding.tsx':
        text = text.replace("? '#1a1a1a' : 'transparent'", "? 'var(--color-foreground)' : 'transparent'")
    if path.name == 'admin-dashboard.tsx':
        text = text.replace("['#2563eb', '#0891b2', '#7c3aed', '#d97706', '#059669']", "['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)']")
    if path.name == 'button.tsx':
        text = text.replace('var(--secondary),var(--foreground)', 'var(--color-secondary),var(--color-foreground)')
    if text != before:
        path.write_text(text, encoding='utf-8')
        changed.append(str(path.relative_to(ROOT)))
print('\n'.join(changed))

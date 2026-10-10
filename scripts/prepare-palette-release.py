from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
release = root / '.codex-admin-release'
paths = ['apps/web/src/index.css', 'apps/web/src/color-system.css', 'apps/web/src/pages/landing.css',
         'apps/web/src/pages/admin-panel.css', 'apps/web/src/components/admin-dashboard.tsx',
         'apps/web/src/components/home-collection.tsx', 'apps/web/src/components/ui/button.tsx',
         'apps/web/src/components/ui/sonner.tsx', 'apps/web/src/pages/Home.tsx',
         'apps/web/src/pages/AccessPanel.tsx', 'apps/web/src/pages/AccessTools.tsx',
         'apps/web/src/pages/owner/Onboarding.tsx', 'apps/web/src/pages/owner/Settings.tsx',
         'scripts/build-website-palette.py', 'scripts/audit-website-palette.py',
         'scripts/check-website-palette.cjs', 'scripts/palette-handoff.py']
paths.extend(str(p.relative_to(root)) for p in (root / 'apps/web/src/pages/admin').glob('*.tsx'))
paths.extend(str(p.relative_to(root)) for p in (root / 'docs/design').glob('website-palette*') if p.is_file())
paths.append('docs/design/WEBSITE_COLOR_SYSTEM.md')
for name in paths:
    target = release / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / name, target)
# Retain remote documentation history and append only this palette run's records.
source = (root / 'CLAUDE_HANDOFF.md').read_text(encoding='utf-8')
entries = source[source.index('## Palette sources inspected and skills installed'):].split('## Copy-ready prompt for Claude Code')[0].rstrip()
handoff = release / 'CLAUDE_HANDOFF.md'
original = subprocess.check_output(['git', '-C', str(release), 'show', 'origin/main:CLAUDE_HANDOFF.md'], encoding='utf-8').split('## Copy-ready prompt for Claude Code')[0].rstrip()
prompt = source.split('## Copy-ready prompt for Claude Code')[-1].strip()
handoff.write_text(original + '\n\n' + entries + '\n\n## Copy-ready prompt for Claude Code\n\n' + prompt + '\n', encoding='utf-8')
timeline = release / 'IMPLEMENTATION_TIMELINE.md'
original_timeline = subprocess.check_output(['git', '-C', str(release), 'show', 'origin/main:IMPLEMENTATION_TIMELINE.md'], encoding='utf-8')
timeline.write_text(original_timeline.rstrip() + '\n\n## Website semantic palette — 9 October 2026\n\nOwner authorized palette deployment followed by a screenshot-led admin redesign. Bounded website palette passes production build, 129 contrast pairs and 16 local responsive/theme browser checks on main 9b888fd; local standalone palette skills installed, full plugin registration blocked. No backend/native scope. See docs/design/WEBSITE_COLOR_SYSTEM.md and CLAUDE_HANDOFF.md. Admin redesign follows the palette deployment.\n', encoding='utf-8')
print(f'Prepared {len(paths)} bounded paths; preserved remote handoff/timeline history.')

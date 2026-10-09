from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
path = root / 'CLAUDE_HANDOFF.md'
current = path.read_text(encoding='utf-8').split('## Copy-ready prompt for Claude Code')[0].rstrip()
entry = sys.stdin.read().strip()
prompt = ('Review CLAUDE_HANDOFF.md, docs/design/WEBSITE_COLOR_SYSTEM.md and apps/web/src/color-system.css. Verify signed-in shopper/owner/admin screens in both themes, including buttons, status colours and charts; preserve unrelated work. Acceptance: consistent semantic colours, readable controls and no responsive overflow. No design input is needed; full plugin registration needs owner approval, and deployment remains separate.')
path.write_text(current + '\n\n' + entry + '\n\n## Copy-ready prompt for Claude Code\n\n' + prompt + '\n', encoding='utf-8')

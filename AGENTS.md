# Project coordination

Read `CLAUDE_HANDOFF.md` before starting work and consult `ARCH_PLAN.md` for architecture. Follow applicable instructions in app subdirectories too.

Read these files directly from the shared project folder; do not ask the user to upload them to chat. `IMPLEMENTATION_TIMELINE.md` records milestone order and responsibilities; update it when a milestone completes or the sequence changes. No separate changelog is required.

The user requires a living Claude Code handoff. After **every completed work item** (implementation, fix, decision, review, test stage, configuration or deployment), update `CLAUDE_HANDOFF.md` immediately, before moving to the next item or sending a final response. Keep current status, changed paths, verification results, blockers and the next owner's actions accurate. Record failures and unverified work explicitly. Never include secrets or claim an unrun check passed.

Every Codex run must also finish `CLAUDE_HANDOFF.md` with a `## Copy-ready prompt for Claude Code` section. Write a single current, paste-ready instruction that tells Claude exactly what to review or do next, cites the relevant files and acceptance criteria, and says whether product-owner input is still required. Replace the prior prompt rather than accumulating stale prompts. Include the same prompt in Codex's final response.

Preserve other contributors' changes. Separate confirmed user requirements, agent recommendations, and unresolved architecture decisions. When the plan conflicts with verified provider behavior, document the conflict rather than implementing an incorrect contract.

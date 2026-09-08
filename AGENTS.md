# Project Guidelines for AI Agents

## Development Philosophy: Test-Driven Development (TDD)

All AI agents contributing to `Tmd-TS` must strictly follow Test-Driven Development (TDD):

1. **Write Tests First (Red)**:
   - Before writing or modifying any implementation code, write a comprehensive test in `tests/` (using Vitest) that asserts the expected behavior.
   - Run `npm test` to ensure it fails as expected for the right reason.
   - Do not settle for superficial tests (e.g. merely checking `data.length > 0`); verify domain invariants such as rendered duration, timeline positions, event sequencing, or exact pitch/tick offsets.

2. **Implement Minimal Code (Green)**:
   - Implement only the minimal production code necessary to make the failing test pass.
   - Run `npm test` and verify that the test suite now succeeds.

3. **Refactor Cleanly (Refactor)**:
   - Clean up code, remove duplication, optimize resource allocation, and preserve comments/documentation.
   - Re-run `npm run build && npm test` to guarantee no regressions or TypeScript compilation issues occurred.

## Musical Accuracy & Audio Rendering Invariants

- **Timeline & Tempo**:
  - Never hardcode BPM assumptions (e.g., assuming 120 BPM). Always resolve actual durations through the score's timeline.
  - Account for dynamic tempo changes, relative tempo directives (`{!+10}`), and time signature changes across the conductor track.
  - Provide adequate release tails (e.g. 2.5s) on audio rendering so note decays and reverb tails are never clipped.

- **DSL Standards**:
  - Keep TMD notation AST parsers, formatters, and exporters compliant with the specifications outlined in `docs/TMD-Language-Specification.zh-TW.md` and `docs/TMD-Language-Specification.en.md`.
  - Skill documentation bundled with `TmdSkill` must remain in English for universal compatibility with AI tools and LLMs.

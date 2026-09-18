# TMD Refactoring Roadmap & Architecture Plan

## 1. Overview & Motivation

As `TMD` scores grow in complexity—from simple single-track lead sheets to multi-instrument arrangements—musicians and AI agents require reliable, non-destructive, and structurally sound score refactoring tools.

Following the initial port of core refactor operations (`format`, `rename-instrument`, `rename-section`, `extract-instrument`) and measure verification (`TMDMeasureChecker`), this roadmap specifies the design, timeline, and algorithms for advanced refactoring features in `Tmd-TS` and the web editor.

---

## 2. Feature Roadmap & Priorities

```
[Phase 1: In Progress]
Grid Subdivision Transform (Double & Halve Grid)
   ├── 2x Expansion: <4*> -> <8*> (Non-destructive duration doubling with tie padding)
   ├── 2x Compression: <8*> -> <4*> (Checked decimation removing redundant ties)
   ├── CLI: tmd refactor double-grid / halve-grid
   └── Web UI: Selected-text / Target-paragraph transform in Tools menu
       │
[Phase 2: Upcoming]
Track Duplication & Derivation
   ├── Duplicate track (e.g. Vocal -> Flute or Bass root clone)
   └── Octave transpose transposition on duplicate
       │
[Phase 3: Upcoming]
Diatonic Counterpoint & Harmony Generator
   ├── Parallel 3rd / 6th Diatonic Harmony generator (KeySignature-aware)
   ├── Bass Line Counterpoint (Root note generator based on chords)
   └── Voice-leading / oblique motion helpers
       │
[Phase 4: Upcoming]
Macro Flow & Structural Refactoring
   ├── Inline / Unroll order sequence (-> intro -> verse -># to linear sheet)
   └── Extract repeated measures into dedicated section paragraphs
```

---

## 3. Phase 1 Detailed Specification: Grid Subdivision Transform

### 3.1 Mathematical & Musical Invariants
In TMD syntax, `<N*>` defines that one base beat contains $N$ rhythmic subdivisions. For example:
- `<4*>` with `<4/4>`: each measure has 4 units (quarter-note grid).
- `<8*>` with `<4/4>`: each measure has 8 units (eighth-note grid).
- `<16*>` with `<4/4>`: each measure has 16 units (sixteenth-note grid).

When transforming grid resolution:
1. **Audible Duration Preservation**: The actual playback tempo and sound length in quarter notes must remain identical ($\Delta t = 0$).
2. **Double Grid ($2 \times N$)**:
   - Change subdivision header `<N*>` to `<(2N)*>`.
   - Every existing single unit $U$ becomes $U$ followed by a tie `-`:
     - `1` $\rightarrow$ `1 -`
     - `[Am]` $\rightarrow$ `[Am] -`
     - `-` $\rightarrow$ `- -`
     - `D` (drum) $\rightarrow$ `D -`
   - Tuplets $(A\ B\ C)\%(--)$ scale their target tie duration accordingly: $(A\ B\ C)\%(----)$.
3. **Halve Grid ($N / 2$)**:
   - Requires $N$ to be even, and every unit in odd positions to be sustained across the even position (or explicit tie decimation).
   - If an off-beat subdivision is non-empty (e.g. `1 2`), halving will throw a clear validation error preventing data loss.

### 3.2 Scope of Transformation
- **Whole Document**: Transforms all paragraphs in the document.
- **Target Section / Instrument**: Transforms only matching paragraph headers `section:instrument@...{ ... }`.
- **Text Selection (Web Editor)**: If the user selects a block of text in CodeMirror, only the selected paragraphs/sections are transformed in-place.

---

## 4. Phase 2: Track Duplication Specification

- **Purpose**: Rapidly create doubling instruments (e.g., doubling a Vocal track with a Synthesizer, or creating a sub-bass track from a lead melody).
- **Behavior**:
  - Deep-copies all sections in `sourceInstrument`.
  - Replaces instrument name with `targetInstrument`.
  - Supports optional pitch shifting: octave down (`-1`), octave up (`+1`), or root extraction.

---

## 5. Phase 3: Diatonic Harmony & Counterpoint Generation

- **Purpose**: Automatically synthesize natural secondary voices and bass lines directly within TMD.
- **Features**:
  1. **Parallel 3rd / 6th Harmony**:
     - Uses `sheet.keySignature` to compute scale degrees and accidentals.
     - Maps scale degree $d$ to $(d + 2) \pmod 7 + 1$ (for 3rds) or $(d + 5) \pmod 7 + 1$ (for 6ths), adjusting octaves across boundaries.
     - Preserves ties, rests, tuplets, and rhythmic boundaries.
  2. **Diatonic Bass Generator**:
     - Extracts harmonic roots from chord symbols (e.g. `[1]`, `[6m]`, `[Dm7]`, `[G7]`).
     - Emits pedal roots or walking bass rhythms on low octave degree (e.g. `1_`, `6_`, `2_`, `5_`).

---

## 6. Phase 4: Macro Flow & Order Inline / Unroll

- **Inline / Unroll Orders**:
  - Flattens `-> intro -> verse -> {?+1} -> verse ->#` into a linear score with explicit measures.
  - Resolves directives (`{?+1}` modulates note numbers directly into the target key).
- **Measure Extraction**:
  - Detects repeated bars across instruments and encapsulates them into a shared section.

---

## 7. Implementation Standards

- **Strict TDD**: Every feature must have a comprehensive Vitest test in `tests/` covering domain invariants, edge cases, and parser round-tripping before production code is written.
- **Clean CLI & Web UI Integration**: Features exposed via `TMDRefactor` in `src/core/refactor.ts` are wired to `src/cli.ts` and the web editor's `Tools` menu.

# TMD S-Expression Standard Macro Library Specification

This document defines the complete standard function catalog for TMD S-Expressions in the playback flow (`-> (...) ->`).

Functions are divided into three architectural tiers:
1. **Core Structural Combinators** (Temporal layout & routing)
2. **Classical Form Generators** (Macro desugaring into multi-track arrangements)
3. **Motivic Transformation Operators** (Pure contrapuntal & musical modifications)

---

## 1. Core Structural Combinators (Temporal Layout)

These are the fundamental building blocks responsible for time placement and multi-track concurrency.

| Function | Signature | Description |
| :--- | :--- | :--- |
| **`play`** | `(play <material> <instrument> [:at <measure_offset>])` | Instantiates abstract musical material onto a specific instrument track at a given measure offset (default `:at 0`). |
| **`layer`** | `(layer <expr1> <expr2> ...)` | **Parallel Concurrency**: Evaluates all child expressions starting at the exact same measure timestamp. Total duration equals `max(child_durations)`. |
| **`seq`** | `(seq <expr1> <expr2> ...)` | **Sequential Composition**: Evaluates child expressions one after another in chronological order. Total duration equals `sum(child_durations)`. |
| **`loop`** | `(loop <material> <instrument> <times>)` | Repeats `<material>` consecutively `<times>` times on `<instrument>`. Equivalent to `(seq (play material inst) ... [times])`. |

---

## 2. Classical Form Generators (High-Level Forms)

These functions expand into standard multi-voice polyphony or multi-section musical architectures.

| Function | Signature | Description |
| :--- | :--- | :--- |
| **`canon`** | `(canon <theme> (<instruments...>) <offset_bars>)` | **Canon (Prototype + Decorator)**: Staggers identical copies of `<theme>` across `<instruments...>`, delayed progressively by `i * offset_bars`. |
| **`fugue-expo`** | `(fugue-expo <subject> <countersubject> (<instruments...>) <offset_bars>)` | **Fugal Exposition (呈示部)**: Automatically handles Subject (Dux, tonic) and Answer (Comes, dominant +7 semitones) entries with concurrent Countersubject accompaniment. |

---

## 3. Motivic Transformation Operators & Variations

Musical transformations can be applied either as discrete pure functions or as flat modifiers in a single `(vary ...)` call.

### A. The Unified `vary` Combinator (Zero Sub-Parentheses)
Chain any sequence of modifications without nested parentheses:
```lisp
;; Flat syntax (clean & ergonomic):
(vary Theme +7 reverse minor)
(vary Theme flip reverse)
(vary Theme -5 minor)
```

Supported flat tokens:
- **Signed integers (`+7`, `-2`, `+12`)**: Chromatic transposition in semitones.
- **`reverse`**: Chronological reversal of notes within bars.
- **`flip`**: Melodic inversion / pitch reflection upside-down.
- **`minor`**: Converts natural major scale degrees to parallel minor (flattens 3rd, 6th, 7th).
- **`major`**: Restores minor scale degrees to parallel major.

### B. Discrete Pure Operators
| Operator | Signature | Description |
| :--- | :--- | :--- |
| **`transpose`** | `(transpose <semitones> <material>)` | Shifts pitches by signed semitones. |
| **`reverse`** | `(reverse <material>)` | Reverses chronological note order. |
| **`flip`** | `(flip <material> [<axis>])` | Inverts melodic contour upside-down. |
| **`minor`** | `(minor <material>)` | Flattens 3, 6, 7 to parallel minor. |
| **`major`** | `(major <material>)` | Restores flattened 3, 6, 7 to parallel major. |
| **`vary`** | `(vary <material> <modifiers...>)` | Flat or composite variation chain. |

---

## 4. Minimum Viable Product (MVP) vs. Future Roadmap

To ensure rapid delivery, high stability, and zero regressions for `Tmd-TS`:

### Phase 1: MVP (Canonical Core)
Focus strictly on solving the Canon & Ostinato authoring problem:
1. **Parser**:
   - Parse abstract paragraphs (`Theme { ... }` without `:instrument@|offset|`).
   - Parse S-Expressions after `->`: `-> ( ... ) ->`.
2. **Evaluator**:
   - `play`: `(play Theme Violin)`
   - `loop`: `(loop Bass Cello 8)`
   - `canon`: `(canon Theme (Violin1 Violin2 Violin3) 2)`
   - `layer`: `(layer (canon ...) (loop ...))`

### Phase 2: Combinatorial & Contrapuntal Extensions
1. `seq` & `rondo`
2. `fugue-expo` (巴洛克賦格呈示部)
3. `mode` / `scale` (五聲/教會調式量化映射)

### Phase 3: Advanced Transformational Operators
1. `augment` & `diminish` (rhythmic quantization scaling)
2. `minor` & `major` (modal scales)
3. `episode` (賦格插段與動機碎片模進)

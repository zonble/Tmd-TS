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
| **`rondo`** | `(rondo <refrain> (<episodes...>))` | **Rondo (Iterator + Interleaver)**: Alternates the refrain with each episode: `Refrain -> Ep1 -> Refrain -> Ep2 -> ... -> Refrain`. |
| **`stretto`** | `(stretto <subject> (<instruments...>) <offset_bars>)` | **Fugal Stretto (密接和應)**: Overlaps subject statements with tight, rapid voice entries before previous statements finish. |

---

## 3. Motivic Transformation Operators (Pure Functions)

These operators take a theme or musical material and return a transformed version. They are referentially transparent and can be nested arbitrarily: `(op1 (op2 material))`.

| Operator | Signature | Musical Meaning | Implementation Rule |
| :--- | :--- | :--- | :--- |
| **`transpose`** | `(transpose <semitones> <material>)` | **Chromatic Transposition** | Shifts all pitches by a signed number of semitones (`+7` for fifth, `-12` for octave). |
| **`invert`** | `(invert <material> [<axis_degree>])` | **Melodic Inversion (倒影)** | Mirrors pitch intervals upside-down across an axis (defaults to the first note, or specified degree 1..7). |
| **`retrograde`** | `(retrograde <material>)` | **Retrograde (逆行 / Cancrizans)** | Reverses chronological note and rest order (Bach crab canon). |
| **`ri`** | `(ri <material> [<axis_degree>])` | **Retrograde Inversion (逆行倒影)** | Combines retrograde and inversion: `(invert (retrograde material))`. |
| **`augment`** | `(augment <material> <factor>)` | **Rhythmic Augmentation (時值擴大)** | Scales note durations by `<factor>` (e.g. `2.0` doubles note lengths). |
| **`diminish`** | `(diminish <material> <factor>)` | **Rhythmic Diminution (時值縮小)** | Compresses note durations by `<factor>` (e.g. `0.5` halves note lengths). |
| **`minor`** | `(minor <material>)` | **Parallel Minor (同主音小調)** | Converts diatonic major scale degrees to natural/harmonic minor (flattens 3rd, 6th, 7th). |
| **`major`** | `(major <material>)` | **Parallel Major (同主音大調)** | Raises minor intervals to major. |

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
2. `fugue-expo` & `stretto` (巴洛克賦格呈示部與密接和應)
3. `mode` / `scale` (五聲/教會調式量化映射)

### Phase 3: Advanced Transformational Operators
1. `augment` & `diminish` (rhythmic quantization scaling)
2. `minor` & `major` (modal scales)
3. `episode` (賦格插段與動機碎片模進)

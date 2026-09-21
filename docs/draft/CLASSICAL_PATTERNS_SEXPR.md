# Classical Music Design Patterns in TMD S-Expressions

This draft specification maps classical musical forms and software design patterns (originally conceptualized in [Swift by zonble](https://gist.github.com/zonble/1f8df143f7bc69dfce5df324b618461a)) into **Timebase Mark Down (TMD) S-Expressions**.

Because TMD uses S-Expressions `(...)` exclusively within the playback flow (`-> (...) ->`), these musical design patterns can be expressed without conflicting with TMD's existing tokens (chords `[...]`, paragraphs `{...}`, beat grids `<...>`, and track bindings).

---

## 1. Canon: Prototype + Temporal Decorator

```
Prototype (Theme)
    ↓ clone
Instance₀ ────────────────────── (Violin 1 @ 0)
Instance₁ ── delay(2) ────────── (Violin 2 @ +2)
Instance₂ ──── delay(4) ──────── (Violin 3 @ +4)
```

### Pattern Mapping
- **Design Pattern**: Prototype (cloning an abstract theme) + Decorator (decorating each instance with temporal offset `@|+delay|`).
- **S-Expression Signature**:
  ```lisp
  (canon <theme> (<instruments...>) <offset_measures>)
  ```

### Example:
```tmd
Theme {
    <4*>
    3^ 2^ 1^ 7 | 6 5 6 7 | 1^ 7 6 5 | 4 3 4 2 |
}

-> (canon Theme (Violin1 Violin2 Violin3) 2) ->#
```

---

## 2. Ostinato: Infinite Loop / Generator

```
┌──────────────────────────────┐
│ loop(GroundBass, Cello, 8)   │
└──────────────────────────────┘
```

### Pattern Mapping
- **Design Pattern**: Loop / Iterator / Stream Generator.
- **S-Expression Signature**:
  ```lisp
  (loop <theme> <instrument> <iterations>)
  ```

### Example:
```tmd
GroundBass {
    <4*>
    1_ 5__ 6__ 3__ | 4__ 1__ 4__ 5__ |
}

-> (loop GroundBass Cello 8) ->#
```

---

## 3. Passacaglia: Immutable Base + Strategy Layer

```
                Immutable Ground Bass
                          │
             ┌────────────┼────────────┐
             ↓            ↓            ↓
         Strategy A   Strategy B   Strategy C
             ↓            ↓            ↓
         Var 1 (Flute) Var 2 (Oboe) Var 3 (Violin)
```

### Pattern Mapping
- **Design Pattern**: Immutable Base + Strategy + Composite Layering.
- **S-Expression Signature**:
  ```lisp
  (layer
    (loop GroundBass Cello <total_iterations>)
    (seq <var1> <var2> <var3> ...))
  ```

### Example:
```tmd
GroundBass {
    <4*>
    1_ 5__ 6__ 3__ | 4__ 1__ 4__ 5__ |
}

Var1 { <8*>  1 3 5 4 3 1 3 2 | 1 6_ 1 5 4 6 5 4 | }
Var2 { <16*> 1^ 7 1^ 1 7_ 5 2 3 1 1^ 7 6 7 3 5 6 | }

-> (layer
     (loop GroundBass Cello 4)
     (seq
       (play Var1 Flute)
       (play Var2 Violin)
       (play (invert Var1) Oboe)
       (play (diminish Var1 0.5) Piccolo)))
->#
```

---

## 4. Rondo: Iterator + Recurring Callback (ABACA / ABACABA)

```
Refrain (A) ──> Episode 1 (B) ──> Refrain (A) ──> Episode 2 (C) ──> Refrain (A)
```

### Pattern Mapping
- **Design Pattern**: Recurring Callback / Alternating Interleaver.
- **S-Expression Signature**:
  ```lisp
  (rondo <refrain> (<episode1> <episode2> ...))
  ```

### Example:
```tmd
ThemeA { <4*> 1 3 5 1^ | 5 - 3 - | }
EpisodeB { <4*> 6 5 4 3 | 2 - - - | }
EpisodeC { <4*> 4 3 2 1 | 5_ - - - | }

/* Expands to: ThemeA -> EpisodeB -> ThemeA -> EpisodeC -> ThemeA */
-> (rondo ThemeA (EpisodeB EpisodeC)) ->#
```

---

## 5. Fugue: Prototype + Strategy + Polyphonic Interaction

```
               Subject
                  │
         ┌────────┼────────┐
         ↓        ↓        ↓
      Voice 1  Voice 2  Voice 3
         │        │        │
     Original  Answer  Counter-subject
         │   (at 5th)      │
         └───────┬─────────┘
                 │
            Development (Fragment / Stretto)
```

### Pattern Mapping
- **Design Pattern**: Prototype + Transformation Strategy (`transpose`, `stretto`, `inversion`).
- **S-Expression Signature**:
  ```lisp
  (fugue
    :subject <theme>
    :voices ((<inst1> <offset1> <transformation1>)
             (<inst2> <offset2> <transformation2>)))
  ```
  Or expressed using primitive combinators:
  ```lisp
  (layer
    (play Subject Voice1 :at 0)
    (play (transpose +7 Subject) Voice2 :at 4)
    (play (invert Subject) Voice3 :at 8))
  ```

### Example (Fugal Exposition & Stretto):
```tmd
Subject {
    <4*>
    1 5_ 1 2 | 3 2 1 7, | 1 - - - |
}

/* Fugal Exposition */
-> (layer
     (play Subject OrganManualI :at 0)
     (play (transpose +7 Subject) OrganManualII :at 4)
     (play (transpose -12 Subject) OrganPedal :at 8))
/* Stretto (voices enter in rapid succession before subject completes) */
-> (layer
     (play Subject Voice1 :at 0)
     (play (transpose +7 Subject) Voice2 :at 1)
     (play Subject Voice3 :at 2))
->#
```

---

## 6. Variations: Functional Strategy Pipeline

```
Theme
  │
  ├── (ornament Theme "arpeggio")
  ├── (minor Theme)
  ├── (invert Theme)
  ├── (retrograde Theme)
  ├── (augment Theme 2)
  └── (diminish Theme 0.5)
```

### Pattern Mapping
- **Design Pattern**: Strategy Pattern as Pure Transformation Functions.
- **S-Expression Combinators**:
  - `(minor <theme>)`: Flattens degrees 3, 6, 7 to tonic parallel minor.
  - `(invert <theme> [<axis>])`: Melodic inversion.
  - `(retrograde <theme>)`: Reverses note order chronologically.
  - `(augment <theme> <factor>)`: Stretches rhythmic durations.
  - `(diminish <theme> <factor>)`: Compresses rhythmic durations.

### Example:
```tmd
Theme {
    <4*>
    1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 - |
}

-> (play Theme Piano)
-> (play (minor Theme) Piano)
-> (play (invert Theme 1) Flute)
-> (play (retrograde Theme) Violin)
-> (play (diminish Theme 0.5) Piccolo)
-> (play (augment Theme 2) Cello)
->#
```

---

## 7. Sonata-Allegro: Hierarchical Finite State Machine (FSM)

```
        ┌────────────────────────┐
        │       Exposition       │
        │ Theme 1 (Tonic)        │
        │ Bridge / Modulation    │
        │ Theme 2 (Dominant)     │
        └───────────┬────────────┘
                    ↓
        ┌────────────────────────┐
        │      Development       │
        │ Fragmentation & Drama  │
        │ Cycle through Keys     │
        └───────────┬────────────┘
                    ↓
        ┌────────────────────────┐
        │     Recapitulation     │
        │ Theme 1 (Tonic)        │
        │ Theme 2 (Tonic! Solved)│
        └────────────────────────┘
```

### Pattern Mapping
- **Design Pattern**: State Machine / Structural Template.
- **S-Expression Signature**:
  ```lisp
  (sonata
    :theme1 ThemeA
    :theme2 ThemeB
    :key D
    :development (...))
  ```
  Or expressed transparently via TMD playback sequence with modulations:
  ```tmd
  /* Exposition: Theme 1 in Tonic, Theme 2 in Dominant (+7) */
  -> Theme1
  -> Bridge
  -> {?+7} -> Theme2

  /* Development: Motifs fragmented and transformed */
  -> (layer
       (play (retrograde Theme1) Violin)
       (play (diminish Theme2 0.5) Flute))
  -> {?-3} -> Theme1
  -> {?+5} -> Theme2

  /* Recapitulation: Both themes resolved in Tonic */
  -> {?=D}
  -> Theme1
  -> Theme2
  -> Coda
  ->#
  ```

---

## 8. Suite: Composite Pattern

```
                     Suite (Baroque Dance Collection)
                                    │
         ┌──────────────┬───────────┴───────────┬──────────────┐
         ↓              ↓                       ↓              ↓
     Allemande       Courante               Sarabande        Gigue
      (4/4, slow)   (3/2 or 3/4)            (3/4, grave)    (6/8, fast)
```

### Pattern Mapping
- **Design Pattern**: Composite / Pipeline.
- **S-Expression Signature**:
  ```lisp
  (suite <movement1> <movement2> ...)
  ```
  In TMD, sequential composition is natively represented by sequential `->` or an S-Expression `(seq ...)`:
  ```tmd
  -> (seq Allemande Courante Sarabande Gigue) ->#
  ```

---

## Summary Matrix

| Musical Form | Gang of Four (GoF) Pattern | TMD S-Expression Syntax |
| :--- | :--- | :--- |
| **Canon** | Prototype + Decorator | `(canon Theme (V1 V2 V3) 2)` |
| **Ostinato / Ground Bass** | Iterator / Infinite Loop | `(loop Bass Cello 8)` |
| **Passacaglia** | Immutable Base + Strategy Layer | `(layer (loop Bass C 4) (seq Var1 Var2))` |
| **Rondo** | Recurring Callback / Interleaver | `(rondo Refrain (Ep1 Ep2))` |
| **Fugue** | Prototype + Strategy + Stretto | `(layer (play Sub V1 :at 0) (play (transpose +7 Sub) V2 :at 4))` |
| **Theme & Variations** | Strategy Pattern Pipeline | `(seq Theme (minor Theme) (invert Theme))` |
| **Sonata-Allegro** | Finite State Machine (FSM) | `(sonata :theme1 T1 :theme2 T2 :key D ...)` |
| **Suite** | Composite | `(seq Allemande Courante Sarabande Gigue)` |

# Macro Composing in TMD: Architectural Design & Specification (RFC)

## 1. Abstract & Motivation

In current Timebase Mark Down (TMD), musical arrangement follows a linear, imperative structure:
- **Concrete Coupling**: Paragraphs rigidly bind musical notation to a specific track and instrument at declaration time (e.g., `section:Piano@|0| { ... }`).
- **Repetitive Authoring (WET)**: Classical and polyphonic forms such as **Canons**, **Fugues**, **Passacaglias**, and **Variations** require copy-pasting the exact same musical material across multiple tracks, manually padding offset rests (`0`), and hand-transposing notes.
- **Flat Playback Orders**: The playback flow (`-> intro -> verse ->#`) only references flat section identifiers or simple modulation directives (`{?+2}`).

**Macro Composing** elevates musical motifs into first-class, instrument-agnostic architectural abstractions. Drawing inspiration from software design patterns—such as prototypes, decorators, strategies, and functional pipelines—TMD composers can write a melodic theme once and orchestrate, transform, and layer it declaratively.

---

## 2. Core Concepts

### 2.1 Abstract Musical Material (Prototypes / Macros)
A musical section declared **without** an instrument binding serves as an abstract musical theme (or macro):

```tmd
themeA {
    <4*>
    1 2 3 1 | 3 4 5 - | 5 6 5 4 | 3 - 1 - |
    2 5_ 1 - | - - - - |
}
```

- An abstract paragraph contains pure melodic, harmonic, and rhythmic units.
- It is not tied to any MIDI channel or SoundFont instrument.
- It is not emitted into the final conductor timeline unless instantiated or referenced in the playback flow.

### 2.2 Functional Playback Flow
The playback order (`-> ... ->#`) transitions from a list of static symbols into an **evaluatable expression pipeline**:

```tmd
-> Intro -> Canon(themeA, instruments: ["Violin1", "Violin2"], delay: 2m) -> Outro ->#
```

When the compiler evaluates `Canon(...)`, it dynamically expands the prototype into concrete timeline tracks before audio synthesis or export.

---

## 3. Standard Macro Functions

### 3.1 `Canon` (Prototype + Temporal Decorator)
Constructs a polyphonic canon by cloning an abstract theme across multiple voices, progressively offsetting each subsequent voice in time, with optional interval transpositions.

#### Signature:
```
Canon(
    theme: Identifier,
    instruments: [String],
    delay: MeasureDuration = 1m | 2m | ...,
    transposition?: [Integer]   /* Semitone offsets per voice, defaults to [0, 0, ...] */
)
```

#### Example: Three-Voice Canon at the Fifth and Octave
```tmd
-> Canon(
    themeA,
    instruments: ["Violin1", "Violin2", "Cello"],
    delay: 2m,
    transposition: [0, +7, -12]
) ->#
```

**Compiler Expansion:**
- Voice 0 (`Violin1`): `offset = 0`, `transpose = 0`
- Voice 1 (`Violin2`): `offset = 2 measures`, `transpose = +7 semitones`
- Voice 2 (`Cello`): `offset = 4 measures`, `transpose = -12 semitones`
- Total duration: `themeA.duration + 4 measures`.

---

### 3.2 `Layer` (Composite / Parallel Concurrency)
Combines multiple concrete or instantiated sections to play concurrently starting at the same measure timestamp.

#### Signature:
```
Layer([ SectionExpression, ... ])
```

#### Example:
```tmd
-> Layer([
    themeA(instrument: "Flute", octave: +1),
    themeA(instrument: "Cello"),
    ostinatoBass(instrument: "Contrabass")
]) ->#
```

---

### 3.3 `Rondo` (Iterator + Recurring Callback)
Generates an alternating classical rondo form: `Refrain -> Episode_1 -> Refrain -> Episode_2 -> ... -> Refrain`.

#### Signature:
```
Rondo(
    refrain: SectionExpression,
    episodes: [SectionExpression]
)
```

#### Example:
```tmd
-> Rondo(refrain: ThemeA, episodes: [EpisodeB, EpisodeC]) ->#
/* Expands to: ThemeA -> EpisodeB -> ThemeA -> EpisodeC -> ThemeA */
```

---

### 3.4 Atomic Variation & Transformation Functions
Each compositional technique is an atomic, referentially transparent pure function accepting a theme (or section) and returning a transformed theme:

#### 1. `Invert(theme, axis?: ScaleDegree)`
Mirrors pitch intervals upside down across an axis (defaults to the first note of the theme, or a specified tonal center). Ascending intervals become descending intervals, and vice versa.
```tmd
Invert(ThemeA)                /* Melodic inversion around starting pitch */
Invert(ThemeA, axis: 1)       /* Mirror around tonic degree 1 (Do) */
```

#### 2. `Retrograde(theme)`
Reverses the theme backwards in time (the retrograde technique favored by Bach and 20th-century serialism).
```tmd
Retrograde(ThemeA)            /* Plays notes and durations in reverse order */
```

#### 3. `RetrogradeInvert(theme, axis?: ScaleDegree)` (or `RI`)
Combines retrograde and inversion (the prime RI form in counterpoint and twelve-tone matrix composition).
```tmd
RetrogradeInvert(ThemeA)      /* Equivalent to Invert(Retrograde(ThemeA)) */
```

#### 4. `Augment(theme, factor: Number = 2.0)`
Rhythmic augmentation: scales note and rest durations by `factor` (e.g. doubling note lengths, halving tempo perception).
```tmd
Augment(ThemeA, factor: 2.0)  /* Stretches quarter notes to half notes */
```

#### 5. `Diminish(theme, factor: Number = 0.5)`
Rhythmic diminution: compresses note and rest durations by `factor` (e.g. doubling tempo perception).
```tmd
Diminish(ThemeA, factor: 0.5) /* Compresses quarter notes to eighth notes */
```

#### 6. `Minor(theme)` / `Major(theme)`
Modal transformation: modifies diatonic intervals to switch between major and tonic minor (flattening or raising the 3rd, 6th, and 7th degrees).
```tmd
Minor(ThemeA)                 /* Converts major theme to tonic parallel minor */
```

#### 7. `Transpose(theme, semitones: Integer)`
Chromatic pitch transposition by an exact number of semitones.
```tmd
Transpose(ThemeA, semitones: +7) /* Transpose up a perfect fifth */
```

#### 8. `Ornament(theme, style: String)`
Injects motivic ornamentation (e.g., passing tones, arpeggios, appoggiaturas).
```tmd
Ornament(ThemeA, style: "arpeggio")
```

---

### 3.5 `Variations` (Theme and Variations as a Higher-Order Form)
Arranges a base theme into a full classical **Theme and Variations** form (`Theme -> Var 1 -> Var 2 -> ... -> Finale/Coda`).

#### Signature:
```
Variations(
    theme: SectionExpression,
    variations: [ SectionExpression | Transformation ]
)
```

#### Example: Classical Theme and Variations
```tmd
-> Variations(
    theme: ThemeA(instrument: "Piano"),
    variations: [
        /* Var 1: Light ornamentation */
        Ornament(ThemeA, style: "flow", instrument: "Flute"),

        /* Var 2: Polyphonic layer: Inverted upper voice + Original bass */
        Layer([
            Invert(ThemeA, instrument: "Violin"),
            ThemeA(instrument: "Cello", octave: -1)
        ]),

        /* Var 3: Parallel minor transformation */
        Minor(ThemeA, instrument: "Oboe"),

        /* Var 4: Solemn augmentation */
        Augment(ThemeA, factor: 2, instrument: "Brass"),

        /* Var 5: Canon variation */
        Canon(ThemeA, instruments: ["Flute", "Clarinet"], delay: 1m),

        /* Finale: Full orchestral restatement */
        ThemeA(instrument: "Tutti")
    ]
) ->#
```

---

### 3.6 Function Composition and Pipelines
Because transformations are pure functions, they can be nested or composed:
```tmd
/* Retrograde Inversion in minor mode with octaves: */
Minor(Invert(Retrograde(ThemeA(instrument: "Violin", octave: +1))))
```

---

## 4. Proposed Grammar Updates (EBNF Delta)

Extending `docs/TMD-EBNF.md` to accommodate Macro Composing:

```ebnf
(* Abstract Paragraphs without instruments *)
Paragraph               = ConcreteParagraph | AbstractParagraph ;
ConcreteParagraph       = SectionName , ":" , InstrumentName , "@" , ParagraphOffset , "{" , ParagraphBody , "}" ;
AbstractParagraph       = SectionName , "{" , ParagraphBody , "}" ;

(* Playback Flow with Macro Expressions *)
PlaybackFlow            = "->" , FlowExpression , { "->" , FlowExpression } , "->#" ;

FlowExpression          = SectionInvocation
                        | MacroCall
                        | RelativeKeyFlowDirective
                        | AbsoluteKeyFlowDirective ;

SectionInvocation       = SectionName , [ "(" , NamedArgumentList , ")" ] ;

MacroCall               = MacroName , "(" , [ MacroArgumentList ] , ")" ;
MacroName               = "Canon" | "Layer" | "Rondo" | "Variations" | Identifier ;

MacroArgumentList       = PositionalOrNamedArg , { "," , PositionalOrNamedArg } ;
PositionalOrNamedArg    = [ Identifier , ":" ] , ( FlowExpression | ArrayLiteral | Literal ) ;
ArrayLiteral            = "[" , [ ValueList ] , "]" ;
```

---

## 5. Architectural Execution Model

1. **Phase 1: AST Parsing & Symbol Collection**:
   - Classify paragraphs into `concrete` and `abstract` (templates).
   - Register template AST subtrees in a macro environment dictionary.

2. **Phase 2: Macro Expansion (Desugaring / IR)**:
   - Walk the `PlaybackFlow` expression tree.
   - For each macro (e.g. `Canon`), generate synthetic concrete paragraphs with calculated `@|offset|`, instrument assignments, and transposed note tokens.
   - Flatten nested expressions into a sequence of concrete playback events.

3. **Phase 3: Measure Balance & Conductor Compilation**:
   - The expanded AST passes through standard measure consistency checks (`tmd check`).
   - Timelines, MIDI tracks, audio rendering, and MusicXML exports operate transparently on the desugared output without requiring changes to low-level synthesis engines.

---

## 6. Comparison & Benefits

| Aspect | Classic TMD | Macro Composing |
| :--- | :--- | :--- |
| **Philosophy** | Imperative, track-bound, linear | Declarative, motif-driven, architectural |
| **Code Duplication** | High (manual copy-paste for polyphony) | Minimal (single source of truth for themes) |
| **Canon / Polyphony** | Manual rest offsets (`0`) & manual transpose | Single function call: `Canon(...)` |
| **Form Exploration** | Tedious rearrangements across tracks | Effortless parameter changes in `-> Order` |
| **Tooling & IDE** | Static text highlighting | Interactive AST visualizations & parameter sliders |

---

## 7. Next Steps & Roadmap

1. **RFC & Discussion**: Review parameter semantics, keyword conventions, and edge cases (e.g. measure termination rules for staggered voices).
2. **Grammar & Lexer Prototyping**: Update parser in `src/core/` to recognize abstract paragraphs and function invocations in `PlaybackFlow`.
3. **Macro Engine Implementation**: Implement desugaring pipeline (`src/core/macro/`).
4. **TMD Studio Integration**: Visual representations of macro-generated tracks on the Piano Roll and Outline panel.

export interface CanonGeneratorOptions {
  title?: string;
  tempo?: number;
  key?: string;
  timeSig?: string;
  numVoices?: number;
  offsetBars?: number;
  numVariations?: number;
  canonType?: "standard" | "crab" | "mirror" | "table";
  mode?: "tonal" | "pentatonic";
  useMacro?: boolean;
  seed?: number;
}

export class TMDCanonGenerator {
  public static readonly MAJOR_PENTATONIC_SCALE = [
    "1_", "2_", "3_", "5_", "6_",
    "1", "2", "3", "5", "6",
    "1^", "2^", "3^", "5^", "6^",
    "1^^"
  ];

  public static readonly MINOR_PENTATONIC_SCALE = [
    "6__", "1_", "2_", "3_", "5_",
    "6_", "1", "2", "3", "5",
    "6", "1^", "2^", "3^", "5^",
    "6^"
  ];

  public static readonly PENTATONIC_BASS_PATTERNS = {
    minor: [
      ["6__", "1_", "2_", "3_", "5_", "3_", "2_", "1_"],
      ["6__", "5__", "3__", "2__", "1__", "2__", "3__", "5__"],
      ["6__", "2__", "3__", "6__"],
      ["6__", "1_", "5__", "6__"],
    ],
    major: [
      ["1_", "5__", "6__", "3__", "2__", "1__", "5__", "1_"],
      ["1_", "2_", "3_", "5_", "6_", "5_", "3_", "2_"],
      ["1_", "6__", "5__", "1_"],
      ["1_", "3_", "5_", "2_"],
    ]
  };

  public static readonly PENTATONIC_CHORD_TONES_MAJOR: Record<string, string[]> = {
    "1_": ["1", "3", "5", "1^"],
    "2_": ["2", "5", "6", "2^"],
    "3_": ["3", "5", "1^", "3^"],
    "5_": ["5", "2^", "5^", "1^"],
    "6_": ["6", "1^", "3^", "6^"],
    "1__": ["1_", "3_", "5_", "1"],
    "2__": ["2_", "5_", "6_", "2"],
    "3__": ["3_", "5_", "1", "3"],
    "5__": ["5_", "2", "5", "1"],
    "6__": ["6_", "1", "3", "6"],
  };

  public static readonly PENTATONIC_CHORD_TONES_MINOR: Record<string, string[]> = {
    "6__": ["6_", "1", "3", "6"],
    "1_": ["1", "3", "5", "1^"],
    "2_": ["2", "5", "6", "2^"],
    "3_": ["3", "5", "1^", "3^"],
    "5_": ["5", "1^", "3^", "5^"],
    "1__": ["1_", "3_", "5_", "1"],
    "2__": ["2_", "5_", "6_", "2"],
    "3__": ["3_", "5_", "1", "3"],
    "5__": ["5_", "1", "3", "5"],
  };

  public static readonly DIATONIC_MAJOR_SCALE = [
    "1_", "2_", "3_", "4_", "5_", "6_", "7_",
    "1", "2", "3", "4", "5", "6", "7",
    "1^", "2^", "3^", "4^", "5^", "6^", "7^",
    "1^^"
  ];

  public static readonly DIATONIC_MINOR_SCALE = [
    "6__", "7__", "1_", "2_", "3_", "4_", "5_",
    "6_", "7_", "1", "2", "3", "4", "5",
    "6", "7", "1^", "2^", "3^", "4^", "5^",
    "6^"
  ];

  public static readonly TONAL_BASS_PATTERNS = {
    major: [
      ["1_", "5__", "6__", "3__", "4__", "1__", "4__", "5__"],
      ["1_", "4__", "5__", "1_"],
      ["1_", "6__", "4__", "5__"],
      ["4__", "5__", "3__", "6__"],
    ],
    minor: [
      ["6__", "3__", "4__", "1_", "2__", "6__", "2__", "3__"],
      ["6__", "5__", "4__", "3__"],
      ["6__", "2__", "3__", "6__"],
    ]
  };

  public static readonly TONAL_CHORD_TONES_MAJOR: Record<string, string[]> = {
    "1_": ["1", "3", "5", "1^"],
    "1__": ["1_", "3_", "5_", "1"],
    "5_": ["5", "7", "2^", "5^"],
    "5__": ["5_", "7_", "2", "5"],
    "6_": ["6", "1^", "3^", "6^"],
    "6__": ["6_", "1", "3", "6"],
    "3_": ["3", "5", "7", "3^"],
    "3__": ["3_", "5_", "7_", "3"],
    "4_": ["4", "6", "1^", "4^"],
    "4__": ["4_", "6_", "1", "4"],
    "2_": ["2", "4", "6", "2^"],
    "2__": ["2_", "4_", "6_", "2"],
  };

  public static readonly TONAL_CHORD_TONES_MINOR: Record<string, string[]> = {
    "6__": ["6_", "1", "3", "6"],
    "6_": ["6", "1^", "3^", "6^"],
    "3__": ["3_", "5_", "7_", "3"],
    "3_": ["3", "5", "7", "3^"],
    "4__": ["4_", "6_", "1", "4"],
    "4_": ["4", "6", "1^", "4^"],
    "1_": ["1", "3", "5", "1^"],
    "1__": ["1_", "3_", "5_", "1"],
    "2__": ["2_", "4_", "6_", "2"],
    "2_": ["2", "4", "6", "2^"],
    "5__": ["5_", "7_", "2", "5"],
    "5_": ["5", "7", "2^", "5^"],
  };

  private title: string;
  private tempo: number;
  private key: string;
  private timeSig: string;
  private numVoices: number;
  private offsetBars: number;
  private numVariations: number;
  private canonType: "standard" | "crab" | "mirror" | "table";
  private mode: "tonal" | "pentatonic";
  private useMacro: boolean;
  private isMinor: boolean;
  private scale: string[];
  private voiceInstruments: string[];
  private bassInstrument: string;
  private rng: () => number;

  constructor(options: CanonGeneratorOptions = {}) {
    this.title = options.title ?? "Canon";
    this.tempo = options.tempo ?? 64;
    this.key = options.key ?? "C";
    this.timeSig = options.timeSig ?? "4/4";
    this.numVoices = options.numVoices ?? 3;
    this.offsetBars = options.offsetBars ?? 2;
    this.numVariations = options.numVariations ?? 3;
    this.canonType = options.canonType ?? "standard";
    this.mode = options.mode ?? "tonal";
    this.useMacro = options.useMacro ?? true;

    if (options.seed !== undefined) {
      this.rng = this.createSeededRng(options.seed);
    } else {
      this.rng = Math.random;
    }

    this.isMinor = this.key.includes("m");
    if (this.mode === "tonal") {
      this.scale = this.isMinor
        ? TMDCanonGenerator.DIATONIC_MINOR_SCALE
        : TMDCanonGenerator.DIATONIC_MAJOR_SCALE;
    } else {
      this.scale = this.isMinor
        ? TMDCanonGenerator.MINOR_PENTATONIC_SCALE
        : TMDCanonGenerator.MAJOR_PENTATONIC_SCALE;
    }

    this.voiceInstruments = Array.from({ length: this.numVoices }, (_, i) => `Violin${i + 1}`);
    this.bassInstrument = "Cello";
  }

  private createSeededRng(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  private randomChoice<T>(arr: T[]): T {
    const idx = Math.floor(this.rng() * arr.length);
    return arr[idx];
  }

  public generateHeader(): string {
    let modeDesc = "";
    if (this.mode === "tonal") {
      modeDesc = this.isMinor
        ? "自然小調 (Diatonic Minor)"
        : "自然大調 (Diatonic Major / Functional Tonal)";
    } else {
      modeDesc = this.isMinor
        ? "羽調式 (Minor Pentatonic)"
        : "宮調式 (Major Pentatonic)";
    }

    const typeDescMap: Record<string, string> = {
      standard: "Standard Polyphonic Canon (輪唱卡農)",
      crab: "Crab Canon / Cancrizans (螃蟹卡農 / 逆行卡農)",
      mirror: "Mirror Canon / Inversion (倒影卡農 / 鏡像卡農)",
      table: "Table Canon / Retrograde Inversion (桌子卡農 / 雙倒影逆行卡農)",
    };
    const typeDesc = typeDescMap[this.canonType] || "Standard Polyphonic Canon";

    const capMode = this.mode.charAt(0).toUpperCase() + this.mode.slice(1);
    return `::SCORE::
** ${this.title} **
~ "composer: CanonGenerator (${capMode} Algorithmic Engine)"
~ "style: ${modeDesc}, Form: ${typeDesc}"
!= ${this.tempo}
?= ${this.key}
<${this.timeSig}>
`;
  }

  public selectOrGenBass(): string[] {
    const category = this.isMinor ? "minor" : "major";
    const patterns = this.mode === "tonal"
      ? TMDCanonGenerator.TONAL_BASS_PATTERNS[category]
      : TMDCanonGenerator.PENTATONIC_BASS_PATTERNS[category];
    return [...this.randomChoice(patterns)];
  }

  public formatBassMacro(bassNotes: string[]): { code: string; totalMeasures: number } {
    const totalMeasures = bassNotes.length;
    const modeLabel = this.mode === "tonal" ? "Tonal Functional" : "Pentatonic";
    const lines = [
      `/* ${modeLabel} Ground Bass Prototype (Basso Ostinato) */`,
      "Bass {",
      "    <4*>",
    ];
    const barChunks = bassNotes.map((note) => `${note} - - -`);
    for (let i = 0; i < barChunks.length; i += 2) {
      lines.push(`    | ${barChunks.slice(i, i + 2).join(" | ")} |`);
    }
    lines.push("}\n");
    return { code: lines.join("\n"), totalMeasures };
  }

  private getChordTones(bassDegree: string): string[] {
    let mapping: Record<string, string[]>;
    if (this.mode === "tonal") {
      mapping = this.isMinor
        ? TMDCanonGenerator.TONAL_CHORD_TONES_MINOR
        : TMDCanonGenerator.TONAL_CHORD_TONES_MAJOR;
    } else {
      mapping = this.isMinor
        ? TMDCanonGenerator.PENTATONIC_CHORD_TONES_MINOR
        : TMDCanonGenerator.PENTATONIC_CHORD_TONES_MAJOR;
    }

    if (mapping[bassDegree]) {
      return mapping[bassDegree];
    }
    return this.mode === "tonal"
      ? this.scale.slice(7, 12)
      : this.scale.slice(5, 10);
  }

  private stepInScale(currentTone: string, maxSteps = 2): string {
    let idx = this.scale.indexOf(currentTone);
    if (idx === -1) {
      idx = Math.floor(this.scale.length / 2);
    }
    const possibleSteps = [-1, 1, -2, 2, 0].filter(s => Math.abs(s) <= maxSteps);
    const step = this.randomChoice(possibleSteps.length > 0 ? possibleSteps : [0]);
    const newIdx = Math.max(0, Math.min(this.scale.length - 1, idx + step));
    return this.scale[newIdx];
  }

  public generateThemeBars(bassNotes: string[], variationIdx: number): Array<[string, string[]]> {
    const style = variationIdx % 5;
    const measures: string[] = [];

    if (style === 0) {
      // Style 0: Lyrical Cantabile (<4*>)
      for (const bNote of bassNotes) {
        const tones = this.getChordTones(bNote);
        const patternType = this.randomChoice(["half_quarters", "dotted_quarter", "quarter_half", "two_halves"]);
        const t1 = this.randomChoice(tones);
        const t2 = this.stepInScale(t1, 1);
        const t3 = this.stepInScale(t2, 2);

        if (patternType === "half_quarters") {
          measures.push(`${t1} - ${t2} ${t3}`);
        } else if (patternType === "dotted_quarter") {
          measures.push(`${t1} - - ${t2}`);
        } else if (patternType === "quarter_half") {
          measures.push(`${t1} ${t2} - ${t3}`);
        } else {
          measures.push(`${t1} - ${t2} -`);
        }
      }
      return [["<4*>", measures]];
    } else if (style === 1) {
      // Style 1: Baroque Lilt (<8*>)
      for (const bNote of bassNotes) {
        const tones = this.getChordTones(bNote);
        let curr = this.randomChoice(tones);
        const patternChoice = this.randomChoice([1, 2, 3, 4]);

        if (patternChoice === 1) {
          const run = [`${curr} -`];
          for (let i = 0; i < 6; i++) {
            curr = this.stepInScale(curr, 1);
            run.push(curr);
          }
          measures.push(run.join(" "));
        } else if (patternChoice === 2) {
          const t1 = curr;
          const t2 = this.stepInScale(t1, 1);
          curr = t2;
          const run = [`${t1} -`, `${t2} -`];
          for (let i = 0; i < 4; i++) {
            curr = this.stepInScale(curr, 1);
            run.push(curr);
          }
          measures.push(run.join(" "));
        } else if (patternChoice === 3) {
          const t1 = curr;
          const t2 = this.stepInScale(t1, 1);
          const t3 = this.stepInScale(t2, 1);
          const t4 = this.stepInScale(t3, 1);
          const t5 = this.stepInScale(t4, 1);
          measures.push(`${t1} - ${t2}  ${t3} - ${t4}  ${t5} ${t4}`);
        } else {
          const t1 = curr;
          const t2 = this.stepInScale(t1, 1);
          const t3 = this.stepInScale(t2, 1);
          const t4 = this.stepInScale(t3, 2);
          const t5 = this.stepInScale(t4, 1);
          const t6 = this.stepInScale(t5, 1);
          measures.push(`0 ${t1} ${t2} ${t3}  ${t4} - ${t5} ${t6}`);
        }
      }
      return [["<8*>", measures]];
    } else if (style === 2) {
      // Style 2: Virtuosic Flourish (<16*>)
      for (const bNote of bassNotes) {
        const tones = this.getChordTones(bNote);
        let curr = this.randomChoice(tones);
        const flourishType = this.randomChoice(["head_anchor", "center_anchor", "wave_with_rest"]);

        if (flourishType === "head_anchor") {
          const groups = [`${curr} - - -`];
          for (let i = 0; i < 3; i++) {
            const g: string[] = [];
            for (let j = 0; j < 4; j++) {
              curr = this.stepInScale(curr, 1);
              g.push(curr);
            }
            groups.push(g.join(" "));
          }
          measures.push(groups.join("  "));
        } else if (flourishType === "center_anchor") {
          const g1: string[] = [];
          for (let j = 0; j < 4; j++) {
            curr = this.stepInScale(curr, 1);
            g1.push(curr);
          }
          const anchor = this.stepInScale(curr, 2);
          curr = anchor;
          const g3: string[] = [];
          const g4: string[] = [];
          for (let j = 0; j < 4; j++) {
            curr = this.stepInScale(curr, 1);
            g3.push(curr);
          }
          for (let j = 0; j < 4; j++) {
            curr = this.stepInScale(curr, 1);
            g4.push(curr);
          }
          measures.push([g1.join(" "), `${anchor} - - -`, g3.join(" "), g4.join(" ")].join("  "));
        } else {
          const g1 = [curr];
          for (let j = 0; j < 3; j++) {
            curr = this.stepInScale(curr, 1);
            g1.push(curr);
          }
          const g2: string[] = [];
          for (let j = 0; j < 4; j++) {
            curr = this.stepInScale(curr, 1);
            g2.push(curr);
          }
          const tEntry = this.stepInScale(curr, 1);
          curr = tEntry;
          const g4: string[] = [];
          for (let j = 0; j < 4; j++) {
            curr = this.stepInScale(curr, 1);
            g4.push(curr);
          }
          measures.push([g1.join(" "), g2.join(" "), `0 0 ${tEntry} ${curr}`, g4.join(" ")].join("  "));
        }
      }
      return [["<16*>", measures]];
    } else if (style === 3) {
      // Style 3: Staccato Dialogue (<8*>)
      for (const bNote of bassNotes) {
        const tones = this.getChordTones(bNote);
        let curr = this.randomChoice(tones);
        const dialogueChoice = this.randomChoice(["staccato_steps", "offbeat_syncopation", "echo_chords"]);

        if (dialogueChoice === "staccato_steps") {
          const bar: string[] = [];
          for (let i = 0; i < 4; i++) {
            bar.push(`${curr} 0`);
            curr = this.stepInScale(curr, 2);
          }
          measures.push(bar.join(" "));
        } else if (dialogueChoice === "offbeat_syncopation") {
          const t1 = curr;
          const t2 = this.stepInScale(t1, 1);
          const t3 = this.stepInScale(t2, 1);
          const t4 = this.stepInScale(t3, 2);
          measures.push(`0 ${t1}  0 ${t2}  0 ${t3}  ${t4} -`);
        } else {
          const t1 = curr;
          const t2 = this.stepInScale(t1, 1);
          measures.push(`${t1} - 0 ${t1}  ${t2} - 0 ${t2}`);
        }
      }
      return [["<8*>", measures]];
    } else {
      // Style 4: Pastoral Sicilienne (<8*>)
      for (const bNote of bassNotes) {
        const tones = this.getChordTones(bNote);
        const t1 = this.randomChoice(tones);
        const t2 = this.stepInScale(t1, 1);
        const t3 = this.stepInScale(t2, 1);
        const t4 = this.stepInScale(t3, 2);
        measures.push(`${t1} - - ${t2}  ${t3} - ${t4} -`);
      }
      return [["<8*>", measures]];
    }
  }

  public generateThemeSectionMacro(bassNotes: string[], variationIdx: number): string {
    const varName = variationIdx === 0 ? "Theme" : `Var${variationIdx}`;
    const lines = [
      `/* Pentatonic Variation ${variationIdx} (${varName}) */`,
      `${varName} {`,
    ];
    const subsections = this.generateThemeBars(bassNotes, variationIdx);
    for (const [grid, bars] of subsections) {
      lines.push(`    ${grid}`);
      for (const bar of bars) {
        lines.push(`    | ${bar} |`);
      }
    }
    lines.push("}\n");
    return lines.join("\n");
  }

  public generateConcreteSections(bassNotes: string[]): string {
    const introBars = bassNotes.slice(0, this.offsetBars).map(n => `${n} - - -`).join(" | ") + " |";
    const outroLines = [
      "/* Concrete Pentatonic Intro & Outro */",
      `intro:${this.bassInstrument}@|0|{`,
      "    <4*>",
      `    | ${introBars}`,
      "}\n",
    ];

    const tonicBass = this.isMinor ? "6__" : "1_";
    const tonicHigh = this.isMinor ? "6" : "1^";
    const tonicMid = this.isMinor ? "1" : "5";
    const tonicThird = "3";

    outroLines.push(`outro:${this.bassInstrument}@|0|{ <1*> ${tonicBass}--- | }`);
    const cadenceNotes = [tonicHigh, tonicMid, tonicThird];
    for (let i = 0; i < this.voiceInstruments.length; i++) {
      const voice = this.voiceInstruments[i];
      const note = cadenceNotes[i % cadenceNotes.length];
      outroLines.push(`outro:${voice}@|0|{ <1*> ${note}--- | }`);
    }
    outroLines.push("");
    return outroLines.join("\n");
  }

  public generatePlaybackFlowMacro(varNames: string[], bassMeasures: number): string {
    const themeSequence = varNames.length > 1 ? `(${varNames.join(" ")})` : varNames[0];
    const voiceSequence = `(${this.voiceInstruments.join(" ")})`;
    const totalThemeBars = varNames.length * bassMeasures;

    if (this.canonType === "crab") {
      const loopCount = varNames.length;
      const v1 = this.voiceInstruments[0];
      const v2 = this.voiceInstruments.length > 1 ? this.voiceInstruments[1] : "Violin2";
      return [
        "/* S-Expression Playback Flow: Crab Canon (Cancrizans / 螃蟹卡農) */",
        "-> intro",
        "-> (layer",
        `     (play ${themeSequence} ${v1})`,
        `     (play (reverse ${themeSequence}) ${v2})`,
        `     (loop Bass ${this.bassInstrument} ${loopCount}))`,
        "-> outro",
        "->#\n",
      ].join("\n");
    } else if (this.canonType === "mirror") {
      const loopCount = varNames.length;
      const v1 = this.voiceInstruments[0];
      const v2 = this.voiceInstruments.length > 1 ? this.voiceInstruments[1] : "Violin2";
      return [
        "/* S-Expression Playback Flow: Mirror Canon (Inversion / 倒影鏡像卡農) */",
        "-> intro",
        "-> (layer",
        `     (play ${themeSequence} ${v1})`,
        `     (play (flip ${themeSequence}) ${v2})`,
        `     (loop Bass ${this.bassInstrument} ${loopCount}))`,
        "-> outro",
        "->#\n",
      ].join("\n");
    } else if (this.canonType === "table") {
      const loopCount = varNames.length;
      const v1 = this.voiceInstruments[0];
      const v2 = this.voiceInstruments.length > 1 ? this.voiceInstruments[1] : "Violin2";
      return [
        "/* S-Expression Playback Flow: Table Canon (Tafelkanon / 雙倒影逆行桌子卡農) */",
        "-> intro",
        "-> (layer",
        `     (play ${themeSequence} ${v1})`,
        `     (play (flip (reverse ${themeSequence})) ${v2})`,
        `     (loop Bass ${this.bassInstrument} ${loopCount}))`,
        "-> outro",
        "->#\n",
      ].join("\n");
    } else {
      const totalCanonBars = totalThemeBars + (this.numVoices - 1) * this.offsetBars;
      const loopCount = Math.floor((totalCanonBars + bassMeasures - 1) / bassMeasures);
      return [
        "/* S-Expression Playback Flow: Standard Polyphonic Canon (輪唱卡農) */",
        "-> intro",
        "-> (layer",
        `     (canon ${themeSequence} ${voiceSequence} ${this.offsetBars})`,
        `     (loop Bass ${this.bassInstrument} ${loopCount}))`,
        "-> outro",
        "->#\n",
      ].join("\n");
    }
  }

  public generateUnrolledScore(bassNotes: string[]): string {
    const parts = [this.generateHeader()];
    const varData: Array<Array<[string, string[]]>> = [];
    for (let v = 0; v < this.numVariations; v++) {
      varData.push(this.generateThemeBars(bassNotes, v));
    }

    const bassMeasures = bassNotes.length;
    const totalThemeBars = this.numVariations * bassMeasures;
    const totalCanonBars = totalThemeBars + (this.numVoices - 1) * this.offsetBars;
    const loopCount = Math.floor((totalCanonBars + bassMeasures - 1) / bassMeasures);
    const sectionTotalMeasures = loopCount * bassMeasures;

    // Intro
    parts.push(this.generateConcreteSections(bassNotes));

    // Canon section: Cello Ground Bass
    const celloLines = [
      `canon:${this.bassInstrument}@|0|{`,
      "    <4*>",
    ];
    for (let l = 0; l < loopCount; l++) {
      const barChunks = bassNotes.map(n => `${n} - - -`);
      for (let i = 0; i < barChunks.length; i += 2) {
        celloLines.push(`    | ${barChunks.slice(i, i + 2).join(" | ")} |`);
      }
    }
    celloLines.push("}\n");
    parts.push(celloLines.join("\n"));

    // Canon voices
    for (let vIdx = 0; vIdx < this.voiceInstruments.length; vIdx++) {
      const voice = this.voiceInstruments[vIdx];
      const offset = vIdx * this.offsetBars;
      const voiceLines = [`canon:${voice}@|+${offset}|{`];
      for (let vNum = 0; vNum < varData.length; vNum++) {
        voiceLines.push(`    /* Variation ${vNum} */`);
        for (const [grid, bars] of varData[vNum]) {
          voiceLines.push(`    ${grid}`);
          for (const bar of bars) {
            voiceLines.push(`    | ${bar} |`);
          }
        }
      }

      const playedMeasures = offset + totalThemeBars;
      const remainingMeasures = sectionTotalMeasures - playedMeasures;
      if (remainingMeasures > 0) {
        voiceLines.push("    <4*>");
        for (let r = 0; r < remainingMeasures; r++) {
          voiceLines.push("    | 0 - - - |");
        }
      }

      voiceLines.push("}\n");
      parts.push(voiceLines.join("\n"));
    }

    parts.push("-> intro -> canon -> outro ->#\n");
    return parts.join("\n");
  }

  public generate(): string {
    const bassNotes = this.selectOrGenBass();
    if (!this.useMacro) {
      return this.generateUnrolledScore(bassNotes);
    }

    const parts = [this.generateHeader()];
    const { code: bassCode, totalMeasures: bassMeasures } = this.formatBassMacro(bassNotes);
    parts.push(bassCode);

    const varNames: string[] = [];
    for (let v = 0; v < this.numVariations; v++) {
      const name = v === 0 ? "Theme" : `Var${v}`;
      varNames.push(name);
      parts.push(this.generateThemeSectionMacro(bassNotes, v));
    }

    parts.push(this.generateConcreteSections(bassNotes));
    parts.push(this.generatePlaybackFlowMacro(varNames, bassMeasures));

    return parts.join("\n");
  }
}

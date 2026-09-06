import {
  Accidental,
  Beat,
  ChordSymbol,
  KeySignature,
  Note,
  Order,
  Paragraph,
  ScaleDegree,
  Section,
  SectionDirective,
  Sheet,
  Unit,
  UnitGroup
} from "./types";

export type TokenType =
  | "scoreHeader"
  | "doubleAsterisk"
  | "speedPrefix"
  | "relativeTempoPrefix"
  | "keySignaturePrefix"
  | "openAngle"
  | "slash"
  | "asterisk"
  | "closeAngle"
  | "colon"
  | "at"
  | "pipe"
  | "openBrace"
  | "closeBrace"
  | "openParen"
  | "closeParen"
  | "percentOpenParen"
  | "arrow"
  | "arrowEnd"
  | "relativeOrderPrefix"
  | "absoluteOrderPrefix"
  | "number"
  | "positiveNumber"
  | "double"
  | "note"
  | "chord"
  | "percussion"
  | "metadata"
  | "programText"
  | "tie"
  | "identifier"
  | "eof";

export interface Token {
  type: TokenType;
  value?: any;
  text: string;
  line: number;
  column: number;
}

export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    this.input = input;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private peek(offset = 0): string {
    const idx = this.pos + offset;
    if (idx >= this.input.length || idx < 0) return "";
    return this.input[idx];
  }

  private advance(): string {
    if (this.isAtEnd()) return "";
    const ch = this.input[this.pos++];
    if (ch === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        this.advance();
      } else if (c === "/" && this.peek(1) === "*") {
        this.advance();
        this.advance();
        while (!this.isAtEnd()) {
          if (this.peek() === "*" && this.peek(1) === "/") {
            this.advance();
            this.advance();
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (true) {
      const tok = this.nextToken();
      tokens.push(tok);
      if (tok.type === "eof") break;
    }
    return tokens;
  }

  private nextToken(): Token {
    this.skipWhitespaceAndComments();
    const line = this.line;
    const col = this.col;

    if (this.isAtEnd()) {
      return { type: "eof", text: "", line, column: col };
    }

    const c = this.peek();

    // Triple quotes showProgram text
    if (c === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
      this.advance(); this.advance(); this.advance();
      let body = "";
      while (!this.isAtEnd() && !(this.peek() === '"' && this.peek(1) === '"' && this.peek(2) === '"')) {
        body += this.advance();
      }
      if (!this.isAtEnd()) {
        this.advance(); this.advance(); this.advance();
      }
      return { type: "programText", value: body, text: body, line, column: col };
    }

    // ::SCORE::
    if (c === ":" && this.peek(1) === ":") {
      const sub = this.input.slice(this.pos, this.pos + 9);
      if (sub === "::SCORE::") {
        for (let i = 0; i < 9; i++) this.advance();
        return { type: "scoreHeader", text: "::SCORE::", line, column: col };
      }
    }

    // Song metadata (~ "..." or =~:__KEY__= "...")
    if (c === "~" || (c === "=" && this.peek(1) === "~")) {
      const named = c === "=";
      if (named) { this.advance(); this.advance(); } else { this.advance(); }
      while (this.peek() === " " || this.peek() === "\t") this.advance();
      let key = "credit";
      if (named) {
        if (this.peek() === ":") this.advance();
        while (this.peek() === " " || this.peek() === "\t") this.advance();
        if (this.peek() === "_") {
          while (this.peek() === "_") this.advance();
          key = "";
          while (!this.isAtEnd() && !["_", "=", " ", "\t", '"'].includes(this.peek())) {
            key += this.advance();
          }
          while (this.peek() === "_") this.advance();
          if (this.peek() === "=") this.advance();
        }
      }
      while (this.peek() === " " || this.peek() === "\t") this.advance();
      if (this.peek() === '"') {
        this.advance();
        let value = "";
        while (!this.isAtEnd() && this.peek() !== '"') {
          value += this.advance();
        }
        if (this.peek() === '"') this.advance();
        if (key === "credit") {
          if (value.startsWith("詞：")) key = "lyrics";
          else if (value.startsWith("曲：")) key = "composer";
          else if (value.startsWith("編：")) key = "arranger";
        }
        return { type: "metadata", value: { key, value }, text: `${key}:${value}`, line, column: col };
      }
    }

    // -># or ->
    if (c === "-" && this.peek(1) === ">") {
      if (this.peek(2) === "#") {
        this.advance(); this.advance(); this.advance();
        return { type: "arrowEnd", text: "->#", line, column: col };
      } else {
        this.advance(); this.advance();
        return { type: "arrow", text: "->", line, column: col };
      }
    }

    // {?= or {?
    if (c === "{" && this.peek(1) === "?") {
      if (this.peek(2) === "=") {
        this.advance(); this.advance(); this.advance();
        return { type: "absoluteOrderPrefix", text: "{?=", line, column: col };
      } else {
        this.advance(); this.advance();
        return { type: "relativeOrderPrefix", text: "{?", line, column: col };
      }
    }

    // %(
    if (c === "%" && this.peek(1) === "(") {
      this.advance(); this.advance();
      return { type: "percentOpenParen", text: "%(", line, column: col };
    }

    // != or !+
    if (c === "!") {
      let offset = 1;
      while (this.peek(offset) === " " || this.peek(offset) === "\t") offset++;
      if (this.peek(offset) === "=") {
        for (let i = 0; i <= offset; i++) this.advance();
        return { type: "speedPrefix", text: "!=", line, column: col };
      }
      if (this.peek(offset) === "+") {
        for (let i = 0; i <= offset; i++) this.advance();
        return { type: "relativeTempoPrefix", text: "!+", line, column: col };
      }
    }

    // ?=
    if (c === "?") {
      let offset = 1;
      while (this.peek(offset) === " " || this.peek(offset) === "\t") offset++;
      if (this.peek(offset) === "=") {
        for (let i = 0; i <= offset; i++) this.advance();
        return { type: "keySignaturePrefix", text: "?=", line, column: col };
      }
    }

    // **
    if (c === "*" && this.peek(1) === "*") {
      this.advance(); this.advance();
      return { type: "doubleAsterisk", text: "**", line, column: col };
    }

    // Single chars
    switch (c) {
      case ":": this.advance(); return { type: "colon", text: ":", line, column: col };
      case "@": this.advance(); return { type: "at", text: "@", line, column: col };
      case "|": this.advance(); return { type: "pipe", text: "|", line, column: col };
      case "{": this.advance(); return { type: "openBrace", text: "{", line, column: col };
      case "}": this.advance(); return { type: "closeBrace", text: "}", line, column: col };
      case "(": this.advance(); return { type: "openParen", text: "(", line, column: col };
      case ")": this.advance(); return { type: "closeParen", text: ")", line, column: col };
      case "<": this.advance(); return { type: "openAngle", text: "<", line, column: col };
      case ">": this.advance(); return { type: "closeAngle", text: ">", line, column: col };
      case "/": this.advance(); return { type: "slash", text: "/", line, column: col };
      case "*": this.advance(); return { type: "asterisk", text: "*", line, column: col };
      case "-": this.advance(); return { type: "tie", text: "-", line, column: col };
      case "[": {
        this.advance();
        let chordContent = "";
        while (!this.isAtEnd() && this.peek() !== "]") {
          chordContent += this.advance();
        }
        if (this.peek() === "]") this.advance();
        return { type: "chord", value: chordContent.trim(), text: `[${chordContent}]`, line, column: col };
      }
    }

    // Note (1..7 with accidental and octave)
    if (c >= "1" && c <= "7") {
      const next = this.peek(1);
      const isModifier = next === "'" || next === "," || next === "^" || next === "_";
      const isDigit = next >= "0" && next <= "9";

      if (isModifier || !isDigit) {
        this.advance();
        const degree = parseInt(c, 10) as ScaleDegree;
        let accidental = Accidental.Natural;
        let octave = 0;
        let text = c;
        while (!this.isAtEnd()) {
          const mod = this.peek();
          if (mod === "'") { accidental = Accidental.Sharp; text += this.advance(); }
          else if (mod === ",") { accidental = Accidental.Flat; text += this.advance(); }
          else if (mod === "^") { octave++; text += this.advance(); }
          else if (mod === "_") { octave--; text += this.advance(); }
          else break;
        }
        return { type: "note", value: { degree, accidental, octave } as Note, text, line, column: col };
      }
    }

    // Number or positive number (+4)
    if ((c >= "0" && c <= "9") || (c === "+" && (this.peek(1) >= "0" && this.peek(1) <= "9"))) {
      let numStr = "";
      const isPos = c === "+";
      if (isPos) numStr += this.advance();
      let hasDot = false;
      while (!this.isAtEnd()) {
        const cur = this.peek();
        if (cur >= "0" && cur <= "9") {
          numStr += this.advance();
        } else if (cur === "." && !hasDot) {
          if (this.peek(1) >= "0" && this.peek(1) <= "9") {
            hasDot = true;
            numStr += this.advance();
          } else break;
        } else break;
      }
      if (hasDot) {
        return { type: "double", value: parseFloat(numStr), text: numStr, line, column: col };
      } else {
        const val = parseInt(numStr, 10);
        return { type: isPos ? "positiveNumber" : "number", value: val, text: numStr, line, column: col };
      }
    }

    // Identifier
    let idStr = "";
    const stops = new Set(" \t\r\n:!=?*<>/|{}()[]@#,");
    while (!this.isAtEnd()) {
      const cur = this.peek();
      if (stops.has(cur)) break;
      if (cur === "-" && (this.peek(1) === ">" || this.peek(1) === " ")) break;
      idStr += this.advance();
    }
    if (idStr.length > 0) {
      return { type: "identifier", value: idStr, text: idStr, line, column: col };
    }

    // Fallback single char
    const ch = this.advance();
    return { type: "identifier", value: ch, text: ch, line, column: col };
  }
}

export class TmdParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public static parse(input: string): Sheet {
    const lexer = new Lexer(input);
    const parser = new TmdParser(lexer.tokenize());
    return parser.parseSheet();
  }

  private currentToken(): Token {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : { type: "eof", text: "", line: 0, column: 0 };
  }

  private get current(): Token {
    return this.currentToken();
  }

  private advance(): Token {
    const tok = this.currentToken();
    if (this.pos < this.tokens.length) this.pos++;
    return tok;
  }

  private match(type: TokenType): boolean {
    if ((this.currentToken().type as string) === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private skipPipes(): void {
    while (this.current.type === "pipe") this.advance();
  }

  public parseSheet(): Sheet {
    if (!this.match("scoreHeader")) {
      throw new Error(`Syntax error: Missing ::SCORE:: at ${this.current.line}:${this.current.column}`);
    }

    let name = "";
    let speed = 120.0;
    let keySignature = new KeySignature();
    let beat: Beat = { count: 4, noteValue: 4 };
    const paragraphs: Paragraph[] = [];
    const orders: Order[] = [];
    const metadata: Record<string, string> = {};

    while (this.current.type !== "eof") {
      const tokenType: TokenType = this.current.type;
      switch (tokenType) {
        case "doubleAsterisk": {
          this.advance();
          const nameParts: string[] = [];
          while ((this.currentToken().type as string) !== "doubleAsterisk" && (this.currentToken().type as string) !== "eof") {
            const tok = this.advance();
            if (tok.value !== undefined) nameParts.push(String(tok.value));
            else nameParts.push(tok.text);
          }
          this.match("doubleAsterisk");
          name = nameParts.join(" ").trim();
          break;
        }

        case "metadata": {
          const { key, value } = this.advance().value;
          metadata[key] = value;
          break;
        }

        case "speedPrefix": {
          this.advance();
          const currType = this.currentToken().type as string;
          if (currType === "double" || currType === "number" || currType === "positiveNumber") {
            speed = Number(this.advance().value);
          }
          break;
        }

        case "keySignaturePrefix": {
          this.advance();
          let key = "";
          const currType = this.currentToken().type as string;
          if (currType === "identifier") key = this.advance().value;
          else if (currType === "note") key = String(this.advance().value.degree);
          keySignature = KeySignature.parse(key);
          break;
        }

        case "openAngle": {
          this.advance();
          let count = 4;
          let noteValue = 4;
          let currType = this.currentToken().type as string;
          if (currType === "number" || currType === "note") {
            count = this.currentToken().type === "number" ? this.advance().value : this.advance().value.degree;
          }
          this.match("slash");
          currType = this.currentToken().type as string;
          if (currType === "number" || currType === "note") {
            noteValue = this.currentToken().type === "number" ? this.advance().value : this.advance().value.degree;
          }
          this.match("closeAngle");
          beat = { count, noteValue };
          break;
        }

        case "arrow": {
          this.advance();
          const currType = this.currentToken().type as string;
          if (currType === "arrowEnd") {
            this.advance();
            return { name, speed, keySignature, beat, paragraphs, orders, metadata };
          } else if (currType === "relativeOrderPrefix") {
            this.advance();
            let val = "";
            while ((this.currentToken().type as string) !== "closeBrace" && (this.currentToken().type as string) !== "eof") {
              const t = this.advance();
              val += t.type === "positiveNumber" ? `+${t.value}` : t.value !== undefined ? String(t.value) : t.text;
            }
            this.match("closeBrace");
            orders.push({ type: "relative", value: val });
          } else if (currType === "absoluteOrderPrefix") {
            this.advance();
            let val = "";
            while ((this.currentToken().type as string) !== "closeBrace" && (this.currentToken().type as string) !== "eof") {
              const t = this.advance();
              val += t.type === "positiveNumber" ? `+${t.value}` : t.value !== undefined ? String(t.value) : t.text;
            }
            this.match("closeBrace");
            orders.push({ type: "absolute", value: val });
          } else if (currType === "identifier") {
            orders.push({ type: "name", name: this.advance().value });
          } else {
            this.advance();
          }
          break;
        }

        case "arrowEnd":
          this.advance();
          return { name, speed, keySignature, beat, paragraphs, orders, metadata };

        default: {
          const para = this.parseParagraph();
          paragraphs.push(para);
          break;
        }
      }
    }

    return { name, speed, keySignature, beat, paragraphs, orders, metadata };
  }

  private parseParagraph(): Paragraph {
    let name = "";
    if (this.current.type === "identifier") {
      name = this.advance().value;
    }

    if (!this.match("colon")) {
      throw new Error(`Syntax error: Expected ':' in paragraph header at ${this.current.line}:${this.current.column}`);
    }

    let instrument = "";
    if (this.current.type === "identifier") {
      instrument = this.advance().value;
    }

    if (!this.match("at")) {
      throw new Error(`Syntax error: Expected '@' in paragraph header at ${this.current.line}:${this.current.column}`);
    }

    let start = 0;
    let executionTime: string | undefined;
    if (this.match("pipe")) {
      const currType = this.current.type as string;
      if (currType === "tie") {
        this.advance();
        const nextType = this.current.type as string;
        if (nextType === "number") start = -this.advance().value;
        else if (nextType === "note") start = -this.advance().value.degree;
      } else if (currType === "number" || currType === "positiveNumber") {
        start = this.advance().value;
      } else if (currType === "note") {
        start = this.advance().value.degree;
      }
      this.match("pipe");
    } else if ((this.current.type as string) === "identifier") {
      executionTime = this.advance().value;
    }

    if (!this.match("openBrace")) {
      throw new Error(`Syntax error: Expected '{' at ${this.current.line}:${this.current.column}`);
    }

    if (this.current.type === "programText") {
      const showProgram = this.advance().value;
      this.match("closeBrace");
      return { name, instrument, start, sections: [], executionTime, showProgram };
    }

    const sections: Section[] = [];
    while (this.current.type !== "closeBrace" && this.current.type !== "eof") {
      this.skipPipes();
      if (this.current.type === "openAngle") {
        this.advance();
        let noteLength = 4;
        let cType = this.currentToken().type as string;
        if (cType === "number" || cType === "note") {
          noteLength = (this.currentToken().type as string) === "number" ? this.advance().value : this.advance().value.degree;
        } else if (cType === "asterisk") {
          this.advance();
          cType = this.currentToken().type as string;
          if (cType === "number" || cType === "note") {
            noteLength = (this.currentToken().type as string) === "number" ? this.advance().value : this.advance().value.degree;
          }
        }
        this.match("asterisk");
        this.match("closeAngle");

        const unitGroups: UnitGroup[] = [];
        const directives: SectionDirective[] = [];

        while (this.current.type !== "openAngle" && this.current.type !== "closeBrace" && this.current.type !== "eof") {
          this.skipPipes();
          if (this.current.type === "openAngle" || this.current.type === "closeBrace" || this.current.type === "eof") break;

          if (
            this.current.type === "openBrace" ||
            this.current.type === "relativeOrderPrefix" ||
            this.current.type === "absoluteOrderPrefix" ||
            this.current.type === "keySignaturePrefix" ||
            this.current.type === "relativeTempoPrefix"
          ) {
            const dirPos = unitGroups.reduce((acc, g) => acc + g.length, 0);
            const directive = this.parseSectionDirective(dirPos);
            if (directive) directives.push(directive);
            else this.advance();
            continue;
          }

          if (this.match("openParen")) {
            this.skipPipes();
            const groupUnits: Unit[] = [];
            while (this.current.type !== "closeParen" && this.current.type !== "eof") {
              this.skipPipes();
              if (this.current.type === "closeParen") break;
              const u = this.parseUnit();
              if (u) groupUnits.push(u);
              else this.advance();
            }
            this.match("closeParen");
            let length = 1;
            if (this.match("percentOpenParen")) {
              length = 0;
              while (this.current.type === "tie") {
                length++;
                this.advance();
              }
              this.match("closeParen");
            }
            unitGroups.push({ units: groupUnits, length });
          } else {
            const u = this.parseUnit();
            if (u) unitGroups.push({ units: [u], length: 1 });
            else this.advance();
          }
        }
        sections.push({ noteLength, unitGroups, directives });
      } else {
        throw new Error(`Syntax error: Unexpected token '${this.current.text}' inside paragraph at ${this.current.line}:${this.current.column}`);
      }
    }
    this.match("closeBrace");

    return { name, instrument, start, sections, executionTime };
  }

  private parseUnit(): Unit | null {
    this.skipPipes();
    switch (this.current.type) {
      case "note":
        return { type: "note", note: this.advance().value as Note };
      case "chord":
        return { type: "chord", chord: ChordSymbol.parse(this.advance().value) };
      case "tie":
        this.advance();
        return { type: "tie" };
      case "number":
        if (this.current.value === 0) {
          this.advance();
          return { type: "rest" };
        }
        return null;
      case "percussion":
        return { type: "percussion", pattern: this.advance().value };
      case "identifier": {
        const val = this.current.value as string;
        if (val.length > 0 && /^[XxTtSsDdBbOoCc]+$/.test(val)) {
          this.advance();
          return { type: "percussion", pattern: val };
        }
        return null;
      }
      default:
        return null;
    }
  }

  private parseSectionDirective(position: number): SectionDirective | null {
    const startsWithBrace = this.match("openBrace");
    const allowed = ["relativeOrderPrefix", "absoluteOrderPrefix", "keySignaturePrefix", "relativeTempoPrefix"];
    if (!startsWithBrace && !allowed.includes(this.current.type)) return null;

    let result: SectionDirective | null = null;
    const type = this.current.type;

    if (type === "relativeTempoPrefix") {
      this.advance();
      if (this.current.type === "number" || this.current.type === "double") {
        result = { position, kind: { type: "relativeTempo", deltaBpm: Number(this.advance().value) } };
      }
    } else if (type === "speedPrefix") {
      this.advance();
      if (this.current.type === "double" || this.current.type === "number") {
        result = { position, kind: { type: "tempo", bpm: Number(this.advance().value) } };
      } else if (this.current.type === "positiveNumber") {
        result = { position, kind: { type: "relativeTempo", deltaBpm: Number(this.advance().value) } };
      }
    } else if (type === "relativeOrderPrefix") {
      this.advance();
      let val = "";
      while (this.current.type !== "closeBrace" && this.current.type !== "eof") {
        const t = this.advance();
        val += t.type === "positiveNumber" ? `+${t.value}` : t.value !== undefined ? String(t.value) : t.text;
      }
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        result = { position, kind: { type: "relativeKey", semitones: num } };
      }
    } else if (type === "absoluteOrderPrefix" || type === "keySignaturePrefix") {
      this.advance();
      let val = "";
      while (this.current.type !== "closeBrace" && this.current.type !== "eof") {
        const t = this.advance();
        val += t.value !== undefined ? String(t.value) : t.text;
      }
      result = { position, kind: { type: "absoluteKey", key: val } };
    } else if ((this.current.type as string) === "openAngle") {
      this.advance();
      let count = 4;
      let noteValue = 4;
      let cType = this.current.type as string;
      if (cType === "number" || cType === "note") {
        count = this.current.type === "number" ? this.advance().value : this.advance().value.degree;
      }
      this.match("slash");
      cType = this.current.type as string;
      if (cType === "number" || cType === "note") {
        noteValue = this.current.type === "number" ? this.advance().value : this.advance().value.degree;
      }
      this.match("closeAngle");
      result = { position, kind: { type: "timeSignature", beat: { count, noteValue } } };
    }

    this.match("closeBrace");
    return result;
  }
}

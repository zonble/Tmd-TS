import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { StreamLanguage, StringStream } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

interface TMDParserState {
  inComment: boolean;
}

export const tmdLanguage = StreamLanguage.define<TMDParserState>({
  startState(): TMDParserState {
    return { inComment: false };
  },
  token(stream: StringStream, state: TMDParserState): string | null {
    if (state.inComment) {
      if (stream.match(/\*\//)) {
        state.inComment = false;
        return "comment";
      }
      stream.next();
      return "comment";
    }

    if (stream.match(/\/\*/)) {
      state.inComment = true;
      return "comment";
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Header root
    if (stream.match(/^::SCORE::/)) {
      return "keyword";
    }

    // Song Title
    if (stream.match(/^\*\*[^*]+\*\*/)) {
      return "heading";
    }

    // Order sequences (-> intro -> A ->#)
    if (stream.match(/^->#|^->\?|^->/)) {
      return "keyword";
    }

    // Directives
    if (stream.match(/^\{!=[\d.]+\}|^\{!\+[\d.]+\}/)) {
      return "operator";
    }
    if (stream.match(/^\{\?=[A-Ga-g0-9',#b]+\}|^\{\?[+-]\d+\}/)) {
      return "operator";
    }
    if (stream.match(/^\{<\d+\/\d+>\}/)) {
      return "operator";
    }
    if (stream.match(/^\{show\s+[^}]+\}/)) {
      return "meta";
    }

    // Global settings: tempo, key, meter
    if (stream.match(/^!\s*=\s*[\d.]+/)) {
      return "number";
    }
    if (stream.match(/^\?\s*=\s*[A-Ga-g][',#b]*/)) {
      return "atom";
    }
    if (stream.match(/^<\d+\/\d+>|^<\d+\*>/)) {
      return "meta";
    }

    // Paragraph Header: section:Instrument@|offset|{
    if (stream.match(/^[a-zA-Z0-9_\u4e00-\u9fa5-]+:[a-zA-Z0-9_\u4e00-\u9fa5-]+(@\|?[+-]?\d+\|?)?\s*\{/)) {
      return "def";
    }
    if (stream.match(/^\}/)) {
      return "bracket";
    }

    // Chords: [1], [6m], [Cmaj7], [Am7], [2m7-5]
    if (stream.match(/^\[[^\]]+\]/)) {
      return "string";
    }

    // Tuplets: (1 2 3)%(--)
    if (stream.match(/^\([^)]+\)%[^ \t\r\n|]+/)) {
      return "special";
    }

    // Barlines
    if (stream.match(/^\|/)) {
      return "punctuation";
    }

    // Notes: Jianpu degree 0-7 with octave (^, _), accidentals (', ,, #, b), ties/rests (-)
    if (stream.match(/^[0-7]['#,^_\-.]+/)) {
      return "variableName";
    }
    if (stream.match(/^[0-7]/)) {
      return "variableName";
    }
    if (stream.match(/^-+/)) {
      return "punctuation";
    }

    // Metadata lines (~ "...")
    if (stream.match(/^~\s*"[^"]*"/)) {
      return "string";
    }

    stream.next();
    return null;
  }
});

export interface TMDWebEditor {
  view: EditorView;
  getContent(): string;
  setContent(text: string): void;
  focus(): void;
}

export function createTmdEditor(
  container: HTMLElement,
  initialContent: string,
  onChange?: (content: string) => void
): TMDWebEditor {
  const languageCompartment = new Compartment();

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialContent,
    extensions: [
      basicSetup,
      oneDark,
      languageCompartment.of(tmdLanguage),
      updateListener,
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "14px",
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
        },
        ".cm-scroller": {
          overflow: "auto",
        },
        ".cm-content": {
          padding: "12px 4px",
        },
        ".cm-line": {
          padding: "0 4px",
          lineHeight: "1.6",
        },
        "&.cm-focused": {
          outline: "none",
        },
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return {
    view,
    getContent() {
      return view.state.doc.toString();
    },
    setContent(text: string) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: text,
        },
      });
    },
    focus() {
      view.focus();
    },
  };
}

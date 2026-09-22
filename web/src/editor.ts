import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment, StateEffect, StateField, RangeSetBuilder } from "@codemirror/state";
import { StreamLanguage, StringStream } from "@codemirror/language";
import { toggleComment, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, gutter, GutterMarker, BlockInfo, Decoration, DecorationSet, hoverTooltip, Tooltip } from "@codemirror/view";
import type { TMDMeasureIssue } from "../../src/core/measure_check.js";

export interface TMDParserState {
  inComment: boolean;
  inOrder: boolean;
  parenDepth: number;
}

export const tmdStreamParser = {
  languageData: {
    commentTokens: {
      block: { open: "/*", close: "*/" },
    },
  },
  startState(): TMDParserState {
    return { inComment: false, inOrder: false, parenDepth: 0 };
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

    // Paragraph Header: concrete `section:Instrument@|offset|{` or abstract `Theme {`
    if (stream.match(/^[a-zA-Z0-9_\u4e00-\u9fa5-]+(:[a-zA-Z0-9_\u4e00-\u9fa5-]+(@\|?[+-]?\d+\|?)?)?\s*\{/)) {
      return "def";
    }
    if (stream.match(/^\}/)) {
      return "bracket";
    }

    // S-Expression macro forms: (canon Theme (V1 V2) 2)
    // Distinguish from Jianpu tuplet like (1 2 3)%(--)
    if (stream.match(/^\(/)) {
      // Check if this paren is followed eventually by )% (which is tuplet)
      const rest = stream.string.slice(stream.pos);
      if (/^[^\)]*\)%/.test(rest)) {
        // Tuplet prefix, fall through to tuplet matcher
        stream.backUp(1);
      } else {
        state.parenDepth++;
        return "bracket";
      }
    }
    if (state.parenDepth > 0) {
      if (stream.match(/^\)/)) {
        state.parenDepth = Math.max(0, state.parenDepth - 1);
        return "bracket";
      }
      // S-expression operators / macro combinators
      if (stream.match(/^(canon|layer|loop|play|transpose|retrograde|invert|augment|diminish)\b/)) {
        return "keyword";
      }
      // Numbers inside macro
      if (stream.match(/^[+-]?\d+(\.\d+)?/)) {
        return "number";
      }
      // Identifiers / Symbols inside macro
      if (stream.match(/^[a-zA-Z0-9_\u4e00-\u9fa5-]+/)) {
        return "variableName";
      }
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
  },
};

export const tmdLanguage = StreamLanguage.define<TMDParserState>(tmdStreamParser);

export interface CursorContext {
  section?: string;
  instrument?: string;
  hasSelection: boolean;
  selectionText: string;
}

export interface TMDWebEditor {
  view: EditorView;
  getContent(): string;
  setContent(text: string): void;
  insertAtCursor(text: string): void;
  getSelection(): string;
  replaceSelection(text: string): void;
  scrollToLine(line: number): void;
  scrollToRange(startLine: number, startCol: number, endLine: number, endCol: number): void;
  getCursorContext(): CursorContext;
  toggleComment(): void;
  setMeasureIssues(issues: TMDMeasureIssue[]): void;
  setTheme(theme: "dark" | "light"): void;
  focus(): void;
}

class SectionPlayGutterMarker extends GutterMarker {
  constructor(
    private readonly sectionName: string,
    private readonly instrumentName: string,
    private readonly onPlaySection?: (section: string, instrument: string) => void
  ) {
    super();
  }

  toDOM() {
    const btn = document.createElement("span");
    btn.className = "cm-section-play-btn";
    btn.title = `試聽段落: ${this.sectionName} (${this.instrumentName})`;
    btn.textContent = "▶";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.onPlaySection) {
        this.onPlaySection(this.sectionName, this.instrumentName);
      }
    });
    return btn;
  }
}

export function createTmdEditor(
  container: HTMLElement,
  initialContent: string,
  onChange?: (content: string) => void,
  onCursorActivity?: (line: number, col: number) => void,
  onFormat?: () => void,
  onPlaySection?: (section: string, instrument: string) => void
): TMDWebEditor {
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();

  const lightEditorTheme = EditorView.theme({
    "&": {
      backgroundColor: "#ffffff",
      color: "#1f2328",
    },
    ".cm-content": {
      caretColor: "#0969da",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#0969da",
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "#b6e3ff !important",
    },
    ".cm-gutters": {
      backgroundColor: "#f6f8fa",
      color: "#656d76",
      borderRight: "1px solid #d0d7de",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(234, 238, 242, 0.5)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#eaeef2",
      color: "#1f2328",
    },
  }, { dark: false });

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
    if ((update.selectionSet || update.docChanged) && onCursorActivity) {
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos);
      const col = pos - line.from + 1;
      onCursorActivity(line.number, col);
    }
  });

  const editorKeymap = keymap.of([
    {
      key: "Mod-Shift-f",
      run: () => {
        if (onFormat) {
          onFormat();
          return true;
        }
        return false;
      },
    },
    {
      key: "Shift-Alt-f",
      run: () => {
        if (onFormat) {
          onFormat();
          return true;
        }
        return false;
      },
    },
    {
      key: "Mod-/",
      run: toggleComment,
    },
    {
      key: "Shift-Alt-a",
      run: toggleComment,
    },
    indentWithTab,
  ]);

  const sectionPlayGutter = gutter({
    class: "cm-section-play-gutter",
    lineMarker(view: EditorView, line: BlockInfo) {
      const lineText = view.state.doc.lineAt(line.from).text.trim();
      const match = lineText.match(/^([a-zA-Z0-9_\u4e00-\u9fa5-]+):([a-zA-Z0-9_\u4e00-\u9fa5-]+)(?:@\|?[+-]?\d+\|?)?\s*\{/);
      if (match) {
        return new SectionPlayGutterMarker(match[1], match[2], onPlaySection);
      }
      return null;
    },
    initialSpacer: () => new SectionPlayGutterMarker("", ""),
  });

  const setMeasureIssuesEffect = StateEffect.define<TMDMeasureIssue[]>();

  let activeIssues: TMDMeasureIssue[] = [];

  const measureIssuesTooltip = hoverTooltip((view, pos, side): Tooltip | null => {
    if (!activeIssues || activeIssues.length === 0) return null;
    const doc = view.state.doc;
    const line = doc.lineAt(pos);
    const lineNum = line.number;

    const matchingIssues = activeIssues.filter((i) => i.lineNumber === lineNum);
    if (matchingIssues.length === 0) return null;

    return {
      pos: line.from,
      end: line.to,
      above: true,
      create(view) {
        const dom = document.createElement("div");
        dom.className = "cm-issue-tooltip";

        matchingIssues.forEach((issue) => {
          const item = document.createElement("div");
          item.className = "cm-issue-tooltip-item";

          const icon = document.createElement("span");
          icon.className = "cm-issue-tooltip-icon";
          icon.textContent = "⚠";

          const text = document.createElement("span");
          text.className = "cm-issue-tooltip-text";
          text.textContent = issue.description || `${issue.paragraphName}:${issue.instrument} measure issue`;

          item.appendChild(icon);
          item.appendChild(text);
          dom.appendChild(item);
        });

        return { dom };
      },
    };
  });

  const measureIssuesField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      decorations = decorations.map(tr.changes);
      for (const effect of tr.effects) {
        if (effect.is(setMeasureIssuesEffect)) {
          const issues = effect.value;
          activeIssues = issues || [];
          if (!issues || issues.length === 0) {
            decorations = Decoration.none;
          } else {
            const builder = new RangeSetBuilder<Decoration>();
            // Deduplicate line numbers and sort
            const lines = Array.from(
              new Set(
                issues
                  .map((i) => i.lineNumber)
                  .filter((ln) => typeof ln === "number" && ln >= 1 && ln <= tr.state.doc.lines)
              )
            ).sort((a, b) => a - b);

            for (const lineNum of lines) {
              const lineObj = tr.state.doc.line(lineNum);
              builder.add(
                lineObj.from,
                lineObj.from,
                Decoration.line({
                  class: "cm-measure-issue",
                })
              );
            }
            decorations = builder.finish();
          }
        }
      }
      return decorations;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  const state = EditorState.create({
    doc: initialContent,
    extensions: [
      basicSetup,
      sectionPlayGutter,
      measureIssuesField,
      measureIssuesTooltip,
      themeCompartment.of(oneDark),
      languageCompartment.of(tmdLanguage),
      updateListener,
      editorKeymap,
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
    insertAtCursor(text: string) {
      const selection = view.state.selection.main;
      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: text,
        },
        selection: { anchor: selection.from + text.length },
      });
    },
    getSelection() {
      const selection = view.state.selection.main;
      if (selection.empty) return "";
      return view.state.sliceDoc(selection.from, selection.to);
    },
    replaceSelection(text: string) {
      const selection = view.state.selection.main;
      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: text,
        },
        selection: { anchor: selection.from + text.length },
      });
    },
    scrollToLine(line: number) {
      const doc = view.state.doc;
      const targetLine = Math.max(1, Math.min(line, doc.lines));
      const lineObj = doc.line(targetLine);
      view.dispatch({
        selection: { anchor: lineObj.from, head: lineObj.to },
        scrollIntoView: true,
      });
      view.focus();
    },
    scrollToRange(startLine: number, startCol: number, endLine: number, endCol: number) {
      const doc = view.state.doc;
      const sLine = Math.max(1, Math.min(startLine, doc.lines));
      const eLine = Math.max(1, Math.min(endLine, doc.lines));
      const sLineObj = doc.line(sLine);
      const eLineObj = doc.line(eLine);
      const from = Math.min(sLineObj.from + Math.max(0, startCol - 1), sLineObj.to);
      const to = Math.min(eLineObj.from + Math.max(0, endCol - 1), eLineObj.to);
      view.dispatch({
        selection: { anchor: from, head: Math.max(from, to) },
        scrollIntoView: true,
      });
      view.focus();
    },
    getCursorContext() {
      const selection = view.state.selection.main;
      const hasSelection = !selection.empty;
      const doc = view.state.doc;
      const currentLineNum = doc.lineAt(selection.head).number;

      // Scan backwards from current line to find the enclosing paragraph header e.g. "verse:Guitar@|0|{"
      let section: string | undefined;
      let instrument: string | undefined;

      for (let l = currentLineNum; l >= 1; l--) {
        const lineText = doc.line(l).text.trim();
        // Match paragraph header like `verse:Guitar@|0|{` or `verse:Guitar{`
        const match = lineText.match(/^([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)/);
        if (match) {
          section = match[1];
          instrument = match[2];
          break;
        }
        // If we hit another block closing before opening, we stop or continue scanning
      }

      return {
        section,
        instrument,
        hasSelection,
        selectionText: hasSelection ? view.state.sliceDoc(selection.from, selection.to) : "",
      };
    },
    toggleComment() {
      toggleComment(view);
      view.focus();
    },
    setMeasureIssues(issues: TMDMeasureIssue[]) {
      view.dispatch({
        effects: setMeasureIssuesEffect.of(issues),
      });
    },
    setTheme(theme: "dark" | "light") {
      view.dispatch({
        effects: themeCompartment.reconfigure(theme === "light" ? lightEditorTheme : oneDark),
      });
    },
    focus() {
      view.focus();
    },
  };
}

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { TmdStorage } from "../web/src/storage/db.js";
import { parseImportedScoreFile } from "../web/src/ui/libraryDrawer.js";

describe("Library Score File Import (TDD)", () => {
  beforeEach(async () => {
    await TmdStorage.clearAll();
  });

  describe("parseImportedScoreFile", () => {
    it("parses raw .tmd content and extracts title correctly", () => {
      const tmdText = `::SCORE::\n** 我的第一首創作 **\n!= 120\nKey: C\nBeat: 4/4\n`;
      const result = parseImportedScoreFile("my_song.tmd", tmdText);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("我的第一首創作");
      expect(result?.content).toBe(tmdText);
    });

    it("parses raw .tmd content without ** title ** and falls back to filename base", () => {
      const tmdText = `::SCORE::\n!= 120\nKey: C\nBeat: 4/4\n`;
      const result = parseImportedScoreFile("cool-melody.tmd", tmdText);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("cool-melody");
      expect(result?.content).toBe(tmdText);
    });

    it("parses .md file containing a ```tmd ... ``` code block", () => {
      const mdContent = `# Project Song\n\nHere is the TMD score:\n\n\`\`\`tmd\n::SCORE::\n** Markdown 內嵌歌曲 **\n!= 100\n\`\`\`\n\nEnjoy!`;
      const result = parseImportedScoreFile("song_sheet.md", mdContent);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Markdown 內嵌歌曲");
      expect(result?.content).toContain("::SCORE::");
      expect(result?.content).toContain("** Markdown 內嵌歌曲 **");
      expect(result?.content).not.toContain("Project Song");
    });

    it("parses .md file with raw ::SCORE:: when code block is omitted", () => {
      const mdContent = `# Readme\n\n::SCORE::\n** 直接寫在 MD 的曲子 **\n!= 90\n`;
      const result = parseImportedScoreFile("draft.markdown", mdContent);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("直接寫在 MD 的曲子");
      expect(result?.content.startsWith("::SCORE::")).toBe(true);
    });

    it("falls back to filename base for .md when no ** Title ** is inside the score block", () => {
      const mdContent = `\`\`\`tmd\n::SCORE::\n!= 120\n1 2 3 4 |\n\`\`\``;
      const result = parseImportedScoreFile("etude_no_1.md", mdContent);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("etude_no_1");
      expect(result?.content).toContain("::SCORE::");
    });

    it("throws or returns error/null when .md file does not contain valid TMD code block or ::SCORE::", () => {
      const normalMd = `# Just a normal markdown\n\nNo score here at all.`;
      expect(() => parseImportedScoreFile("notes.md", normalMd)).toThrowError(/TMD/);
    });

    it("throws or returns error/null when .tmd file is empty", () => {
      expect(() => parseImportedScoreFile("empty.tmd", "   \n\t  ")).toThrowError();
    });
  });

  describe("TMDLibraryDrawerController importScoreFile and drag-drop", () => {
    it("imports score file via File object and notifies toast", async () => {
      const { TMDLibraryDrawerController } = await import("../web/src/ui/libraryDrawer.js");

      const eventListeners: Record<string, Function[]> = {};
      const classListSet = new Set<string>();

      const mockDrawer: any = {
        classList: {
          add: (cls: string) => classListSet.add(cls),
          remove: (cls: string) => classListSet.delete(cls),
          contains: (cls: string) => classListSet.has(cls),
          toggle: (cls: string) => {
            if (classListSet.has(cls)) classListSet.delete(cls);
            else classListSet.add(cls);
          },
        },
        addEventListener: (event: string, handler: Function) => {
          if (!eventListeners[event]) eventListeners[event] = [];
          eventListeners[event].push(handler);
        },
        dispatchEvent: (event: { type: string; [k: string]: any }) => {
          (eventListeners[event.type] || []).forEach((fn) => fn(event));
        },
      };

      const mockInput: any = {
        files: [],
        value: "",
        addEventListener: (event: string, handler: Function) => {
          if (!eventListeners[event]) eventListeners[event] = [];
          eventListeners[event].push(handler);
        },
      };

      let loadedContent = "";
      let toastMessage = "";
      let toastType = "";

      const dummyEditor = {
        setContent: (c: string) => {
          loadedContent = c;
        },
      } as any;

      const controller = new TMDLibraryDrawerController(
        {
          libraryDrawer: mockDrawer,
          inputImportTmd: mockInput,
        },
        () => dummyEditor,
        (text) => {
          loadedContent = text;
        },
        () => {},
        (msg, type) => {
          toastMessage = msg;
          toastType = type || "";
        }
      );
      controller.init();

      // Test dragenter and dragleave toggling .drag-over class
      mockDrawer.dispatchEvent({ type: "dragenter", preventDefault: () => {} });
      expect(mockDrawer.classList.contains("drag-over")).toBe(true);

      mockDrawer.dispatchEvent({ type: "dragleave", preventDefault: () => {} });
      expect(mockDrawer.classList.contains("drag-over")).toBe(false);

      // Test importScoreFile with .md File / mock file
      const mdContent = "```tmd\n::SCORE::\n** Controller Test **\n!= 110\n```";
      const mockFile: any = {
        name: "song.md",
        text: async () => mdContent,
      };

      const saved = await controller.importScoreFile(mockFile);
      expect(saved.title).toBe("Controller Test");
      expect(saved.content).toContain("::SCORE::");
      expect(loadedContent).toContain("::SCORE::");
      expect(toastMessage).toContain("Controller Test");
      expect(toastType).toBe("success");

      // Verify stored in IndexedDB
      const scores = await TmdStorage.listScores();
      expect(scores.some((s) => s.title === "Controller Test")).toBe(true);
    });

    it("generates a canon, stores it in IndexedDB, and loads into editor", async () => {
      let loadedContent = "";
      let toastMessage = "";
      let toastType = "";

      const makeMockElement = (initialValue = "") => {
        const listeners: Record<string, Function[]> = {};
        const classSet = new Set<string>();
        return {
          value: initialValue,
          classList: {
            add: (c: string) => classSet.add(c),
            remove: (c: string) => classSet.delete(c),
            contains: (c: string) => classSet.has(c),
          },
          addEventListener: (event: string, fn: Function) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
          },
          click: () => {
            (listeners["click"] || []).forEach((fn) => fn({ preventDefault: () => {} }));
          },
          close: () => {},
          showModal: () => {},
          dispatchEvent: (evt: { type: string }) => {
            (listeners[evt.type] || []).forEach((fn) => fn(evt));
          },
        };
      };

      const btnConfirmGenerateCanon = makeMockElement() as any;
      const canonGeneratorModal = makeMockElement() as any;
      const inputCanonTitle = makeMockElement("Library Canon Test") as any;
      const selectCanonKey = makeMockElement("D") as any;
      const inputCanonTempo = makeMockElement("64") as any;
      const selectCanonMode = makeMockElement("tonal") as any;
      const selectCanonType = makeMockElement("standard") as any;
      const inputCanonVoices = makeMockElement("3") as any;
      const inputCanonOffset = makeMockElement("2") as any;
      const inputCanonVariations = makeMockElement("2") as any;
      const selectCanonOutput = makeMockElement("macro") as any;

      const dummyEditor = {
        setContent: (c: string) => {
          loadedContent = c;
        },
      } as any;

      const { TMDLibraryDrawerController } = await import("../web/src/ui/libraryDrawer.js");
      const controller = new TMDLibraryDrawerController(
        {
          libraryDrawer: makeMockElement() as any,
          libraryScoresList: makeMockElement() as any,
          librarySamplesList: makeMockElement() as any,
          libraryScoresCount: makeMockElement() as any,
          canonGeneratorModal,
          btnConfirmGenerateCanon,
          inputCanonTitle,
          selectCanonKey,
          inputCanonTempo,
          selectCanonMode,
          selectCanonType,
          inputCanonVoices,
          inputCanonOffset,
          inputCanonVariations,
          selectCanonOutput,
        },
        () => dummyEditor,
        (content) => {
          loadedContent = content;
        },
        () => {},
        (msg, type) => {
          toastMessage = msg;
          toastType = type || "";
        }
      );
      controller.init();

      // Trigger generate button
      btnConfirmGenerateCanon.click();

      // Await next tick so async event handler runs
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadedContent).toContain("::SCORE::");
      expect(loadedContent).toContain("Library Canon Test");
      expect(toastType).toBe("success");

      const scores = await TmdStorage.listScores();
      expect(scores.some((s) => s.title === "Library Canon Test")).toBe(true);
    });
  });
});



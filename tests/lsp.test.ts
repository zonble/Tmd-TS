import { describe, it, expect, vi } from "vitest";
import {
  TMDJSONRPCCodec,
  TMDLSPCompletionEngine,
  TMDLSPDiagnosticEngine,
  TMDLSPServer,
  TMDLSPPosition,
} from "../src/lsp/index.js";

describe("TMD LSP Protocol & Completion Tests (TDD)", () => {
  it("parses JSON-RPC messages with Content-Length header", () => {
    const raw = 'Content-Length: 46\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize"}';
    const frames = TMDJSONRPCCodec.decode(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe(1);
    expect(frames[0].method).toBe("initialize");
  });

  it("encodes JSON-RPC response with Content-Length header", () => {
    const response = { id: 1, result: { capabilities: {} } };
    const encoded = TMDJSONRPCCodec.encode(response);
    expect(encoded.startsWith("Content-Length: ")).toBe(true);
    expect(encoded).toContain("\r\n\r\n");
    expect(encoded).toContain('"jsonrpc":"2.0"');
  });

  it("handles fragmented chunked JSON-RPC buffer stream", () => {
    const msg = '{"jsonrpc":"2.0","id":2,"method":"shutdown"}';
    const header = `Content-Length: ${msg.length}\r\n\r\n`;

    let buffer = Buffer.from(header.slice(0, 10));
    let frames = TMDJSONRPCCodec.decodeBuffer(buffer);
    expect(frames.frames).toHaveLength(0);

    buffer = Buffer.concat([frames.remaining, Buffer.from(header.slice(10) + msg)]);
    frames = TMDJSONRPCCodec.decodeBuffer(buffer);
    expect(frames.frames).toHaveLength(1);
    expect(frames.frames[0].id).toBe(2);
    expect(frames.frames[0].method).toBe("shutdown");
    expect(frames.remaining.length).toBe(0);
  });

  it("provides section name completions after '-> ' in playback orders", () => {
    const source = `::SCORE::
** Test Score **
!= 120
?= C
<4/4>

intro:Piano@|0|{
    <4*>
    1 2 3 4
}

verse:Piano@|0|{
    <4*>
    1 2 3 4
}

Theme {
    <4*>
    1 2 3 4
}

-> `;
    // Position at last line, after "-> "
    const lines = source.split("\n");
    const lastLineIndex = lines.length - 1;
    const items = TMDLSPCompletionEngine.complete(
      source,
      new TMDLSPPosition(lastLineIndex, lines[lastLineIndex].length)
    );
    const labels = items.map((i) => i.label);
    expect(labels).toContain("intro");
    expect(labels).toContain("verse");
    expect(labels).toContain("Theme");
  });

  it("provides S-expression macro snippets after '-> (' in playback orders", () => {
    const source = `::SCORE::
** Test Score **
!= 120
?= C
<4/4>

Theme {
    <4*>
    1 2 3 4
}

-> (`;
    const lines = source.split("\n");
    const lastLineIndex = lines.length - 1;
    const items = TMDLSPCompletionEngine.complete(
      source,
      new TMDLSPPosition(lastLineIndex, lines[lastLineIndex].length)
    );
    const labels = items.map((i) => i.label);
    expect(labels).toContain("canon");
    expect(labels).toContain("loop");
    expect(labels).toContain("layer");
    expect(labels).toContain("seq");
    expect(labels).toContain("reverse");
    expect(labels).toContain("flip");
    expect(labels).toContain("transpose");
    expect(labels).toContain("vary");

    const canonItem = items.find((i) => i.label === "canon");
    expect(canonItem?.insertText?.startsWith("(")).toBe(false);
    expect(canonItem?.insertText?.startsWith("canon")).toBe(true);
  });

  it("provides General MIDI 128 instrument names after colon in paragraph header", () => {
    const source = `::SCORE::
** Test Score **
!= 120
?= C
<4/4>

verse:`;
    const lines = source.split("\n");
    const lastLineIndex = lines.length - 1;
    const items = TMDLSPCompletionEngine.complete(
      source,
      new TMDLSPPosition(lastLineIndex, lines[lastLineIndex].length)
    );
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Piano");
    expect(labels).toContain("Violin");
    expect(labels).toContain("AcousticGuitar");
    expect(labels).toContain("Timpani");
    expect(labels).toContain("Drums");
  });

  it("provides diatonic chords when opening bracket '[' inside paragraph", () => {
    const source = `::SCORE::
** Test Score **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    [`;
    const lines = source.split("\n");
    const lastLineIndex = lines.length - 1;
    const items = TMDLSPCompletionEngine.complete(
      source,
      new TMDLSPPosition(lastLineIndex, lines[lastLineIndex].length)
    );
    const labels = items.map((i) => i.label);
    expect(labels).toContain("C");
    expect(labels).toContain("Dm");
    expect(labels).toContain("Em");
    expect(labels).toContain("F");
    expect(labels).toContain("G");
    expect(labels).toContain("Am");
  });

  it("publishes diagnostics on beat discrepancies in measures", () => {
    const invalidSource = `::SCORE::
** Measure Error Score **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    | 1 2 3 |
}

-> verse ->#
`;
    const diags = TMDLSPDiagnosticEngine.diagnose(invalidSource);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].message).toMatch(/3 units|expected 4/i);
    expect(diags[0].severity).toBe(1); // Error
  });

  it("server handles initialize, document change, completion, formatting, and documentSymbol", () => {
    const outputMessages: string[] = [];
    const server = new TMDLSPServer((out) => {
      outputMessages.push(out);
    });

    // 1. Initialize
    server.handle({
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(outputMessages).toHaveLength(1);
    const initResp = JSON.parse(outputMessages[0].split("\r\n\r\n")[1]);
    expect(initResp.result.capabilities.completionProvider).toBeDefined();
    expect(initResp.result.capabilities.documentFormattingProvider).toBe(true);
    expect(initResp.result.capabilities.documentSymbolProvider).toBe(true);

    outputMessages.length = 0;

    // 2. didOpen with invalid score -> publishes diagnostics
    const uri = "file:///test.tmd";
    server.handle({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          text: `::SCORE::
** Invalid **
!= 120
?= C
<4/4>

verse:Piano@|0|{
    <4*>
    | 1 2 3 |
}
-> verse ->#
`,
        },
      },
    });

    expect(outputMessages).toHaveLength(1);
    const diagNote = JSON.parse(outputMessages[0].split("\r\n\r\n")[1]);
    expect(diagNote.method).toBe("textDocument/publishDiagnostics");
    expect(diagNote.params.diagnostics.length).toBeGreaterThan(0);

    outputMessages.length = 0;

    // 3. Formatting
    server.handle({
      id: 2,
      method: "textDocument/formatting",
      params: {
        textDocument: { uri },
      },
    });
    expect(outputMessages).toHaveLength(1);
    const formatResp = JSON.parse(outputMessages[0].split("\r\n\r\n")[1]);
    expect(formatResp.result).toHaveLength(1);
    expect(formatResp.result[0].newText).toContain("::SCORE::");

    outputMessages.length = 0;

    // 4. Document symbols
    server.handle({
      id: 3,
      method: "textDocument/documentSymbol",
      params: {
        textDocument: { uri },
      },
    });
    expect(outputMessages).toHaveLength(1);
    const symbolResp = JSON.parse(outputMessages[0].split("\r\n\r\n")[1]);
    expect(symbolResp.result.length).toBeGreaterThan(0);

    outputMessages.length = 0;

    // 5. Shutdown and exit
    server.handle({ id: 4, method: "shutdown" });
    expect(outputMessages).toHaveLength(1);
    const shutdownResp = JSON.parse(outputMessages[0].split("\r\n\r\n")[1]);
    expect(shutdownResp.result).toBeNull();

    expect(server.isRunning).toBe(true);
    server.handle({ method: "exit" });
    expect(server.isRunning).toBe(false);
  });

  it("CLI dispatches lsp subcommand with help info", async () => {
    const { main } = await import("../src/cli.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCode = main(["lsp", "-h"]);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("USAGE: tmd lsp"));
    logSpy.mockRestore();
  });
});

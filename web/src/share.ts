// Share a score through the URL hash ("#tmd=..."). Browsers do not send the hash
// to the server, so the static site needs no backend to share scores.
// Format: UTF-8 text -> deflate-raw -> base64url.

const PREFIX = "#tmd=";

// A short hash can expand to a very large text. Stop before it freezes the tab.
export const MAX_SHARED_CHARS = 1_000_000;

export async function encodeShareHash(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns null when the hash is not a share link.
// Throws when the payload is damaged or expands past MAX_SHARED_CHARS.
export async function decodeShareHash(hash: string): Promise<string | null> {
  if (!hash.startsWith(PREFIX)) return null;
  const binary = atob(hash.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > MAX_SHARED_CHARS) {
      await reader.cancel();
      throw new Error("Shared score is too large");
    }
  }
  return text + decoder.decode();
}

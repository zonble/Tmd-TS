const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Escape a value before it goes into an innerHTML template,
// as element text or as a quoted attribute value.
export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

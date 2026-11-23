// A tiny reader for the Markdown the assistant writes: paragraphs, "- " or "1. " lists,
// **bold** and [links](/product/7). It builds plain data that the template shows with
// text bindings, never innerHTML, so nothing in a reply can run as HTML.
// Only links inside this site (starting with "/") become links; anything else stays as text.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; path: string };

export type Block =
  | { kind: 'paragraph'; parts: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] };

const LIST_ITEM = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseChatMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', parts: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };

  for (const line of source.replace(/\r/g, '').split('\n')) {
    const item = LIST_ITEM.exec(line);
    if (item) {
      endParagraph();
      const ordered = item[1] !== undefined;
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(parseInline(item[2]));
      else blocks.push({ kind: 'list', ordered, items: [parseInline(item[2])] });
    } else if (line.trim() === '') {
      endParagraph();
    } else {
      paragraph.push(line.trim().replace(/^#+\s*/, ''));     // headings show as plain lines
    }
  }
  endParagraph();
  return blocks;
}

function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > at) parts.push({ kind: 'text', text: text.slice(at, match.index) });

    if (match[1] !== undefined) {
      parts.push({ kind: 'bold', text: match[1] });
    } else {
      const [, , label, path] = match;
      parts.push(isSitePath(path) ? { kind: 'link', text: label, path } : { kind: 'text', text: label });
    }
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}

// "/product/7" yes; "//evil.site", "https://...", "javascript:..." no
function isSitePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

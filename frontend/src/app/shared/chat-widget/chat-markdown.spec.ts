import { Block, Inline, parseChatMarkdown } from './chat-markdown';

// Helpers that make the expectations short
const text = (t: string): Inline => ({ kind: 'text', text: t });
const bold = (t: string): Inline => ({ kind: 'bold', text: t });
const link = (t: string, path: string): Inline => ({ kind: 'link', text: t, path });
const para = (...parts: Inline[]): Block => ({ kind: 'paragraph', parts });

describe('parseChatMarkdown', () => {
  it('reads plain text as one paragraph', () => {
    expect(parseChatMarkdown('Hello there')).toEqual([para(text('Hello there'))]);
  });

  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(parseChatMarkdown('First line\ncontinues\n\nSecond')).toEqual([
      para(text('First line continues')),
      para(text('Second'))
    ]);
  });

  it('reads bold text and links to pages of this site', () => {
    expect(parseChatMarkdown('The **Kurta Set** is [here](/product/1).')).toEqual([
      para(text('The '), bold('Kurta Set'), text(' is '), link('here', '/product/1'), text('.'))
    ]);
  });

  it('reads bullet lists in any of the usual styles', () => {
    expect(parseChatMarkdown('- one\n* two\n• three')).toEqual([
      { kind: 'list', ordered: false, items: [[text('one')], [text('two')], [text('three')]] }
    ]);
  });

  it('reads numbered lists and keeps them apart from bullet lists', () => {
    expect(parseChatMarkdown('1. first\n2) second\n- bullet')).toEqual([
      { kind: 'list', ordered: true, items: [[text('first')], [text('second')]] },
      { kind: 'list', ordered: false, items: [[text('bullet')]] }
    ]);
  });

  it('keeps links inside list items', () => {
    expect(parseChatMarkdown('- [KY-1003](/order/1003) is **Shipped**')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [[link('KY-1003', '/order/1003'), text(' is '), bold('Shipped')]]
      }
    ]);
  });

  it('shows headings as plain lines', () => {
    expect(parseChatMarkdown('## Your orders')).toEqual([para(text('Your orders'))]);
  });

  it('handles Windows line endings', () => {
    expect(parseChatMarkdown('a\r\n\r\nb')).toEqual([para(text('a')), para(text('b'))]);
  });

  describe('safety', () => {
    it.each([
      ['https://evil.example', 'another site'],
      ['//evil.example', 'a protocol-relative address'],
      ['/\\evil.example', 'a backslash trick'],
      ['javascript:alert(1)', 'a script address']
    ])('never turns %s (%s) into a link', (address) => {
      const parts = (parseChatMarkdown(`[click](${address})`)[0] as { parts: Inline[] }).parts;

      expect(parts.some(p => p.kind === 'link')).toBe(false);
      expect(parts[0]).toEqual(text('click'));
    });

    it('keeps HTML as plain text, never as markup', () => {
      const html = '<img src=x onerror=alert(1)>';

      // The template shows parts with {{ }} bindings, which escape this text
      expect(parseChatMarkdown(html)).toEqual([para(text(html))]);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { parseBlocks } from './knowledgeBody';

describe('knowledge article text', () => {
  it('splits headings, bullets, numbered items and paragraphs', () => {
    expect(parseBlocks('## Scope\nLine one\nline two\n\n- a\n- b\n\n1. first\n2) second\n### Detail\nEnd')).toEqual([
      { kind: 'h', level: 2, text: 'Scope' },
      { kind: 'p', text: 'Line one line two' },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'ol', items: ['first', 'second'] },
      { kind: 'h', level: 3, text: 'Detail' },
      { kind: 'p', text: 'End' },
    ]);
  });

  it('keeps markup typed by an author as plain text and ignores empty input', () => {
    expect(parseBlocks('<script>alert(1)</script>')).toEqual([{ kind: 'p', text: '<script>alert(1)</script>' }]);
    expect(parseBlocks('  \n\n')).toEqual([]);
  });
});

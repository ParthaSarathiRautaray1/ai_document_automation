/**
 * Pure PDF HTML builder (Module 8 · Task 1). No I/O — asserts the produced markup
 * escapes user content, preserves the rendered body, and derives a safe filename.
 */
import { buildDocumentHtml, escapeHtml, pdfFilename } from '../src/features/documents/pdf.html.js';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;'
    );
  });

  it('renders null/undefined as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('pdfFilename', () => {
  it('slugifies the title and appends .pdf', () => {
    expect(pdfFilename({ title: 'March 2026 Invoice #7' })).toBe('march-2026-invoice-7.pdf');
  });

  it('falls back to document.pdf when the title has no usable characters', () => {
    expect(pdfFilename({ title: '   ' })).toBe('document.pdf');
    expect(pdfFilename({})).toBe('document.pdf');
  });
});

describe('buildDocumentHtml', () => {
  it('produces a full HTML page with the title, meta, and content', () => {
    const html = buildDocumentHtml({
      title: 'Acme Invoice',
      type: 'invoice',
      status: 'final',
      content: 'Dear Ada — total 42',
      templateSnapshot: { name: 'Invoice' },
      createdAt: '2026-07-11T00:00:00.000Z',
    });

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<title>Acme Invoice</title>');
    expect(html).toContain('Dear Ada — total 42');
    expect(html).toContain('<span>final</span>');
    expect(html).toContain('<span>invoice</span>');
    expect(html).toContain('from Invoice');
  });

  it('escapes malicious content so it cannot inject markup', () => {
    const html = buildDocumentHtml({
      title: '<script>alert(1)</script>',
      content: 'Hello <img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Hello &lt;img src=x onerror=alert(1)&gt;');
  });

  it('omits optional meta parts when absent', () => {
    const html = buildDocumentHtml({ title: 'Bare', content: 'body' });
    expect(html).toContain('<title>Bare</title>');
    expect(html).toContain('body');
    expect(html).not.toContain('from ');
  });
});

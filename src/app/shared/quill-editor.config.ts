import Quill from 'quill';

export const QUILL_FONT_WHITELIST = [
  '',
  'cairo',
  'tajawal',
  'amiri',
  'noto-naskh',
  'reem-kufi',
  'lateef',
  'scheherazade',
  'rakkas',
  'mada',
  'ibm-plex-arabic',
  'harmattan',
  'markazi',
  'aref-ruqaa',
  'el-messiri',
  'jomhuria',
  'mirza',
  'katibeh',
  'lalezar',
  'serif',
  'monospace',
  'arial',
  'times-new-roman',
];

export const QUILL_SIZE_WHITELIST = [
  '10px',
  '11px',
  '12px',
  '13px',
  '14px',
  '15px',
  '16px',
  '18px',
  '20px',
  '22px',
  '24px',
  '26px',
  '28px',
  '32px',
  '36px',
  '40px',
  '48px',
  '56px',
  '72px',
];

let formatsRegistered = false;

export function registerQuillFormats(): void {
  if (formatsRegistered) return;

  const Font = Quill.import('formats/font') as any;
  Font.whitelist = QUILL_FONT_WHITELIST;
  Quill.register(Font, true);

  const SizeStyle = Quill.import('attributors/style/size') as any;
  SizeStyle.whitelist = QUILL_SIZE_WHITELIST;
  Quill.register(SizeStyle, true);

  formatsRegistered = true;
}

export const RICH_TEXT_EDITOR_MODULES = {
  toolbar: {
    container: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ direction: 'rtl' }],
      [{ align: ['right', 'center', 'left', 'justify'] }],
      [{ font: QUILL_FONT_WHITELIST }],
      [{ size: QUILL_SIZE_WHITELIST }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  },
};

export const COMPACT_RICH_TEXT_EDITOR_MODULES = {
  toolbar: {
    container: [
      ['bold', 'italic', 'underline'],
      [{ direction: 'rtl' }],
      [{ align: ['right', 'center', 'left'] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  },
};

export const RICH_TEXT_EDITOR_STYLES = {
  'min-height': '180px',
};

export const COMPACT_RICH_TEXT_EDITOR_STYLES = {
  'min-height': '120px',
};

export function htmlToPlainText(html: string): string {
  if (!html) return '';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  return (tempDiv.textContent || tempDiv.innerText || '')
    .replace(/[\r\n\t\u00A0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDescriptionArray(description: string | string[]): string[] {
  if (!description) return [];
  if (Array.isArray(description)) return description;
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // not JSON, return as single item
  }
  return [description];
}

export interface DescriptionPart {
  type: 'text' | 'table';
  content: string;
}

export function extractDescriptionParts(description: string | string[]): DescriptionPart[] {
  const items = parseDescriptionArray(description);
  return items
    .map((item) => {
      if (!item || !item.trim()) return null;
      if (item.includes('<table') || item.includes('table-responsive') || item.includes('<td')) {
        return { type: 'table' as const, content: item };
      }
      return { type: 'text' as const, content: item };
    })
    .filter((item): item is DescriptionPart => item !== null);
}

export function getTextFromDescription(description: string | string[]): string {
  const parts = extractDescriptionParts(description);
  const textParts = parts.filter((p) => p.type === 'text').map((p) => p.content);
  return textParts.join(' ');
}

export function getTablesFromDescription(description: string | string[]): string[] {
  const parts = extractDescriptionParts(description);
  return parts.filter((p) => p.type === 'table').map((p) => p.content);
}


export function formatPlainTextAsHtml(text: string): string {
  if (!text) return '';

  return text
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('');
}

export function cleanRichTextHtml(value: string): string {
  if (!value) return '';

  const html = value.includes('<') && value.includes('>')
    ? value
    : formatPlainTextAsHtml(value);

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .trim();
}

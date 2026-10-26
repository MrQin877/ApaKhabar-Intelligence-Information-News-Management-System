export function richTextPlain(value: string): string {
    const spaced = value
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/(?:p|div|li|blockquote)>/gi, '\n');
    if (typeof DOMParser !== 'undefined') {
        const document = new DOMParser().parseFromString(spaced, 'text/html');
        document
            .querySelectorAll('script, style')
            .forEach((node) => node.remove());
        return (document.body.textContent ?? '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim();
    }
    return spaced
        .replace(/<[^>]*>/g, '')
        .replace(/&(?:nbsp|#160);/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
}

export const richTextLength = (value: string) =>
    Array.from(richTextPlain(value)).length;

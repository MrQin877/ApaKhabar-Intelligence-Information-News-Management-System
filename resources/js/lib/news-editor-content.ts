/** Allow only the formatting supported by the news toolbar. */
export function newsEditorContent(value: string): { html: string; text: string } {
    if (typeof DOMParser === 'undefined') return { html: '', text: value };
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const input = /<\/?(?:p|div|br|b|strong|i|em|u|ul|ol|li|blockquote|span)\b/i.test(value)
        ? value : value.split(/\n\s*\n/).map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`).join('');
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const allowed = new Set(['P','DIV','BR','B','STRONG','I','EM','U','UL','OL','LI','BLOCKQUOTE','SPAN']);
    for (const element of Array.from(doc.body.querySelectorAll('*'))) {
        if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH'].includes(element.tagName)) { element.remove(); continue; }
        if (!allowed.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
        const align = (element as HTMLElement).style.textAlign || element.getAttribute('align');
        for (const attr of Array.from(element.attributes)) element.removeAttribute(attr.name);
        if (align && ['left','center','right'].includes(align)) (element as HTMLElement).style.textAlign = align;
    }
    const html = doc.body.innerHTML;
    for (const block of Array.from(doc.body.querySelectorAll('p,div,li,blockquote,br'))) block.append(' ');
    return { html, text: doc.body.textContent ?? '' };
}

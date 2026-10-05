/** Upload routing: source restrictions are not a refusal to generate news. */
export function requestsNewsGeneration(prompt: string): boolean {
    const text = prompt.replace(/[’]/g, "'");
    const action = /\b(generate|create|write|make|buatkan|buat|bikin|tuliskan|tulis|susunkan|susun|hasilkan)\b[^.!?;\n]{0,80}\b(news|article|berita|artikel|laporan|pengumuman|announcement)\b/i;
    const negativeAction = /\b(jangan|belum|tidak perlu|tak perlu|do not|don't|not yet)\s+(?:(?:tolong|please|langsung|segera|dulu|pernah)\s+)*(?:generate|create|write|make|buatkan|buat|bikin|tuliskan|tulis|susunkan|susun|hasilkan|membuat|menulis)\b/i;
    const explicitWait = /\b(tunggu(?: dulu)?|wait|not now|nanti saja|simpan saja|store only|save only)\b/i;
    const passiveRefusal = /\b(?:berita|artikel|news|article)\s+(?:jangan|belum)\s+(?:dibuat|ditulis|dihasilkan)\b/i;
    return action.test(text) && !negativeAction.test(text) && !explicitWait.test(text) && !passiveRefusal.test(text);
}

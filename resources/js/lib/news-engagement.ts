/** Track visible elapsed time once per mounted article, excluding hidden intervals. */
export function visibleReadingClock(start: number) {
    let last = start;
    let elapsed = 0;
    let recorded = false;

    return {
        reset(now: number) {
            last = now;
        },
        tick(now: number, visible: boolean): boolean {
            if (visible) {
                elapsed += Math.max(0, Math.min(now - last, 1000));
            }

            last = now;

            if (recorded || elapsed < 5500) {
                return false;
            }

            recorded = true;

            return true;
        },
    };
}

export async function copyArticleLink(
    articleId: number,
    origin: string,
    clipboard?: Pick<Clipboard, 'writeText'>,
): Promise<string> {
    const url = new URL(`/news/${encodeURIComponent(articleId)}`, origin).href;

    try {
        if (!clipboard) {
            throw new Error('Clipboard unavailable');
        }

        await clipboard.writeText(url);

        return 'Tautan berhasil disalin!';
    } catch {
        return `Tidak dapat menyalin otomatis. Salin tautan ini: ${url}`;
    }
}

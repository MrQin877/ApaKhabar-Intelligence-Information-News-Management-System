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

/** Group descendants under their original comment without changing reply targets. */
export function commentThreads<
    T extends { id: string; parent_id?: string | null },
>(comments: T[]) {
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    const roots: T[] = [];
    const replies = new Map<string, T[]>();
    const rootIds = new Map<string, string>();

    for (const comment of comments) {
        let root = comment;
        const seen = new Set([root.id]);

        while (root.parent_id && byId.has(root.parent_id)) {
            const parent = byId.get(root.parent_id)!;

            if (seen.has(parent.id)) {
                break;
            }

            seen.add(parent.id);
            root = parent;
        }

        rootIds.set(comment.id, root.id);

        if (root.id === comment.id) {
            roots.push(comment);
        } else {
            replies.set(root.id, [...(replies.get(root.id) ?? []), comment]);
        }
    }

    return { roots, replies, rootIds, byId };
}

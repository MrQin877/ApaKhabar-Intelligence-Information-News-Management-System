// Compare persisted fields, excluding transient dialogs, previews and platform choices.
const files = new WeakMap<File, number>();
let fileId = 0;
function stable(value: unknown): unknown {
    if (typeof File !== 'undefined' && value instanceof File) {
        if (!files.has(value)) {
            files.set(value, ++fileId);
        }

        return { file: files.get(value) };
    }

    if (Array.isArray(value)) {
        return value.map(stable);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, stable(item)]),
        );
    }

    return value ?? null;
}
export function editorSnapshot(value: unknown): string {
    return JSON.stringify(stable(value));
}
export function manualSnapshot(data: Record<string, unknown>): string {
    let content = String(data.content ?? '').trim();

    if (
        !/<(?:img|video|iframe)\b/i.test(content) &&
        !content
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;|&#160;|[\s\u200B-\u200D\uFEFF]/g, '')
    ) {
        content = '';
    }

    return editorSnapshot({
        headline: data.headline,
        content,
        content_format: data.content_format,
        show_on_homepage: data.show_on_homepage,
        cover_photo: data.cover_photo,
        category_id: String(data.category_id ?? ''),
        image: data.image,
        image_crops: data.image_crops,
    });
}

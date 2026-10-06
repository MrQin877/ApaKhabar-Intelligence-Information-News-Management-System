import type { ImageCrops } from './image-crops';

export type SavedManualDraft = {
    id: number;
    image: string | null;
    image_crops: ImageCrops | null;
    content_html: string;
};

export async function saveManualDraft(
    data: Record<string, unknown>,
    id?: number,
): Promise<SavedManualDraft> {
    const body = new FormData();

    for (const [key, value] of Object.entries(data)) {
        if (key === 'platforms' || value === null) {
            continue;
        }

        body.append(
            key,
            value instanceof File
                ? value
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : typeof value === 'boolean'
                    ? value
                        ? '1'
                        : '0'
                    : String(value),
        );
    }

    body.append('intent', 'draft');

    if (id) {
        body.append('_method', 'put');
    }

    const cookie = document.cookie
        .split('; ')
        .find((value) => value.startsWith('XSRF-TOKEN='));
    const csrf = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    )?.content;
    const response = await fetch(
        id ? `/admin/news/manual/${id}` : '/admin/news/manual',
        {
            method: 'POST',
            credentials: 'same-origin',
            body,
            headers: {
                Accept: 'application/json',
                ...(cookie
                    ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)) }
                    : csrf
                      ? { 'X-CSRF-TOKEN': csrf }
                      : {}),
            },
        },
    ).catch(() => {
        throw new Error(
            'Draf belum berhasil disimpan. Periksa koneksi dan coba lagi.',
        );
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.draft?.id) {
        throw new Error(
            Object.values(result.errors ?? {})
                .flat()
                .join(' ') ||
                'Draf belum berhasil disimpan. Silakan coba lagi.',
        );
    }

    return result.draft;
}

export function hasManualContent(data: {
    headline: string;
    content: string;
    image: string;
    cover_photo: File | null;
    category_id: string;
}) {
    return Boolean(
        data.headline.trim() ||
        data.image ||
        data.cover_photo ||
        data.category_id ||
        /<img\b/i.test(data.content) ||
        data.content
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;|&#160;|[\s\u200B-\u200D\uFEFF]/g, ''),
    );
}

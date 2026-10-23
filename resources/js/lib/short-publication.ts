import type { PublishResult } from '@/lib/manual-publish';

export function publicationActive(result?: PublishResult) {
    if (result?.pending !== undefined) {
        return result.pending;
    }

    return (
        !result ||
        Object.values(result.results).some((value) =>
            ['queued', 'uploading', 'processing'].includes(
                value.status ?? 'queued',
            ),
        )
    );
}

export function publicationPolling(result?: PublishResult) {
    return publicationActive(result) || result?.permalink_pending === true;
}

export function publicationUrl(
    platform: string,
    status?: string,
    permalink?: string | null,
    videoId?: number,
) {
    if (status !== 'published') {
        return null;
    }

    if (platform === 'website') {
        return videoId ? `/shorts/${videoId}` : null;
    }

    if (!['instagram', 'facebook'].includes(platform)) {
        return null;
    }

    try {
        const url = new URL(permalink ?? '');
        const domain =
            platform === 'instagram' ? 'instagram.com' : 'facebook.com';

        return url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
            ? url.href
            : null;
    } catch {
        return null;
    }
}

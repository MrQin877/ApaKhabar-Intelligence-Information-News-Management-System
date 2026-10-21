export type PublishResult = {
    pending?: boolean;
    success: boolean;
    attempt_id: string;
    retry_url?: string;
    completion_url?: string;
    results: Record<
        string,
        {
            success: boolean;
            message: string;
            account?: string | null;
            permalink?: string | null;
            status?:
                | 'published'
                | 'failed'
                | 'processing'
                | 'uploading'
                | 'queued'
                | 'uncertain'
                | 'not_selected';
        }
    >;
};

// Allow slow media publishing to finish, but never leave the editor waiting forever.
const PUBLISH_TIMEOUT_MS = 5 * 60 * 1000;

export async function publishManual(
    path: string,
    body: FormData,
    platforms: string[],
): Promise<PublishResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);
    const attemptId = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
        const csrf = document.querySelector<HTMLMetaElement>(
            'meta[name="csrf-token"]',
        )?.content;
        const cookie = document.cookie
            .split('; ')
            .find((value) => value.startsWith('XSRF-TOKEN='));
        // Send exactly once. A lost response does not mean the server failed to publish.
        const response = await fetch(path, {
            method: 'POST',
            credentials: 'same-origin',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(cookie
                    ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)) }
                    : csrf
                      ? { 'X-CSRF-TOKEN': csrf }
                      : {}),
            },
            body,
        });
        const data = await response.json();
        const results: PublishResult['results'] = {};

        for (const platform of platforms) {
            const key = platform === 'website' ? 'application' : platform;
            const result = data.results?.[key];
            results[key] =
                typeof result?.success === 'boolean'
                    ? {
                          success: result.success,
                          message:
                              typeof result.message === 'string'
                                  ? result.message
                                  : '',
                      }
                    : {
                          success: false,
                          message:
                              'Hasil penerbitan tidak diterima. Periksa Daftar Berita sebelum mencoba kembali.',
                      };
        }

        return {
            success: Object.values(results).every((result) => result.success),
            attempt_id:
                typeof data.attempt_id === 'string'
                    ? data.attempt_id
                    : attemptId,
            completion_url: '/admin/news',
            results,
        };
    } catch {
        return {
            success: false,
            attempt_id: attemptId,
            completion_url: '/admin/news',
            results: Object.fromEntries(
                platforms.map((platform) => [
                    platform === 'website' ? 'application' : platform,
                    {
                        success: false,
                        message: controller.signal.aborted
                            ? 'Waktu tunggu hasil penerbitan habis. Proses server mungkin masih berjalan. Periksa Daftar Berita sebelum mencoba kembali.'
                            : 'Hasil penerbitan tidak dapat diterima. Periksa Daftar Berita sebelum mencoba kembali; sebagian platform mungkin sudah berhasil.',
                    },
                ]),
            ),
        };
    } finally {
        clearTimeout(timeout);
    }
}

export interface MetaAuthConfig {
    facebookAppId: string | null;
    graphVersion: string;
    instagramConfigured: boolean;
}
export async function metaRequest<T>(
    path: string,
    payload?: Record<string, string>,
): Promise<T> {
    const csrf = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    )?.content;
    const cookie = document.cookie
        .split('; ')
        .find((value) => value.startsWith('XSRF-TOKEN='));
    const response = await fetch(path, {
        method: payload ? 'POST' : 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(cookie
                ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)) }
                : csrf
                  ? { 'X-CSRF-TOKEN': csrf }
                  : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.errors?.connection?.[0] ??
                data.message ??
                'Koneksi tidak dapat diperbarui.',
        );
    }

    return data as T;
}

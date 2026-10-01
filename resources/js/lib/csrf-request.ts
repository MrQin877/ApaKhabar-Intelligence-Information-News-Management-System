/** Same-origin JSON mutations using Laravel's current session token. */
export async function csrfPost(
    url: string,
    payload: unknown,
): Promise<Response> {
    if (!url.startsWith('/') || url.startsWith('//')) {
        throw new Error('Only same-origin requests are allowed.');
    }

    const body = JSON.stringify(payload);
    const send = () => {
        const cookie = document.cookie
            .split(';')
            .map((v) => v.trim())
            .find((v) => v.startsWith('XSRF-TOKEN='));
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        if (cookie) {
            headers['X-XSRF-TOKEN'] = decodeURIComponent(
                cookie.slice('XSRF-TOKEN='.length),
            );
        } else {
            headers['X-CSRF-TOKEN'] =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
        }

        return fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body,
        });
    };
    let response = await send();

    // Laravel rejects 419 before executing the action. Do not retry other failures.
    if (response.status === 419) {
        const refresh = await fetch('/sanctum/csrf-cookie', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });

        if (refresh.ok) {
            response = await send();
        }
    }

    if (
        response.status === 419 ||
        response.status === 401 ||
        response.redirected
    ) {
        throw new Error(
            'Sesi telah berakhir. Muat ulang halaman dan masuk kembali bila diminta, lalu kirim ulang pesan.',
        );
    }

    return response;
}

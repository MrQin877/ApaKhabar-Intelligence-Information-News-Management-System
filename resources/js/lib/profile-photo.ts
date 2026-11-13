export const invalidPhotoMessage =
    'Foto tidak sah. Sila pilih fail JPG, PNG atau WEBP dengan saiz maksimum 5 MB.';
export function validatePhoto(file: File) {
    if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024 ||
        !file.size
    ) {
        throw new Error(invalidPhotoMessage);
    }
}
export function cropArea(
    width: number,
    height: number,
    zoom: number,
    x: number,
    y: number,
) {
    const size = Math.min(width, height) / Math.max(1, Math.min(3, zoom));

    return {
        size,
        x: (width - size) * Math.max(0, Math.min(1, x)),
        y: (height - size) * Math.max(0, Math.min(1, y)),
    };
}
export async function mutatePhoto(file: Blob | null) {
    const body = file ? new FormData() : undefined;

    if (file) {
        body!.append('photo', file, 'profile.jpg');
    }

    const send = () => {
        const cookie = document.cookie
            .split(';')
            .map((v) => v.trim())
            .find((v) => v.startsWith('XSRF-TOKEN='));

        return fetch('/settings/profile/photo', {
            method: file ? 'POST' : 'DELETE',
            credentials: 'same-origin',
            body,
            headers: {
                Accept: 'application/json',
                ...(cookie
                    ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)) }
                    : {
                          'X-CSRF-TOKEN':
                              document.querySelector<HTMLMetaElement>(
                                  'meta[name="csrf-token"]',
                              )?.content ?? '',
                      }),
            },
        });
    };
    let response = await send();

    if (response.status === 419) {
        const refresh = await fetch('/sanctum/csrf-cookie', {
            credentials: 'same-origin',
        });

        if (refresh.ok) {
            response = await send();
        }
    }

    if (
        response.redirected ||
        response.status === 401 ||
        response.status === 419
    ) {
        throw new Error(
            'Sesi telah berakhir. Sila muat semula halaman dan log masuk.',
        );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            Object.values(data.errors ?? {})
                .flat()
                .join(' ') ||
                data.message ||
                'Foto tidak dapat disimpan. Sila cuba lagi.',
        );
    }

    return data as { avatar: string | null };
}

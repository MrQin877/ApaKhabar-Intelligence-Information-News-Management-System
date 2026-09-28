import { apiFetch } from '@/lib/api';
export interface PhoneResetStatus {
    challenge: string;
    phone: string;
    otp_pending: boolean;
    retry_after: number;
    daily_limit_reached: boolean;
    daily_reset_after: number;
    reset_token?: string;
}

export class PhoneResetError extends Error {
    constructor(
        message: string,
        public data: Partial<PhoneResetStatus> & {
            errors?: Record<string, string[]>;
        },
    ) {
        super(message);
    }
}

function csrfToken(): string | undefined {
    const cookie = document.cookie
        .split('; ')
        .find((value) => value.startsWith('XSRF-TOKEN='));

    return cookie
        ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
        : undefined;
}

async function refreshCsrfToken(signal: AbortSignal): Promise<void> {
    const response = await apiFetch('/sanctum/csrf-cookie', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
    });

    if (!response.ok) {
        throw new PhoneResetError(
            'Sesi tidak dapat dimuat semula. Sila muat semula halaman dan cuba lagi.',
            {},
        );
    }
}

// The same purpose-scoped API serves browser and Expo. No logged-in session is required.
export async function phoneResetRequest(
    action: 'send' | 'verify' | 'reset' | 'status',
    payload: Record<string, string>,
): Promise<PhoneResetStatus> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);

    try {
        const mutating = action !== 'status';

        if (mutating && !csrfToken()) {
            await refreshCsrfToken(controller.signal);
        }

        const send = () => {
            const token = csrfToken();

            return apiFetch(
                `/api/phone/password/${action}${action === 'status' ? `?${new URLSearchParams(payload)}` : ''}`,
                {
                    method: mutating ? 'POST' : 'GET',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        ...(mutating && token ? { 'X-XSRF-TOKEN': token } : {}),
                    },
                    body: mutating ? JSON.stringify(payload) : undefined,
                    signal: controller.signal,
                },
            );
        };
        let response = await send();

        // A CSRF rejection happens before OTP delivery. Refresh and retry only once.
        if (mutating && response.status === 419) {
            await refreshCsrfToken(controller.signal);
            response = await send();
        }

        const data = await response.json();

        if (!response.ok) {
            throw new PhoneResetError(
                data.message ?? 'Permintaan gagal. Sila cuba lagi.',
                data,
            );
        }

        return data;
    } finally {
        window.clearTimeout(timeout);
    }
}

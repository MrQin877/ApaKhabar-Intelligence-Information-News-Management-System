import { apiFetch } from '@/lib/api';

export interface MetaAuthConfig {
    facebookAppId: string | null;
    graphVersion: string;
    instagramConfigured: boolean;
}
export interface FacebookResponse {
    status?: string;
    authResponse?: { accessToken: string };
}
interface FacebookSdk {
    init: (options: {
        appId: string;
        version: string;
        xfbml: boolean;
        cookie: boolean;
        status: boolean;
    }) => void;
    XFBML: { parse: (element: HTMLElement, callback?: () => void) => void };
    getLoginStatus: (callback: (response: FacebookResponse) => void) => void;
}
declare global {
    interface Window {
        FB?: FacebookSdk;
        apakhabarFacebookLogin?: () => void;
    }
}

let sdk: Promise<FacebookSdk> | undefined;

export function loadFacebookSdk(config: MetaAuthConfig): Promise<FacebookSdk> {
    if (!config.facebookAppId) {
        return Promise.reject(new Error('Facebook belum dikonfigurasi.'));
    }

    if (sdk) {
        return sdk;
    }

    sdk = new Promise<FacebookSdk>((resolve, reject) => {
        const initialize = () => {
            if (!window.FB) {
                reject(new Error('Facebook SDK tidak tersedia.'));

                return;
            }

            window.FB.init({
                appId: config.facebookAppId!,
                version: config.graphVersion,
                xfbml: false,
                cookie: false,
                status: false,
            });
            resolve(window.FB);
        };

        if (window.FB) {
            initialize();

            return;
        }

        const script = document.createElement('script');

        if (!document.getElementById('fb-root')) {
            const root = document.createElement('div');
            root.id = 'fb-root';
            document.body.appendChild(root);
        }

        script.id = 'facebook-jssdk';
        script.async = true;
        script.defer = true;
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        const timeout = window.setTimeout(() => {
            script.remove();
            reject(
                new Error(
                    'Facebook SDK tidak dapat dimuat. Periksa koneksi atau pemblokir konten.',
                ),
            );
        }, 15000);
        script.onload = () => {
            window.clearTimeout(timeout);
            initialize();
        };
        script.onerror = () => {
            window.clearTimeout(timeout);
            script.remove();
            reject(new Error('Facebook SDK tidak dapat dimuat.'));
        };
        document.head.appendChild(script);
    }).catch((error) => {
        sdk = undefined;

        throw error;
    });

    return sdk;
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
    const response = await apiFetch(path, {
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

// Empty means the Laravel page's origin, including localhost or a LAN hostname.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');

export function apiUrl(path: string): string {
    return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

export function apiFetch(
    path: string,
    options?: RequestInit,
): Promise<Response> {
    return fetch(apiUrl(path), options);
}

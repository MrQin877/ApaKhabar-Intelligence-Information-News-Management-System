export class PasswordResetError extends Error {
    public errors: Record<string, string>;

    constructor(message: string, errors: Record<string, string> = {}) {
        super(message);
        this.errors = errors;
    }
}

export async function readPasswordResetResponse(
    response: Response,
): Promise<void> {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const errors: Record<string, string> = {};

        for (const [field, messages] of Object.entries(data?.errors ?? {})) {
            if (Array.isArray(messages) && typeof messages[0] === 'string') {
                errors[field] = messages[0];
            }
        }

        throw new PasswordResetError(
            response.status === 429
                ? 'Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba kembali.'
                : data?.message ||
                      'Kata sandi belum berhasil diubah. Periksa formulir dan coba kembali.',
            errors,
        );
    }

    if (!data || typeof data.message !== 'string') {
        throw new PasswordResetError(
            'Status perubahan kata sandi belum dapat dipastikan. Coba masuk dengan kata sandi baru sebelum mengirim ulang.',
        );
    }
}

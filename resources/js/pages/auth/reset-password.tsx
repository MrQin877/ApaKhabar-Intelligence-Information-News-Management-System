import { Head, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { csrfPost } from '@/lib/csrf-request';
import {
    PasswordResetError,
    readPasswordResetResponse,
} from '@/lib/password-reset-response';
import { phoneResetRequest, PhoneResetError } from '@/lib/phone-password-reset';
import { update } from '@/routes/password';

type Props = {
    token: string;
    email: string;
    phone?: string;
    challenge?: string;
};

export default function ResetPassword({
    token,
    email,
    phone,
    challenge,
}: Props) {
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [succeeded, setSucceeded] = useState(false);
    const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (pending.current) {
            return;
        }

        const form = new FormData(event.currentTarget);
        pending.current = true;
        setBusy(true);
        setPhoneErrors({});

        try {
            const payload = {
                token,
                email,
                password: String(form.get('password') ?? ''),
                password_confirmation: String(
                    form.get('password_confirmation') ?? '',
                ),
            };

            if (challenge) {
                await phoneResetRequest('reset', { ...payload, challenge });
            } else {
                await readPasswordResetResponse(
                    await csrfPost(update.url(), payload),
                );
            }

            setSucceeded(true);
            router.visit('/login', { replace: true });
        } catch (err) {
            pending.current = false;
            setBusy(false);
            setPhoneErrors(
                err instanceof PasswordResetError
                    ? { general: err.message, ...err.errors }
                    : err instanceof PhoneResetError
                      ? {
                            general: err.message,
                            ...Object.fromEntries(
                                Object.entries(err.data.errors ?? {}).map(
                                    ([key, messages]) => [key, messages[0]],
                                ),
                            ),
                        }
                      : {
                            general:
                                err instanceof Error
                                    ? err.message
                                    : 'Status perubahan kata sandi belum dapat dipastikan. Coba masuk sebelum mengirim ulang.',
                        },
            );
        }
    }

    const fields = (processing: boolean, errors: Record<string, string>) => (
        <div className="grid gap-6" aria-busy={processing}>
            {processing && (
                <p role="status" className="text-sm text-muted-foreground">
                    {succeeded
                        ? 'Kata sandi berhasil diubah. Mengarahkan ke halaman masuk…'
                        : 'Sedang mengubah kata sandi. Mohon tunggu dan jangan kirim ulang.'}
                </p>
            )}
            {succeeded && (
                <TextLink href="/login">Lanjut ke halaman masuk</TextLink>
            )}
            <InputError message={errors.general} />
            <div className="grid gap-2">
                <Label htmlFor="email">
                    {challenge ? 'Nombor telefon' : 'E-mel'}
                </Label>
                <Input
                    id="email"
                    type={challenge ? 'tel' : 'email'}
                    name="email"
                    autoComplete={challenge ? 'tel' : 'email'}
                    value={phone ?? email}
                    className="mt-1 block w-full"
                    readOnly
                />
                <InputError message={errors.email} className="mt-2" />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="password">Kata laluan</Label>
                <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    className="mt-1 block w-full"
                    autoFocus
                    required
                    disabled={processing}
                    placeholder="Kata laluan"
                />
                <InputError message={errors.password} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="password_confirmation">
                    Sahkan kata laluan
                </Label>
                <PasswordInput
                    id="password_confirmation"
                    name="password_confirmation"
                    autoComplete="new-password"
                    required
                    disabled={processing}
                    className="mt-1 block w-full"
                    placeholder="Sahkan kata laluan"
                />
                <InputError
                    message={errors.password_confirmation}
                    className="mt-2"
                />
            </div>

            <Button
                type="submit"
                className="mt-4 w-full"
                disabled={processing}
                data-test="reset-password-button"
            >
                {processing && <Spinner />}
                {succeeded
                    ? 'Kata sandi berhasil diubah'
                    : processing
                      ? 'Memproses…'
                      : 'Tetapkan semula kata laluan'}
            </Button>
        </div>
    );

    return (
        <AuthLayout
            title="Tetapkan semula kata laluan"
            description="Sila masukkan kata laluan baharu anda di bawah"
        >
            <Head title="Tetapkan semula kata laluan" />

            <form onSubmit={submit}>{fields(busy, phoneErrors)}</form>
            {challenge && (
                <TextLink
                    href="/forgot-password"
                    className="mt-4 block text-center"
                >
                    Kembali
                </TextLink>
            )}
        </AuthLayout>
    );
}

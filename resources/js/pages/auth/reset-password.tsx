import { router } from '@inertiajs/react';
import { Form, Head } from '@inertiajs/react';
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
    const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});
    async function submitPhone(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (pending.current || !challenge) {
            return;
        }

        const form = new FormData(event.currentTarget);
        pending.current = true;
        setBusy(true);
        setPhoneErrors({});

        try {
            await phoneResetRequest('reset', {
                challenge,
                token,
                password: String(form.get('password') ?? ''),
                password_confirmation: String(
                    form.get('password_confirmation') ?? '',
                ),
            });
            router.visit('/login');
        } catch (err) {
            setPhoneErrors(
                err instanceof PhoneResetError
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
                              'Tidak dapat menghubungi pelayan. Sila cuba lagi.',
                      },
            );
        } finally {
            pending.current = false;
            setBusy(false);
        }
    }

    const fields = (processing: boolean, errors: Record<string, string>) => (
        <div className="grid gap-6">
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
                Tetapkan semula kata laluan
            </Button>
        </div>
    );

    return (
        <AuthLayout
            title="Tetapkan semula kata laluan"
            description="Sila masukkan kata laluan baharu anda di bawah"
        >
            <Head title="Tetapkan semula kata laluan" />

            {challenge ? (
                <form onSubmit={submitPhone}>{fields(busy, phoneErrors)}</form>
            ) : (
                <Form
                    {...update.form()}
                    transform={(data) => ({ ...data, token, email })}
                    resetOnSuccess={['password', 'password_confirmation']}
                >
                    {({ processing, errors }) => fields(processing, errors)}
                </Form>
            )}
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

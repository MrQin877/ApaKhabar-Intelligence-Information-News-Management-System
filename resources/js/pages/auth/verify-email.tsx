import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

type Props = { status?: string; hasEmail: boolean; hasPhone: boolean };

export default function VerifyEmail({ status, hasEmail, hasPhone }: Props) {
    if (hasEmail) {
        return (
            <AuthLayout
                title="Aktivasi e-mail"
                description="Silahkan aktivsi e-mail anda dengan mengklik tautan yang sudah kirimkan kepada anda"
            >
                <Head title="Pengesahan e-mel" />

                {status === 'verification-link-sent' && (
                    <div className="mb-4 text-center text-sm font-medium text-success-text">
                        Tautan konfirmasi baru telah dikirim ke alamat email yang anda daftarkan.
                    </div>
                )}

                <Form {...send.form()} className="space-y-6 text-center">
                    {({ processing }) => (
                        <>
                            <Button disabled={processing} variant="secondary">
                                {processing && <Spinner />}
                                Kirim ulang email konfirmasi
                            </Button>
                            <TextLink href={logout()} className="mx-auto block text-sm">
                                Log keluar
                            </TextLink>
                        </>
                    )}
                </Form>
            </AuthLayout>
        );
    }

    if (hasPhone) {
        return <VerifyPhone status={status} />;
    }

    // Shouldn't happen given registration validation, but guard anyway
    return (
        <AuthLayout title="Pengesahan akaun" description="Sila hubungi sokongan untuk bantuan.">
            <Head title="Pengesahan akaun" />
            <TextLink href={logout()} className="mx-auto block text-sm">Log keluar</TextLink>
        </AuthLayout>
    );
}

function VerifyPhone({ status }: { status?: string }) {
    const [otp, setOtp] = useState('');

    return (
        <AuthLayout
            title="Sahkan nombor telefon anda"
            description="Masukkan kod OTP yang telah dihantar ke nombor telefon anda"
        >
            <Head title="Pengesahan telefon" />

            {status === 'otp-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-success-text">
                    Kod OTP baharu telah dihantar ke nombor telefon anda.
                </div>
            )}

            <Form action="/settings/phone/verify" method="post" className="space-y-6">
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-2 text-left">
                            <Label htmlFor="otp">Kod OTP</Label>
                            <Input
                                id="otp"
                                name="otp"
                                inputMode="numeric"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="123456"
                                autoFocus
                            />
                            <InputError message={errors.otp} />
                        </div>
                        <Button type="submit" disabled={processing} className="w-full">
                            {processing && <Spinner />}
                            Sahkan
                        </Button>
                    </>
                )}
            </Form>

            <Form action="/settings/phone/resend" method="post" className="mt-4 text-center">
                {({ processing }) => (
                    <Button type="submit" variant="secondary" disabled={processing}>
                        {processing && <Spinner />}
                        Hantar semula OTP
                    </Button>
                )}
            </Form>

            <TextLink href={logout()} className="mx-auto mt-4 block text-center text-sm">
                Log keluar
            </TextLink>
        </AuthLayout>
    );
}
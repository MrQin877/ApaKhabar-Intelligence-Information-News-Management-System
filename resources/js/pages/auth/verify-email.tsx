import { Form, Head } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { logout } from '@/routes';
import { send } from '@/routes/verification';
 
export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <AuthLayout
            title="Aktivasi e-mail"
            description="Silahkan aktivsi e-mail anda dengan mengklik tautan yang sudah kirimkan kepada anda"
        >
            <Head title="Pengesahan e-mel" />
 
            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
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
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
            title="Sahkan e-mel"
            description="Sila sahkan alamat e-mel anda dengan mengklik pautan yang telah kami hantar kepada anda."
        >
            <Head title="Pengesahan e-mel" />
 
            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    Pautan pengesahan baharu telah dihantar ke alamat e-mel yang anda daftarkan.
                </div>
            )}
 
            <Form {...send.form()} className="space-y-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <Spinner />}
                            Hantar semula e-mel pengesahan
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
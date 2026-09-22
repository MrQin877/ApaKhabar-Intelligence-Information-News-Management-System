import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import PhonePasswordResetForm from '@/components/phone-password-reset-form';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AuthLayout from '@/layouts/auth-layout';
import type { PhoneResetStatus } from '@/lib/phone-password-reset';
import { login } from '@/routes';
import { email } from '@/routes/password';
import ResetPassword from './reset-password';

export default function ForgotPassword({ status }: { status?: string }) {
    const [method, setMethod] = useState('email');
    const [authorized, setAuthorized] = useState<PhoneResetStatus | null>(null);

    if (authorized?.reset_token) {
        return (
            <ResetPassword
                email=""
                phone={authorized.phone}
                challenge={authorized.challenge}
                token={authorized.reset_token}
            />
        );
    }

    return (
        <AuthLayout
            title="Lupa kata sandi"
            description="Masukkan tatuan untuk melakukan perubahan kata sandi"
        >
            <Head title="Lupa kata sandi" />

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-success-text">
                    {status}
                </div>
            )}

            <div className="space-y-6">
                <Tabs value={method} onValueChange={setMethod}>
                    <TabsList className="w-full">
                        <TabsTrigger value="email" className="flex-1">
                            E-mel
                        </TabsTrigger>
                        <TabsTrigger value="phone" className="flex-1">
                            Nombor telefon
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="email">
                        <Form {...email.form()}>
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">
                                            Alamat e-mail
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            name="email"
                                            autoComplete="off"
                                            autoFocus
                                            placeholder="email@contoh.com"
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    <div className="my-6 flex items-center justify-start">
                                        <Button
                                            className="w-full"
                                            disabled={processing}
                                            data-test="email-password-reset-link-button"
                                        >
                                            {processing && (
                                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                            )}
                                            Kirim tatuan untuk perubahan kata
                                            sandi
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </TabsContent>
                    <TabsContent value="phone">
                        <PhonePasswordResetForm onVerified={setAuthorized} />
                    </TabsContent>
                </Tabs>

                <div className="space-x-1 text-center text-sm text-muted-foreground">
                    <span>Atau, kembali ke</span>
                    <TextLink href={login()}>log masuk</TextLink>
                </div>
            </div>
        </AuthLayout>
    );
}

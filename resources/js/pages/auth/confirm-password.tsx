import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { store } from '@/routes/password/confirm';
 
export default function ConfirmPassword() {
    return (
        <AuthLayout
            title="Sahkan kata laluan anda"
            description="Ini adalah kawasan selamat aplikasi. Sila sahkan kata laluan anda sebelum meneruskan."
        >
            <Head title="Sahkan kata laluan" />
 
            <Form {...store.form()} resetOnSuccess={['password']}>
                {({ processing, errors }) => (
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Kata laluan</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                placeholder="Kata laluan"
                                autoComplete="current-password"
                                autoFocus
                            />
                            <InputError message={errors.password} />
                        </div>
 
                        <div className="flex items-center">
                            <Button
                                className="w-full"
                                disabled={processing}
                                data-test="confirm-password-button"
                            >
                                {processing && <Spinner />}
                                Sahkan kata laluan
                            </Button>
                        </div>
                    </div>
                )}
            </Form>
        </AuthLayout>
    );
}
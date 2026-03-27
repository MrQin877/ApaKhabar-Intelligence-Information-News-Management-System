import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';
import { store } from '@/routes/register';
 
export default function Register() {
    return (
        <AuthLayout
            title="Cipta akaun baharu"
            description="Masukkan maklumat anda di bawah untuk mendaftar"
        >
            <Head title="Daftar" />
            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nama</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="name"
                                    name="name"
                                    placeholder="Nama penuh"
                                />
                                <InputError message={errors.name} className="mt-2" />
                            </div>
 
                            <div className="grid gap-2">
                                <Label htmlFor="email">Alamat e-mel</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    tabIndex={2}
                                    autoComplete="email"
                                    name="email"
                                    placeholder="email@contoh.com"
                                />
                                <InputError message={errors.email} />
                            </div>
 
                            <div className="grid gap-2">
                                <Label htmlFor="password">Kata laluan</Label>
                                <PasswordInput
                                    id="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Kata laluan"
                                />
                                <InputError message={errors.password} />
                            </div>
 
                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">Sahkan kata laluan</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Sahkan kata laluan"
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>
 
                            <Button
                                type="submit"
                                className="mt-2 w-full"
                                tabIndex={5}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Cipta akaun
                            </Button>
                        </div>
 
                        <div className="text-center text-sm text-muted-foreground">
                            Sudah ada akaun?{' '}
                            <TextLink href={login()} tabIndex={6}>
                                Log masuk
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
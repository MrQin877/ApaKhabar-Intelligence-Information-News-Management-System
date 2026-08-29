import { useState } from 'react';
import { PhoneNumberInput } from '@/components/phone-number-input';
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';
import { store } from '@/routes/register';

export default function Register() {
    const [method, setMethod] = useState<'email' | 'phone'>('email');
    const [phone, setPhone] = useState('');

    return (
        <AuthLayout
            title="Buat akun baharu"
            description="Masukkan data anda di bawah untuk mendaftar"
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
                                    placeholder="Nama lengkap"
                                />
                                <InputError message={errors.name} className="mt-2" />
                            </div>

                            <Tabs value={method} onValueChange={(v) => setMethod(v as 'email' | 'phone')}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="email">E-mel</TabsTrigger>
                                    <TabsTrigger value="phone">Nombor telefon</TabsTrigger>
                                </TabsList>

                                <TabsContent value="email" className="grid gap-2 pt-4">
                                    <Label htmlFor="email">Alamat e-mail</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        tabIndex={2}
                                        autoComplete="email"
                                        name="email"
                                        placeholder="email@contoh.com"
                                    />
                                    <InputError message={errors.email} />
                                </TabsContent>

                                <TabsContent value="phone" className="grid gap-2 pt-4">
                                    <Label htmlFor="phone">Nombor telefon</Label>
                                    <PhoneNumberInput name="phone" value={phone} onChange={setPhone} disabled={processing} />
                                    <InputError message={errors.phone} />
                                    <p className="text-xs text-neutral-400">Pilih kod negara (MY / ID) dan masukkan nombor telefon anda.</p>
                                </TabsContent>
                            </Tabs>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Kata sandi</Label>
                                <PasswordInput
                                    id="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Kata sandi"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">Ulangi kata sandi</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Ulangi kata sandi"
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
                                Buat akaun
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            Sudah ada akun?{' '}
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

import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TwoFactorRecoveryCodes from '@/components/two-factor-recovery-codes';
import TwoFactorSetupModal from '@/components/two-factor-setup-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTwoFactorAuth } from '@/hooks/use-two-factor-auth';
import { SettingsWrapper } from '@/layouts/settings/setting-wrapper';
import { edit } from '@/routes/security';
import { disable, enable } from '@/routes/two-factor';
import type { BreadcrumbItem } from '@/types';
 
type Props = {
    canManageTwoFactor?: boolean;
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
};
 
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Ketentuan Keamanan', href: edit() },
];
 
export default function Security({
    canManageTwoFactor = false,
    requiresConfirmation = false,
    twoFactorEnabled = false,
}: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const { qrCodeSvg, hasSetupData, manualSetupKey, clearSetupData, fetchSetupData, recoveryCodesList, fetchRecoveryCodes, errors } = useTwoFactorAuth();
    const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
 
    return (
        <SettingsWrapper title="Tetapan Keselamatan" breadcrumbs={breadcrumbs}>
            <Head title="Tetapan Keselamatan" />
            <h1 className="sr-only">Tetapan Keselamatan</h1>
 
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Input kata sandi"
                    description="Pastikan akun anda menggunakan kata sandi yang panjang dan acak untuk keamanan"
                />
 
                <Form
                    {...SecurityController.update.form()}
                    options={{ preserveScroll: true }}
                    resetOnError={['password', 'password_confirmation', 'current_password']}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                            }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                            }
                    }}
                    className="space-y-6"
                >
                    {({ errors, processing, recentlySuccessful }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">Kata sandi yang lalu</Label>
                                <PasswordInput
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    className="mt-1 block w-full"
                                    autoComplete="current-password"
                                    placeholder="Kata sandi yang lalu"
                                />
                                <InputError message={errors.current_password} />
                            </div>
 
                            <div className="grid gap-2">
                                <Label htmlFor="password">Kata sandi baru</Label>
                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    name="password"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder="Kata sandi baru"
                                />
                                <InputError message={errors.password} />
                            </div>
 
                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">Aktifkan kata sandi</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder="Aktifkan kata sandi"
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>
 
                            <div className="flex items-center gap-4">
                                <Button disabled={processing} data-test="update-password-button">
                                    Simpan kata laluan
                                </Button>
                                <Transition
                                    show={recentlySuccessful}
                                    enter="transition ease-in-out"
                                    enterFrom="opacity-0"
                                    leave="transition ease-in-out"
                                    leaveTo="opacity-0"
                                >
                                    <p className="text-sm text-muted-foreground">Disimpan</p>
                                </Transition>
                            </div>
                        </>
                    )}
                </Form>
            </div>
 
            {canManageTwoFactor && (
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Autentikasi dua faktor"
                        description="Proses ketentuan autentikasi dua faktor anda"
                    />
                    {twoFactorEnabled ? (
                        <div className="flex flex-col items-start space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Anda akan diminta memasukkan pin selamat semasa log masuk, yang boleh diperolehi daripada aplikasi TOTP pada telefon anda.
                            </p>
                            <Form {...disable.form()}>
                                {({ processing }) => (
                                    <Button variant="destructive" type="submit" disabled={processing}>
                                        Lumpuhkan 2FA
                                    </Button>
                                )}
                            </Form>
                            <TwoFactorRecoveryCodes
                                recoveryCodesList={recoveryCodesList}
                                fetchRecoveryCodes={fetchRecoveryCodes}
                                errors={errors}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-start space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Apabila anda menggunakan autentikasi dua faktor, anda akan diminta memasukkan pin keamanan saat log masuk. Pin ini bisa didapatkan dari aplikasi TOTP pada telepon anda.
                            </p>
                            <div>
                                {hasSetupData ? (
                                    <Button onClick={() => setShowSetupModal(true)}>
                                        <ShieldCheck />
                                        Teruskan persediaan
                                    </Button>
                                ) : (
                                    <Form {...enable.form()} onSuccess={() => setShowSetupModal(true)}>
                                        {({ processing }) => (
                                            <Button type="submit" disabled={processing}>
                                                Aktifkan 2FA
                                            </Button>
                                        )}
                                    </Form>
                                )}
                            </div>
                        </div>
                    )}
                    <TwoFactorSetupModal
                        isOpen={showSetupModal}
                        onClose={() => setShowSetupModal(false)}
                        requiresConfirmation={requiresConfirmation}
                        twoFactorEnabled={twoFactorEnabled}
                        qrCodeSvg={qrCodeSvg}
                        manualSetupKey={manualSetupKey}
                        clearSetupData={clearSetupData}
                        fetchSetupData={fetchSetupData}
                        errors={errors}
                    />
                </div>
            )}
        </SettingsWrapper>
    );
}
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { PhoneVerification } from '@/components/phone-verification'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator'
import { SettingsWrapper } from '@/layouts/settings/setting-wrapper';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { BreadcrumbItem } from '@/types';


const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Tetapan Profil',
        href: edit(),
    },
];
 
export default function Profile({
    mustVerifyEmail,
    status,
    phone,          
    phoneVerified,
    otpSent, 
}: {
    mustVerifyEmail: boolean;
    status?: string;
    phone: string | null;
    phoneVerified: boolean;
    otpSent: boolean;
}) {
    const { auth } = usePage().props;
 
    return (
        <SettingsWrapper title="Tetapan Profil" breadcrumbs={breadcrumbs}>
            <Head title="Tetapan Profil" />
            <h1 className="sr-only">Informasi Profil</h1>
 
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Informasi Profil"
                    description="Input nama dan alamat e-mail anda"
                />
 
                <Form
                    {...ProfileController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ processing, recentlySuccessful, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nama</Label>
                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.name}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder="Nama penuh"
                                />
                                <InputError className="mt-2" message={errors.name} />
                            </div>
 
                            <div className="grid gap-2">
                                <Label htmlFor="email">Alamat e-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.email}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="Alamat e-mail"
                                />
                                <InputError className="mt-2" message={errors.email} />
                            </div>
 
                            {mustVerifyEmail && auth.user.email_verified_at === null && (
                                <div>
                                    <p className="-mt-4 text-sm text-muted-foreground">
                                        Alamat e-mail anda belum diaktifkan.{' '}
                                        <Link
                                            href={send()}
                                            as="button"
                                            className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                        >
                                            Klik di sini untuk mengirim ulang email konfirmasi.
                                        </Link>
                                    </p>
                                    {status === 'verification-link-sent' && (
                                        <div className="mt-2 text-sm font-medium text-green-600">
                                            Tautan konfirmasi baru telah dikirim ke alamat email anda.
                                        </div>
                                    )}
                                </div>
                            )}
 
                            <div className="flex items-center gap-4">
                                <Button disabled={processing} data-test="update-profile-button">
                                    Simpan
                                </Button>
                                <Transition
                                    show={recentlySuccessful}
                                    enter="transition ease-in-out"
                                    enterFrom="opacity-0"
                                    leave="transition ease-in-out"
                                    leaveTo="opacity-0"
                                >
                                    <p className="text-sm text-neutral-600">Disimpan</p>
                                </Transition>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            <Separator className="dark:bg-neutral-800" />

            {/* ── Phone verification ── */}
            <div className="space-y-4">
                <Heading
                    variant="small"
                    title="Nomor Telepon"
                    description="Tambah nomor telefon untuk menerima notifikasi SMS"
                />
                <PhoneVerification
                    phone={phone}
                    phoneVerified={phoneVerified}
                    otpSent={otpSent}
                    status={status}
                />
            </div>
 
            <DeleteUser />
        </SettingsWrapper>
    );
}
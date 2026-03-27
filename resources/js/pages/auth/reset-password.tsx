import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { update } from '@/routes/password';
 
type Props = {
    token: string;
    email: string;
};
 
export default function ResetPassword({ token, email }: Props) {
    return (
        <AuthLayout
            title="Tetapkan semula kata laluan"
            description="Sila masukkan kata laluan baharu anda di bawah"
        >
            <Head title="Tetapkan semula kata laluan" />
 
            <Form
                {...update.form()}
                transform={(data) => ({ ...data, token, email })}
                resetOnSuccess={['password', 'password_confirmation']}
            >
                {({ processing, errors }) => (
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">E-mel</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                value={email}
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
                            <Label htmlFor="password_confirmation">Sahkan kata laluan</Label>
                            <PasswordInput
                                id="password_confirmation"
                                name="password_confirmation"
                                autoComplete="new-password"
                                className="mt-1 block w-full"
                                placeholder="Sahkan kata laluan"
                            />
                            <InputError message={errors.password_confirmation} className="mt-2" />
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
                )}
            </Form>
        </AuthLayout>
    );
}
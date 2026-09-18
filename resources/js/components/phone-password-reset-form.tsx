import { useEffect, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { PhoneNumberInput } from '@/components/phone-number-input';
import { Button } from '@/components/ui/button';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { phoneResetRequest, PhoneResetError } from '@/lib/phone-password-reset';
import type { PhoneResetStatus } from '@/lib/phone-password-reset';
import { isValidPhoneNumber } from '@/lib/phone-validation';

export default function PhonePasswordResetForm({
    onVerified,
}: {
    onVerified: (data: PhoneResetStatus) => void;
}) {
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<PhoneResetStatus | null>(null);
    const [otp, setOtp] = useState('');
    const [processing, setProcessing] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [clock, setClock] = useState(Date.now);
    const [retryAt, setRetryAt] = useState(0);
    const [resetAt, setResetAt] = useState(0);
    const [dailyLimit, setDailyLimit] = useState(false);
    const seconds = Math.max(0, Math.ceil((retryAt - clock) / 1000));
    const dailyBlocked = dailyLimit && clock < resetAt;

    function applyLimits(data: Partial<PhoneResetStatus>) {
        const now = Date.now();
        setClock(now);

        if (typeof data.retry_after === 'number') {
            setRetryAt(now + data.retry_after * 1000);
        }

        if (typeof data.daily_reset_after === 'number') {
            setResetAt(now + data.daily_reset_after * 1000);
        }

        if (typeof data.daily_limit_reached === 'boolean') {
            setDailyLimit(data.daily_limit_reached);
        }
    }

    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 1000);

        return () => window.clearInterval(timer);
    }, []);

    async function submit(action: 'send' | 'verify') {
        if (
            pending.current ||
            (action === 'send' && (seconds > 0 || dailyBlocked))
        ) {
            return;
        }

        setError('');
        setMessage('');

        if (!status && !isValidPhoneNumber(phone)) {
            setError('Sila masukkan nombor telefon yang sah.');

            return;
        }

        if (action === 'verify' && !/^[0-9]{6}$/.test(otp)) {
            setError('Sila masukkan kod OTP 6 digit.');

            return;
        }

        pending.current = true;
        setProcessing(true);

        try {
            const data = await phoneResetRequest(
                action,
                status
                    ? {
                          challenge: status.challenge,
                          ...(action === 'verify' ? { otp } : {}),
                      }
                    : { phone },
            );
            applyLimits(data);
            setStatus(data);
            setOtp('');

            if (data.reset_token) {
                onVerified(data);
            } else {
                setMessage('OTP telah dihantar. Kod sah selama 10 minit.');
            }
        } catch (err) {
            setError(
                err instanceof PhoneResetError
                    ? err.message
                    : 'Tidak dapat menghubungi pelayan. Sila cuba lagi.',
            );

            if (err instanceof PhoneResetError) {
                applyLimits(err.data);
            }
        } finally {
            pending.current = false;
            setProcessing(false);
        }
    }

    return (
        <form
            className="grid gap-6"
            onSubmit={(event) => {
                event.preventDefault();
                void submit(status ? 'verify' : 'send');
            }}
        >
            {!status ? (
                <PhoneNumberInput
                    value={phone}
                    onChange={(value) => {
                        setPhone(value);
                        setError('');
                    }}
                    disabled={processing}
                    required
                />
            ) : (
                <>
                    <p className="text-center text-sm">
                        Masukkan OTP yang dihantar ke{' '}
                        <strong>{status.phone}</strong>.
                    </p>
                    <div className="grid justify-items-center gap-2">
                        <Label htmlFor="reset-otp">Kod OTP</Label>
                        <InputOTP
                            id="reset-otp"
                            maxLength={6}
                            value={otp}
                            onChange={setOtp}
                            pattern="^[0-9]*$"
                            autoFocus
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            disabled={processing}
                        >
                            <InputOTPGroup>
                                {Array.from({ length: 6 }, (_, index) => (
                                    <InputOTPSlot key={index} index={index} />
                                ))}
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                </>
            )}
            <p className="text-sm text-muted-foreground">
                Maksimum 5 permintaan sehari. Tunggu 60 saat sebelum meminta OTP
                semula.
            </p>
            {dailyBlocked && (
                <p role="alert" className="text-sm text-destructive">
                    Had 5 permintaan OTP sehari telah dicapai. Sila cuba lagi
                    esok.
                </p>
            )}
            <InputError message={error} />
            {message && (
                <p role="status" className="text-sm text-success-text">
                    {message}
                </p>
            )}
            <Button
                type="submit"
                disabled={
                    processing ||
                    (status ? otp.length !== 6 : seconds > 0 || dailyBlocked)
                }
            >
                {processing && <Spinner />}
                {status
                    ? 'Sahkan OTP'
                    : seconds > 0
                      ? `Hantar OTP (${seconds}s)`
                      : 'Hantar OTP'}
            </Button>
            {status && (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={processing || seconds > 0 || dailyBlocked}
                        onClick={() => void submit('send')}
                    >
                        {seconds > 0
                            ? `Hantar semula dalam ${seconds}s`
                            : 'Hantar semula OTP'}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={processing}
                        onClick={() => {
                            setStatus(null);
                            setOtp('');
                            setError('');
                            setMessage('');
                        }}
                    >
                        Kembali
                    </Button>
                </>
            )}
        </form>
    );
}

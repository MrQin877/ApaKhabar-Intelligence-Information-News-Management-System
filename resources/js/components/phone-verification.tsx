import { router, usePage } from '@inertiajs/react';
import { ShieldCheck, Send, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PhoneNumberInput } from '@/components/phone-number-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { isValidPhoneNumber } from '@/lib/phone-validation';

interface PhoneVerificationProps {
    phone: string | null;
    phoneVerified: boolean;
    otpSent: boolean;
    status?: string;
}

export function PhoneVerification({
    phone: initialPhone,
    phoneVerified,
    otpSent: initialOtpSent,
    status,
}: PhoneVerificationProps) {
    const { errors, otpRateLimit } = usePage().props as unknown as {
        errors: Record<string, string>;
        otpRateLimit: {
            retryAt: number;
            dailyLimitReached: boolean;
            dailyResetAt: number;
        };
    };
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const cooldown = Math.max(
        0,
        Math.ceil(((otpRateLimit?.retryAt ?? 0) * 1000 - currentTime) / 1000),
    );
    const dailyLimitReached = Boolean(
        otpRateLimit?.dailyLimitReached &&
        currentTime < otpRateLimit.dailyResetAt * 1000,
    );
    const otpRequestBlocked = cooldown > 0 || dailyLimitReached;
    const dailyMessage =
        'Terlalu banyak permintaan OTP. Silakan coba lagi besok.';
    const savedPhone =
        initialPhone && isValidPhoneNumber(initialPhone) ? initialPhone : '';
    const [phone, setPhone] = useState<string>(savedPhone);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(
        initialOtpSent || status === 'otp-sent',
    );
    const [dialogOpen, setDialogOpen] = useState(
        initialOtpSent || status === 'otp-sent',
    );
    const [validationAttempted, setValidationAttempted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(status === 'phone-verified');

    useEffect(() => {
        const timer = window.setInterval(
            () => setCurrentTime(Date.now()),
            1000,
        );

        return () => window.clearInterval(timer);
    }, []);

    // Keep drafts local to this visit, including browser back/forward cache restores.
    useEffect(() => {
        function resetDraft() {
            setPhone(savedPhone);
            setValidationAttempted(false);
            setOtp('');
            setOtpSent(false);
            setDialogOpen(false);
            setShowSuccess(false);
        }

        const removeStartListener = router.on('start', (event) => {
            // OTP requests are POSTs and must retain their existing state.
            if (
                event.detail.visit.method === 'get' &&
                !event.detail.visit.async
            ) {
                resetDraft();
            }
        });
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                resetDraft();
            }
        };

        window.addEventListener('pagehide', resetDraft);
        window.addEventListener('pageshow', handlePageShow);

        return () => {
            removeStartListener();
            window.removeEventListener('pagehide', resetDraft);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [savedPhone]);

    // ── Only use useEffect for the timer (external side effect) ──
    useEffect(() => {
        if (!showSuccess) {
            return;
        }

        const timer = setTimeout(() => {
            setShowSuccess(false);
        }, 3000);

        return () => clearTimeout(timer);
    }, [showSuccess]); // ← depends on showSuccess, not status

    function handleSendOtp() {
        if (
            processing ||
            otpRequestBlocked ||
            (phoneVerified && phone === savedPhone)
        ) {
            return;
        }

        setValidationAttempted(true);

        if (!isValidPhoneNumber(phone)) {
            return;
        }

        setProcessing(true);
        router.post(
            '/settings/phone',
            { phone },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOtpSent(true);
                    setDialogOpen(true);
                    setProcessing(false);
                },
                onError: () => setProcessing(false),
            },
        );
    }

    function handleVerify() {
        setProcessing(true);
        router.post(
            '/settings/phone/verify',
            { otp },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOtp('');
                    setDialogOpen(false);
                    setOtpSent(false);
                    setShowSuccess(true); // ← trigger success + timer
                    setProcessing(false);
                },
                onError: () => setProcessing(false),
            },
        );
    }

    function handleResend() {
        if (processing || otpRequestBlocked) {
            return;
        }

        setProcessing(true);
        router.post(
            '/settings/phone/resend',
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOtpSent(true);
                    setDialogOpen(true);
                    setProcessing(false);
                },
                onError: () => setProcessing(false),
            },
        );
    }

    return (
        <div className="space-y-4">
            {showSuccess && phoneVerified && phone === initialPhone && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950/30">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        <p className="text-sm text-green-700 dark:text-green-400">
                            Nomor telepon berjaya disahkan!
                        </p>
                    </div>
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setShowSuccess(false)}
                        className="shrink-0 text-sm text-green-600 hover:text-green-800 dark:hover:text-green-300"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Phone input + button ── */}
            <PhoneNumberInput
                value={phone}
                hideLabel
                instruction="Pilih kode negara dan masukkan nomor telepon anda."
                showVerificationStatus
                validationAttempted={validationAttempted}
                verifiedPhone={phoneVerified ? initialPhone : null}
                onChange={(value) => {
                    setPhone(value);
                    setValidationAttempted(false);
                    setOtp('');
                    setOtpSent(false);
                    setShowSuccess(false);
                }}
                disabled={processing}
                action={
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSendOtp}
                        disabled={
                            processing ||
                            otpRequestBlocked ||
                            (phoneVerified && phone === savedPhone)
                        }
                        className="h-9 shrink-0 gap-1.5 text-sm"
                    >
                        <Send className="h-3.5 w-3.5" />
                        {cooldown > 0
                            ? `Tunggu ${cooldown}s`
                            : phoneVerified
                              ? 'Ganti Nomor'
                              : 'Kirim OTP'}
                    </Button>
                }
            />

            {(dailyLimitReached || errors?.phone) && (
                <p role="alert" className="-mt-2 text-xs text-red-500">
                    {dailyLimitReached ? dailyMessage : errors.phone}
                </p>
            )}

            {/* ── OTP input section ── */}
            {otpSent && !phoneVerified && phone === initialPhone && (
                <Dialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                        if (!processing) {
                            setDialogOpen(open);
                        }
                    }}
                >
                    <DialogContent
                        overlayClassName="bg-black/50 backdrop-blur-sm"
                        closeDisabled={processing}
                        onEscapeKeyDown={(event) => {
                            if (processing) {
                                event.preventDefault();
                            }
                        }}
                        onInteractOutside={(event) => {
                            if (processing) {
                                event.preventDefault();
                            }
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>Verifikasi Nomor Telepon</DialogTitle>
                            <DialogDescription>
                                Kode OTP telah dikirim ke{' '}
                                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                    {phone}
                                </span>
                                . Masukkan kode 6 digit di bawah.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex gap-2">
                            <Input
                                type="text"
                                aria-label="Kode OTP"
                                autoComplete="one-time-code"
                                disabled={processing}
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="000000"
                                value={otp}
                                onChange={(e) =>
                                    setOtp(e.target.value.replace(/\D/g, ''))
                                }
                                className="h-9 flex-1 bg-white text-center font-mono text-sm tracking-widest dark:bg-neutral-900"
                            />
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleVerify}
                                disabled={processing || otp.length !== 6}
                                className="h-9 shrink-0 gap-1.5 bg-green-600 text-sm text-white hover:bg-green-700"
                            >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Verifikasi
                            </Button>
                        </div>

                        {errors?.otp && (
                            <p className="text-xs text-red-500">{errors.otp}</p>
                        )}

                        {(dailyLimitReached || errors?.phone) && (
                            <p role="alert" className="text-xs text-red-500">
                                {dailyLimitReached
                                    ? dailyMessage
                                    : errors.phone}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={processing || otpRequestBlocked}
                            className="flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-green-600"
                        >
                            <RefreshCw className="h-3 w-3" />
                            {cooldown > 0
                                ? `Kirim Ulang OTP (${cooldown}s)`
                                : 'Kirim Ulang OTP'}
                        </button>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

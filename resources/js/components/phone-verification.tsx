import { router } from '@inertiajs/react'
import {
    Phone, ShieldCheck, ShieldX,
    Send, RefreshCw, CheckCircle2,
} from 'lucide-react'
import { useState, useEffect } from 'react'  
import { forwardRef } from 'react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Shadcn-styled input for PhoneInput ────────────────────
const CustomInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => (
        <input
            {...props}
            ref={ref}
            className="flex h-9 w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500 disabled:opacity-50"
        />
    )
)
CustomInput.displayName = 'CustomInput'

interface PhoneVerificationProps {
    phone: string | null
    phoneVerified: boolean
    otpSent: boolean
    status?: string
}

export function PhoneVerification({
    phone: initialPhone,
    phoneVerified,
    otpSent: initialOtpSent,
    status,
}: PhoneVerificationProps) {
    const [phone,       setPhone]       = useState<string>(initialPhone ?? '')
    const [otp,         setOtp]         = useState('')
    const [otpSent,     setOtpSent]     = useState(initialOtpSent || status === 'otp-sent')
    const [processing,  setProcessing]  = useState(false)
    const [showSuccess, setShowSuccess] = useState(status === 'phone-verified')

    // ── Only use useEffect for the timer (external side effect) ──
    useEffect(() => {
        if (!showSuccess) {
return
}

        const timer = setTimeout(() => {
            setShowSuccess(false)
        }, 3000)

        return () => clearTimeout(timer)
    }, [showSuccess])  // ← depends on showSuccess, not status

    function handleSendOtp() {
        setProcessing(true)
        router.post('/settings/phone', { phone }, {
            preserveScroll: true,
            onSuccess: () => {
                setOtpSent(true)
                setProcessing(false)
            },
            onError: () => setProcessing(false),
        })
    }

    function handleVerify() {
        setProcessing(true)
        router.post('/settings/phone/verify', { otp }, {
            preserveScroll: true,
            onSuccess: () => {
                setOtp('')
                setOtpSent(false)
                setShowSuccess(true)  // ← trigger success + timer
                setProcessing(false)
            },
            onError: () => setProcessing(false),
        })
    }

    function handleResend() {
        setProcessing(true)
        router.post('/settings/phone/resend', {}, {
            preserveScroll: true,
            onSuccess: () => {
                setOtpSent(true)
                setProcessing(false)
            },
            onError: () => setProcessing(false),
        })
    }

    return (
        <div className="space-y-4">

            {/* ── Title + Status badge ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-neutral-500" />
                    <Label className="text-sm font-medium">Nombor Telefon</Label>
                </div>
                {phone && (
                    <Badge
                        variant="outline"
                        className={cn(
                            "gap-1 text-xs",
                            phoneVerified
                                ? "border-green-200 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                                : "border-yellow-200 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30"
                        )}
                    >
                        {phoneVerified
                            ? <><ShieldCheck className="h-3 w-3" /> Disahkan</>
                            : <><ShieldX className="h-3 w-3" /> Belum disahkan</>
                        }
                    </Badge>
                )}
            </div>

            {/* ── Success verified message ── */}
            {showSuccess && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <p className="text-sm text-green-700 dark:text-green-400">
                            Nombor telefon berjaya disahkan!
                        </p>
                    </div>
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setShowSuccess(false)}
                        className="text-green-600 hover:text-green-800 dark:hover:text-green-300 text-sm shrink-0"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Phone input + button ── */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0">
                    <PhoneInput
                        international
                        defaultCountry="MY"
                        countries={['MY', 'ID']}
                        value={phone}
                        onChange={(val) => setPhone(val ?? '')}
                        inputComponent={CustomInput}
                        disabled={processing}
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSendOtp}
                    disabled={processing || !phone}
                    className="w-full sm:w-auto h-9 gap-1.5 text-sm shrink-0"
                >
                    <Send className="h-3.5 w-3.5" />
                    {phoneVerified ? 'Tukar Nombor' : 'Hantar OTP'}
                </Button>
            </div>

            {/* ── Phone error message ── */}
            {errors?.phone && (
                <p className="text-xs text-red-500 -mt-2">
                    {errors.phone}
                </p>
            )}

            <p className="text-xs text-neutral-400">
                Pilih kod negara dan masukkan nombor telefon anda.
            </p>

            {/* ── OTP input section ── */}
            {otpSent && !phoneVerified && (
                <div className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-4">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Kod OTP telah dihantar ke{' '}
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {phone}
                        </span>.
                        Masukkan kod 6 digit di bawah.
                    </p>

                    <div className="flex gap-2">
                        <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="000000"
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            className="flex-1 h-9 text-sm tracking-widest font-mono text-center bg-white dark:bg-neutral-900"
                        />
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleVerify}
                            disabled={processing || otp.length !== 6}
                            className="h-9 gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white shrink-0"
                        >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Sahkan
                        </Button>
                    </div>

                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={processing}
                        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-green-600 transition-colors"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Hantar semula OTP
                    </button>
                </div>
            )}
        </div>
    )
}
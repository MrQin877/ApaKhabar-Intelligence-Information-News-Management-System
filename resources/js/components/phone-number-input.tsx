import { ShieldCheck, ShieldX } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    isValidPhoneNumber,
    PHONE_VALIDATION_MESSAGE,
} from '@/lib/phone-validation';
import { cn } from '@/lib/utils';

const CustomInput = forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
    <input
        {...props}
        ref={ref}
        className="flex h-9 w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800/50"
    />
));
CustomInput.displayName = 'CustomInput';

interface PhoneNumberInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    label?: string;
    hideLabel?: boolean;
    instruction?: string;
    action?: ReactNode;
    validationAttempted?: boolean;
    showVerificationStatus?: boolean;
    verifiedPhone?: string | null;
}

export function PhoneNumberInput({
    value,
    onChange,
    disabled,
    required = false,
    id = 'phone',
    label = 'Nomor Telepon',
    hideLabel = false,
    instruction,
    action,
    validationAttempted = false,
    showVerificationStatus = false,
    verifiedPhone,
}: PhoneNumberInputProps) {
    const verified = Boolean(value && verifiedPhone && value === verifiedPhone);
    const fieldRef = useRef<HTMLDivElement>(null);
    const [touched, setTouched] = useState(false);
    const invalid = !isValidPhoneNumber(value);
    const showError = invalid && (validationAttempted || touched);

    useEffect(() => {
        fieldRef.current
            ?.querySelector('input')
            ?.setCustomValidity(
                invalid && (Boolean(value) || required)
                    ? PHONE_VALIDATION_MESSAGE
                    : '',
            );
    }, [invalid, value, required]);

    return (
        <div ref={fieldRef} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label
                    htmlFor={id}
                    className={hideLabel ? 'sr-only' : undefined}
                >
                    {label}
                </Label>
                {instruction && (
                    <p
                        id={`${id}-instruction`}
                        className="min-w-0 text-xs text-neutral-400"
                    >
                        {instruction}
                    </p>
                )}
                {showVerificationStatus && (
                    <Badge
                        variant="outline"
                        role="status"
                        className={cn(
                            'ml-auto gap-1 text-xs',
                            verified
                                ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                                : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
                        )}
                    >
                        {verified ? (
                            <>
                                <ShieldCheck
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                />
                                Terverifikasi
                            </>
                        ) : (
                            <>
                                <ShieldX
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                />
                                Belum Diverifikasi
                            </>
                        )}
                    </Badge>
                )}
            </div>
            <div className="flex min-w-0 items-center gap-2">
                <PhoneInput
                    className="min-w-0 flex-1 [&_input]:min-w-0"
                    id={id}
                    required={required}
                    onInvalid={() => setTouched(true)}
                    aria-invalid={showError}
                    aria-describedby={
                        [
                            instruction && `${id}-instruction`,
                            showError && `${id}-validation-error`,
                        ]
                            .filter(Boolean)
                            .join(' ') || undefined
                    }
                    international
                    countryCallingCodeEditable={false}
                    addInternationalOption={false}
                    defaultCountry="MY"
                    countries={['MY', 'ID']}
                    value={value}
                    onChange={(val) => onChange(val ?? '')}
                    inputComponent={CustomInput}
                    disabled={disabled}
                />
                {action}
            </div>
            {showError && (
                <p
                    id={`${id}-validation-error`}
                    className="text-xs text-red-500"
                    role="alert"
                >
                    {PHONE_VALIDATION_MESSAGE}
                </p>
            )}
        </div>
    );
}

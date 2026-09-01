import { forwardRef } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const CustomInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => (
        <input
            {...props}
            ref={ref}
            className="flex h-9 w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500 disabled:opacity-50"
        />
    )
);
CustomInput.displayName = 'CustomInput';

interface PhoneNumberInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function PhoneNumberInput({ value, onChange, disabled }: PhoneNumberInputProps) {
    return (
        <PhoneInput
            international
            addInternationalOption={false}
            defaultCountry="MY"
            countries={['MY', 'ID']}
            value={value}
            onChange={(val) => onChange(val ?? '')}
            inputComponent={CustomInput}
            disabled={disabled}
        />
    );
}
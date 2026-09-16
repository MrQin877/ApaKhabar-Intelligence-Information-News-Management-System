import { parsePhoneNumber } from 'react-phone-number-input/max';

export const PHONE_VALIDATION_MESSAGE = 'Masukkan nomor telepon yang valid.';

export function isValidPhoneNumber(value: string): boolean {
    const phone = parsePhoneNumber(value);

    return Boolean(
        phone &&
        (phone.country === 'MY' || phone.country === 'ID') &&
        phone.isValid(),
    );
}

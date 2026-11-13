import { useCallback } from 'react';

export type GetInitialsFn = (fullName: string) => string;

export function useInitials(): GetInitialsFn {
    return useCallback((fullName: string): string => {
        return (Array.from(fullName.trim())[0] || '?').toLocaleUpperCase();
    }, []);
}

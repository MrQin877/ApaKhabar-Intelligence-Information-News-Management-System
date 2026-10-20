import { useSyncExternalStore } from 'react';

// Match Tailwind's md breakpoint exactly, including fractional viewport widths.
const DESKTOP_MEDIA_QUERY = '(min-width: 48rem)';

const mql =
    typeof window === 'undefined'
        ? undefined
        : window.matchMedia(DESKTOP_MEDIA_QUERY);

function mediaQueryListener(callback: (event: MediaQueryListEvent) => void) {
    if (!mql) {
        return () => {};
    }

    mql.addEventListener('change', callback);

    return () => {
        mql.removeEventListener('change', callback);
    };
}

function isSmallerThanBreakpoint(): boolean {
    return mql ? !mql.matches : false;
}

function getServerSnapshot(): boolean {
    return false;
}

export function useIsMobile(): boolean {
    return useSyncExternalStore(
        mediaQueryListener,
        isSmallerThanBreakpoint,
        getServerSnapshot,
    );
}

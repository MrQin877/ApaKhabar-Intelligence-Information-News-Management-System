import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { setNavigationGuard } from '@/lib/navigation-guard';

export function useUnsavedNews(isDirty: boolean, busy: boolean) {
    const [open, setOpen] = useState(false);
    const pending = useRef<(() => void) | null>(null);
    const allowed = useRef(false);

    const allowLeave = useCallback(() => {
        allowed.current = true;
    }, []);
    const continueEditing = () => {
        if (busy) {
            return;
        }

        pending.current = null;
        setOpen(false);
    };
    const leave = () => {
        const proceed = pending.current;
        pending.current = null;
        allowed.current = true;
        setOpen(false);
        proceed?.();
    };

    useEffect(() => {
        const ask = (proceed: () => void) => {
            if (allowed.current || !isDirty) {
                return false;
            }

            if (!busy && !pending.current) {
                pending.current = proceed;
                setOpen(true);
            }

            return true;
        };
        const removeHistoryGuard = setNavigationGuard({
            blocked: () => isDirty && !allowed.current,
            ask,
        });
        const removeBefore = router.on('before', (event) => {
            if (
                ask(() =>
                    router.visit(event.detail.visit.url, event.detail.visit),
                )
            ) {
                event.preventDefault();
            }
        });
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (isDirty && !allowed.current) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        const click = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const anchor =
                event.target instanceof Element
                    ? event.target.closest('a')
                    : null;

            if (
                !anchor?.href ||
                anchor.hasAttribute('download') ||
                (anchor.target && anchor.target !== '_self')
            ) {
                return;
            }

            const url = new URL(anchor.href);

            if (
                url.origin === location.origin &&
                url.pathname === location.pathname &&
                url.search === location.search
            ) {
                return;
            }

            if (ask(() => location.assign(url.href))) {
                event.preventDefault();
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        document.addEventListener('click', click);

        return () => {
            removeHistoryGuard();
            removeBefore();
            window.removeEventListener('beforeunload', beforeUnload);
            document.removeEventListener('click', click);
        };
    }, [isDirty, busy]);

    return { open, leave, continueEditing, allowLeave };
}

import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { setNavigationGuard } from '@/lib/navigation-guard';

export function useUnsavedNews(isDirty: boolean, busy: boolean) {
    const [open, setOpen] = useState(false);
    const pending = useRef<(() => void) | null>(null);
    const allowed = useRef(false);
    useEffect(() => {
        allowed.current = false;
    }, [isDirty]);

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
            const visit = event.detail.visit;
            const url = new URL(visit.url, location.href);

            // Reloads/polling and local form requests do not leave this editor.
            if (
                url.origin === location.origin &&
                url.pathname === location.pathname &&
                (url.search === location.search ||
                    (visit.preserveState && visit.only?.length))
            ) {
                return;
            }

            if (
                ask(() =>
                    router.visit(event.detail.visit.url, event.detail.visit),
                )
            ) {
                event.preventDefault();
            }
        });
        const removeFinish = router.on('finish', () => {
            allowed.current = false;
        });
        const afterHistory = () => {
            allowed.current = false;
        };
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

            // External navigation uses the browser's native beforeunload prompt.
            if (url.origin !== location.origin) {
                return;
            }

            if (ask(() => location.assign(url.href))) {
                event.preventDefault();
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('popstate', afterHistory);
        document.addEventListener('click', click);

        return () => {
            removeHistoryGuard();
            removeBefore();
            removeFinish();
            window.removeEventListener('popstate', afterHistory);
            window.removeEventListener('beforeunload', beforeUnload);
            document.removeEventListener('click', click);
        };
    }, [isDirty, busy]);

    const requestLeave = (proceed: () => void) => {
        if (busy || pending.current) {
            return;
        }

        if (!isDirty) {
            proceed();

            return;
        }

        pending.current = proceed;
        setOpen(true);
    };

    return { open, leave, continueEditing, allowLeave, requestLeave };
}

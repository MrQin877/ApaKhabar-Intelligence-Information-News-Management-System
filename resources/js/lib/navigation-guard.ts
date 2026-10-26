type Guard = { blocked: () => boolean; ask: (proceed: () => void) => void };
let guard: Guard | undefined;
const installed = new WeakSet<Window>();

export function setNavigationGuard(next: Guard) {
    guard = next;

    return () => {
        if (guard === next) {
            guard = undefined;
        }
    };
}

// Track real history entries (without adding dummy entries). Restore the editor
// before asking, so Inertia never unmounts it while the dialog is open.
export function installNavigationGuard(win: Window) {
    if (installed.has(win)) {
        return;
    }

    installed.add(win);
    let currentUrl = new URL(win.location.href);
    const key = '__apakhabarPosition';
    const history = win.history;
    let position: number = history.state?.[key] ?? 0;
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    let restoring: { delta: number; ask: Guard['ask'] } | undefined;

    replace({ ...history.state, [key]: position }, '');
    history.pushState = (data, unused, url) => {
        push({ ...data, [key]: position + 1 }, unused, url);
        position++;
        currentUrl = new URL(win.location.href);
    };
    history.replaceState = (data, unused, url) => {
        replace({ ...data, [key]: position }, unused, url);
        currentUrl = new URL(win.location.href);
    };
    win.addEventListener(
        'popstate',
        (event) => {
            const target = event.state?.[key] as number | undefined;

            if (restoring) {
                event.stopImmediatePropagation();
                const pending = restoring;
                restoring = undefined;
                pending.ask(() => history.go(pending.delta));

                return;
            }

            // An entry outside this document has no safe history delta to reverse.
            if (target === undefined) {
                return;
            }

            const delta = target - position;
            const targetUrl = new URL(win.location.href);
            const sameEditor =
                targetUrl.pathname === currentUrl.pathname &&
                targetUrl.search === currentUrl.search;

            if (guard?.blocked() && delta !== 0 && !sameEditor) {
                event.stopImmediatePropagation();
                restoring = { delta, ask: guard.ask };
                history.go(-delta);

                return;
            }

            position = target;
            currentUrl = targetUrl;
        },
        true,
    );
}

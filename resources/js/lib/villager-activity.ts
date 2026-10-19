import { router } from '@inertiajs/react';
export function installVillagerActivity() {
    let lastKey = '';
    const track = () => {
        if (document.visibilityState !== 'visible') {
            return;
        }

        const path = window.location.pathname;

        if (
            !(path === '/' || path === '/news' || /^\/news\/[^/]+$/.test(path))
        ) {
            return;
        }

        // Anonymous visits are not tracked. Read current Inertia auth on navigation events below.
        const token = document.cookie
            .split('; ')
            .find((c) => c.startsWith('XSRF-TOKEN='))
            ?.slice(11);

        if (!token) {
            return;
        }

        const key = `${userId}:${Math.floor(Date.now() / 3600000)}`;

        if (!userId || lastKey === key) {
            return;
        }

        lastKey = key;
        void fetch('/activity', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(token),
            },
            body: JSON.stringify({
                event: path.startsWith('/news/') ? 'post_open' : 'feed_open',
            }),
        })
            .then((r) => {
                if (!r.ok) {
                    lastKey = '';
                }
            })
            .catch(() => {
                lastKey = '';
            });
    };
    let userId: number | null = null;
    router.on('navigate', (event) => {
        const auth = event.detail.page.props.auth as {
            user?: { id: number; role: string };
        };
        userId = auth?.user?.role === 'villager' ? auth.user.id : null;
        track();
    });
    document.addEventListener('visibilitychange', track);
    document.addEventListener('pointerdown', track, { passive: true });
    document.addEventListener('keydown', track);
}

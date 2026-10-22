export function observeHomeReveals(root: HTMLElement): () => void {
    if (
        typeof IntersectionObserver === 'undefined' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
        return () => {};
    }

    const elements = root.querySelectorAll<HTMLElement>('[data-home-reveal]');
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).dataset.homeReveal =
                        'visible';
                    observer.unobserve(entry.target);
                }
            }
        },
        { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );

    for (const element of elements) {
        if (element.dataset.homeReveal !== 'visible') {
            element.dataset.homeReveal = 'pending';
            observer.observe(element);
        }
    }

    return () => observer.disconnect();
}

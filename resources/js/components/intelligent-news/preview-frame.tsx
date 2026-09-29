import {
    useEffect,
    useState,
    type CSSProperties,
    type MouseEvent,
    type ReactNode,
} from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface PreviewFrameProps {
    children: ReactNode;
    onClose: () => void;
    width: number;
    onResizeStart: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function PreviewFrame({
    children,
    onClose,
    width,
    onResizeStart,
}: PreviewFrameProps) {
    const [mobile, setMobile] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(max-width: 1023px)').matches,
    );
    useEffect(() => {
        const query = window.matchMedia('(max-width: 1023px)');
        const update = () => setMobile(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    if (mobile)
        return (
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
            >
                <DialogContent
                    aria-describedby={undefined}
                    className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none [&>button]:hidden"
                >
                    <DialogTitle className="sr-only">
                        Pratinjau berita
                    </DialogTitle>
                    {children}
                </DialogContent>
            </Dialog>
        );
    return (
        <section
            className="relative mt-16 flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-l-2xl rounded-r-none border-y border-l border-border/60 bg-card ring-1 ring-foreground/5 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 lg:h-[calc(100%-4rem)] lg:w-[var(--preview-width)]"
            style={
                {
                    '--preview-width': `${width}px`,
                } as CSSProperties
            }
        >
            <button
                type="button"
                aria-label="Ubah lebar pratinjau"
                title="Seret untuk mengubah lebar pratinjau"
                className="absolute top-0 bottom-0 left-0 z-20 hidden w-3 cursor-col-resize touch-none items-center justify-center bg-transparent lg:flex"
                onMouseDown={onResizeStart}
            >
                <span className="h-12 w-1 rounded-full bg-border transition-colors hover:bg-primary" />
            </button>
            {children}
        </section>
    );
}

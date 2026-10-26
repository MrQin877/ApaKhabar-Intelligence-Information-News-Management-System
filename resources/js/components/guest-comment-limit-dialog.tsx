import { Link } from '@inertiajs/react';
import { MessageCircleMore } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

export function GuestCommentLimitDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-xl p-6 text-center sm:p-8">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircleMore className="size-8" aria-hidden="true" />
                </div>
                <DialogTitle className="text-center text-xl">
                    Batas Komentar Harian Tercapai
                </DialogTitle>
                <DialogDescription className="mx-auto max-w-lg text-center leading-relaxed">
                    Kuota 3 komentar hari ini habis. Coba lagi besok atau masuk
                    untuk lanjut berkomentar.
                </DialogDescription>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Link
                        href="/register"
                        className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        Daftar
                    </Link>
                    <Link
                        href="/login"
                        className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        Masuk
                    </Link>
                </div>
            </DialogContent>
        </Dialog>
    );
}

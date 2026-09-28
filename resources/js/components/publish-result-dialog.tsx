import { router, usePage } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type PublishResult = {
    success: boolean;
    attempt_id: string;
    retry_url?: string;
    completion_url?: string;
    results: Record<string, { success: boolean; message: string }>;
};

export function PublishResultDialog() {
    const { publishResult } = usePage<{
        publishResult?: PublishResult | null;
    }>().props;
    const [dismissed, setDismissed] = useState<string | null>(null);

    if (!publishResult) {
        return null;
    }

    const entries = Object.entries(publishResult.results);
    const anySuccess = entries.some(([, result]) => result.success);
    const names: Record<string, string> = {
        application: 'Aplikasi',
        instagram: 'Instagram',
        facebook: 'Facebook',
    };
    const close = () => {
        setDismissed(publishResult.attempt_id);

        if (publishResult.success && publishResult.completion_url) {
            router.visit(publishResult.completion_url);
        }
    };

    return (
        <Dialog
            open={dismissed !== publishResult.attempt_id}
            onOpenChange={(open) => {
                if (!open) {
                    close();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {publishResult.success
                            ? 'Publikasi Berhasil'
                            : anySuccess
                              ? 'Publikasi Sebagian Berhasil'
                              : 'Publikasi Gagal'}
                    </DialogTitle>
                    <DialogDescription>
                        {publishResult.success
                            ? 'Berita berhasil diterbitkan ke semua platform yang dipilih.'
                            : 'Periksa hasil publikasi untuk setiap platform di bawah ini.'}
                    </DialogDescription>
                </DialogHeader>
                <ul className="space-y-3">
                    {entries.map(([platform, result]) => (
                        <li key={platform} className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 font-medium">
                                {result.success ? (
                                    <Check
                                        className="size-4 text-emerald-600"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <X
                                        className="size-4 text-destructive"
                                        aria-hidden="true"
                                    />
                                )}
                                {names[platform] ?? platform} —{' '}
                                {result.success ? 'Berhasil diterbitkan' : 'Gagal'}
                            </div>
                            {!result.success && (
                                <p className="text-muted-foreground">
                                    {result.message}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
                <DialogFooter>
                    {!publishResult.success && (
                        <Button
                            onClick={() => {
                                close();

                                if (publishResult.retry_url) {
                                    router.visit(publishResult.retry_url);
                                }
                            }}
                        >
                            Coba Lagi
                        </Button>
                    )}
                    <Button
                        variant={publishResult.success ? 'default' : 'outline'}
                        onClick={close}
                    >
                        Selesai
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

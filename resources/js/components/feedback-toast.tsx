import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export type Feedback = {
    message: string;
    variant: 'success' | 'error' | 'info';
};

export function FeedbackToast({
    feedback,
    onDismiss,
    inline = false,
}: {
    feedback: Feedback | null;
    onDismiss: () => void;
    inline?: boolean;
}) {
    useEffect(() => {
        if (!feedback) {
            return;
        }

        const timer = window.setTimeout(onDismiss, 4000);

        return () => window.clearTimeout(timer);
    }, [feedback, onDismiss]);

    if (!feedback) {
        return null;
    }

    const Icon =
        feedback.variant === 'success'
            ? CheckCircle2
            : feedback.variant === 'error'
              ? CircleAlert
              : Info;
    const colors = {
        success: 'border-success-border bg-success-bg text-success-text',
        error: 'border-danger-border bg-danger-bg text-danger-text',
        info: 'border-info-border bg-info-bg text-info-text',
    };

    return (
        <div
            role={feedback.variant === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${inline ? 'w-full' : 'fixed top-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm shadow-lg'} ${colors[feedback.variant]}`}
        >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1">{feedback.message}</p>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Tutup notifikasi"
                className="shrink-0 cursor-pointer rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}

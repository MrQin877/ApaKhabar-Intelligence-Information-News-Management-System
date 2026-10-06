import { useEffect, useState } from 'react';
import { FeedbackToast } from '@/components/feedback-toast';
import type { Feedback } from '@/components/feedback-toast';

export function ManualDraftToast() {
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    useEffect(() => {
        const saved = () =>
            setFeedback({
                variant: 'success',
                message: 'Berita berhasil disimpan sebagai draf.',
            });
        window.addEventListener('manual-draft-saved', saved);

        return () => window.removeEventListener('manual-draft-saved', saved);
    }, []);

    return (
        <FeedbackToast
            feedback={feedback}
            onDismiss={() => setFeedback(null)}
        />
    );
}

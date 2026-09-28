import { Sparkles } from 'lucide-react';

export function AssistantEmptyState() {
    return (
        <div className="mx-auto flex max-w-2xl flex-col items-center py-14 text-center md:py-20">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-card text-primary">
                <Sparkles className="size-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
                Apa yang ingin Anda kerjakan?
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Ekstrak informasi dari dokumen, cari sumber yang sudah
                disetujui, atau susun berita bersama Asisten AI.
            </p>
        </div>
    );
}

export function AssistantConversationIntro() {
    return (
        <div className="max-w-2xl text-sm leading-7 text-foreground">
            Pilih informasi atau dokumen tersimpan, atau lampirkan hingga lima
            file baru. Saya akan memeriksa kelengkapan sebelum melanjutkan.
        </div>
    );
}

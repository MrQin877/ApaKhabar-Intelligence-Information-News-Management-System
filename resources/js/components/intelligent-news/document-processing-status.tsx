import { LoaderCircle } from 'lucide-react';

export function DocumentProcessingStatus() {
    return (
        <div className="max-w-2xl text-sm leading-7 text-foreground">
            <div className="flex items-center gap-2 font-medium">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                Dokumen sedang diproses
            </div>
            <p className="mt-1 text-muted-foreground">
                Anda boleh meninggalkan halaman ini. Pemrosesan dilanjutkan oleh
                antrean dan percakapan dapat dibuka kembali dari riwayat.
            </p>
        </div>
    );
}

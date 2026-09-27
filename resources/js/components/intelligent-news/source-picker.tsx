import { Search, FileText, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { InformationItem, PendingInformationItem, DocumentItem } from './types';

export function SourcePicker({
    information,
    pendingInformation = [],
    documents,
    informationIds,
    documentIds,
    onClose,
    onApply,
}: {
    information: InformationItem[];
    pendingInformation?: PendingInformationItem[];
    documents: DocumentItem[];
    informationIds: number[];
    documentIds: number[];
    onClose: () => void;
    onApply: (information: number[], documents: number[]) => void;
}) {
    const [query, setQuery] = useState('');
    const [infoState, setInfoState] = useState<Set<number>>(new Set(informationIds));
    const [docState, setDocState] = useState<Set<number>>(new Set(documentIds));
    const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

    const term = query.toLocaleLowerCase();
    
    const infoByDoc = useMemo(() => {
        const map = new Map<number, InformationItem[]>();
        information.forEach(i => {
            if (!map.has(i.document_id)) {
map.set(i.document_id, []);
}

            map.get(i.document_id)!.push(i);
        });

        return map;
    }, [information]);

    const pendingByDoc = useMemo(() => {
        const map = new Map<number, PendingInformationItem[]>();
        pendingInformation.forEach(i => {
            if (!map.has(i.document_id)) {
map.set(i.document_id, []);
}

            map.get(i.document_id)!.push(i);
        });

        return map;
    }, [pendingInformation]);

    const filteredDocuments = useMemo(() => {
        return documents.filter(d => {
            if (d.original_name.toLocaleLowerCase().includes(term)) {
return true;
}

            const infos = infoByDoc.get(d.id) || [];

            if (infos.some(i => `${i.title} ${i.summary}`.toLocaleLowerCase().includes(term))) {
return true;
}

            const pendings = pendingByDoc.get(d.id) || [];

            if (pendings.some(i => `${i.title} ${i.summary}`.toLocaleLowerCase().includes(term))) {
return true;
}

            return false;
        });
    }, [documents, infoByDoc, pendingByDoc, term]);

    const handleDocToggle = (docId: number, checked: boolean | 'indeterminate') => {
        const nextDocs = new Set(docState);
        const nextInfo = new Set(infoState);

        if (checked === true) {
            nextDocs.add(docId);
            const infos = infoByDoc.get(docId) || [];
            infos.forEach(i => nextInfo.add(i.id));
        } else {
            nextDocs.delete(docId);
            const infos = infoByDoc.get(docId) || [];
            infos.forEach(i => nextInfo.delete(i.id));
            const pendings = pendingByDoc.get(docId) || [];
            pendings.forEach(i => nextInfo.delete(i.id));
        }

        setDocState(nextDocs);
        setInfoState(nextInfo);
    };

    const handleInfoToggle = (infoId: number, docId: number, checked: boolean) => {
        const nextInfo = new Set(infoState);

        if (checked) {
            nextInfo.add(infoId);
        } else {
            nextInfo.delete(infoId);
        }

        setInfoState(nextInfo);
        
        const nextDocs = new Set(docState);

        if (checked && !nextDocs.has(docId)) {
            nextDocs.add(docId);
        }

        setDocState(nextDocs);
    };

    const toggleExpand = (docId: number) => {
        const next = new Set(expandedDocs);

        if (next.has(docId)) {
next.delete(docId);
} else {
next.add(docId);
}

        setExpandedDocs(next);
    };

    const getDocCheckState = (docId: number) => {
        const hasDoc = docState.has(docId);
        const infos = infoByDoc.get(docId) || [];
        const pendings = pendingByDoc.get(docId) || [];
        
        const selectedApproved = infos.filter(i => infoState.has(i.id)).length;
        const selectedPending = pendings.filter(i => infoState.has(i.id)).length;
        const totalSelected = selectedApproved + selectedPending;
        
        const allApprovedSelected = infos.length > 0 && selectedApproved === infos.length;
        
        if (hasDoc && allApprovedSelected) {
return true;
}

        if (hasDoc || totalSelected > 0) {
return 'indeterminate';
}

        return false;
    };

    const count = infoState.size + docState.size;
    const hasPendingSelected = Array.from(infoState).some(id => pendingInformation.some(p => p.id === id));

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
                <DialogHeader className="border-b px-6 py-5">
                    <DialogTitle>Pilih sumber</DialogTitle>
                    <DialogDescription>
                        Pilih dokumen atau informasi spesifik untuk digunakan dalam pembuatan berita.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_260px]">
                    <div className="flex min-h-0 flex-col p-4">
                        <div className="relative mb-3">
                            <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
                            <Input
                                aria-label="Cari sumber"
                                className="pl-9"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Cari nama dokumen atau fakta..."
                            />
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                            {filteredDocuments.length} dokumen ditemukan.
                        </p>
                        <div className="max-h-[50dvh] space-y-3 overflow-y-auto pr-2">
                            {filteredDocuments.map(d => {
                                const infos = infoByDoc.get(d.id) || [];
                                const pendings = pendingByDoc.get(d.id) || [];
                                const expanded = expandedDocs.has(d.id);
                                const checkState = getDocCheckState(d.id);
                                
                                return (
                                    <div key={d.id} className="rounded-xl border bg-card overflow-hidden">
                                        <div className={`flex items-center gap-3 p-3 ${docState.has(d.id) ? 'bg-primary/5' : 'hover:bg-muted'}`}>
                                            <Checkbox
                                                checked={checkState}
                                                onCheckedChange={(c) => handleDocToggle(d.id, c)}
                                                disabled={d.status !== 'ready'}
                                                aria-label={`Pilih dokumen ${d.original_name}`}
                                            />
                                            <button 
                                                className="flex flex-1 items-center gap-3 min-w-0 text-left" 
                                                onClick={() => toggleExpand(d.id)}
                                            >
                                                <FileText className="size-5 shrink-0 text-muted-foreground" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">
                                                        {d.original_name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {infos.length} fakta disetujui, {pendings.length} menunggu
                                                    </span>
                                                </span>
                                                {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                                            </button>
                                        </div>
                                        {expanded && (infos.length > 0 || pendings.length > 0) && (
                                            <div className="border-t bg-muted/20 p-2 space-y-1">
                                                {infos.map(i => (
                                                    <label key={i.id} className="flex items-start gap-3 rounded p-2 hover:bg-muted/50 cursor-pointer">
                                                        <Checkbox 
                                                            checked={infoState.has(i.id)} 
                                                            onCheckedChange={(c) => handleInfoToggle(i.id, d.id, !!c)}
                                                            className="mt-1"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-medium">{i.title}</span>
                                                            <span className="block text-xs text-muted-foreground line-clamp-2">{i.summary}</span>
                                                        </span>
                                                    </label>
                                                ))}
                                                {pendings.length > 0 && (
                                                    <div className="mt-4 border-t pt-2 border-dashed">
                                                        <p className="px-2 mb-2 flex items-center gap-2 text-xs font-semibold text-warning-text">
                                                            <AlertCircle className="size-3" /> Menunggu tinjauan
                                                        </p>
                                                        {pendings.map(i => (
                                                            <label key={i.id} className="flex items-start gap-3 rounded p-2 hover:bg-muted/50 cursor-pointer opacity-75">
                                                                <Checkbox 
                                                                    checked={infoState.has(i.id)} 
                                                                    onCheckedChange={(c) => handleInfoToggle(i.id, d.id, !!c)}
                                                                    className="mt-1"
                                                                />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block text-sm font-medium text-warning-text">{i.title}</span>
                                                                    <span className="block text-xs text-muted-foreground line-clamp-2">{i.summary}</span>
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredDocuments.length === 0 && (
                                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    Tidak ada dokumen yang cocok. Coba kata lain atau unggah dokumen baru.
                                </p>
                            )}
                        </div>
                    </div>
                    <aside className="max-h-48 space-y-3 overflow-y-auto border-t bg-muted/30 p-4 md:max-h-[60dvh] md:border-t-0 md:border-l">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Terpilih ({count})</h3>
                            {count > 0 && (
                                <button
                                    className="text-xs text-muted-foreground underline hover:text-foreground"
                                    onClick={() => {
                                        setInfoState(new Set());
                                        setDocState(new Set());
                                    }}
                                >
                                    Hapus semua
                                </button>
                            )}
                        </div>
                        {!count && (
                            <p className="text-sm text-muted-foreground">
                                Pilih sumber di sebelah kiri.
                            </p>
                        )}
                        {hasPendingSelected && (
                            <div className="rounded border border-warning-border bg-warning-bg p-2 text-[10px] text-warning-text">
                                <AlertCircle className="mb-1 size-3" />
                                Anda memilih fakta yang belum disetujui. Fakta ini wajib ditinjau di Arsip Dokumen sebelum pembuatan berita dapat dimulai.
                            </div>
                        )}
                        {Array.from(docState).map(id => (
                            <div key={`d${id}`} className="flex items-start gap-2 text-xs">
                                <span className="flex-1 font-medium">
                                    {documents.find(d => d.id === id)?.original_name ?? `Dokumen ${id}`}
                                </span>
                                <button aria-label="Hapus dokumen" onClick={() => handleDocToggle(id, false)}>
                                    <X className="size-4" />
                                </button>
                            </div>
                        ))}
                        {Array.from(infoState).map(id => {
                            const i = information.find(i => i.id === id) || pendingInformation.find(i => i.id === id);

                            return (
                                <div key={`i${id}`} className="flex items-start gap-2 text-xs pl-2 border-l border-muted-foreground/30">
                                    <span className={`flex-1 ${pendingInformation.some(p => p.id === id) ? 'text-warning-text' : 'text-muted-foreground'}`}>
                                        {i?.title ?? `Informasi ${id}`}
                                    </span>
                                    <button aria-label="Hapus informasi" onClick={() => handleInfoToggle(id, i?.document_id || 0, false)}>
                                        <X className="size-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </aside>
                </div>
                <footer className="flex items-center justify-between border-t px-6 py-4 bg-muted/10">
                    <p className="text-xs text-muted-foreground">
                        {docState.size} dokumen, {infoState.size} fakta
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button onClick={() => onApply(Array.from(infoState), Array.from(docState))}>
                            Terapkan pilihan
                        </Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
}

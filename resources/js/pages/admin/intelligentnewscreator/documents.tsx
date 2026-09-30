import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Archive,
    ArchiveRestore,
    Bot,
    CheckCircle2,
    Clock3,
    Download,
    Eye,
    FileSearch,
    FileText,
    LoaderCircle,
    MoreHorizontal,
    RotateCcw,
    Search,
    ShieldCheck,
    Upload,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type DocStatus = 'ready' | 'processing' | 'failed';
type ReviewStatus = 'pending' | 'approved' | 'rejected';
type LibraryFilter = 'all' | 'review' | 'processing' | 'approved' | 'failed';

interface ExtractedInformation {
    id: number;
    year: string;
    text: string;
    confidence: number | null;
    quality_score: number | null;
    review_status: ReviewStatus;
    embedding_status: 'pending' | 'ready' | 'failed';
}

interface DocumentItem {
    id: number;
    name: string;
    type: 'pdf' | 'docx' | 'img' | 'spreadsheet' | 'txt';
    size: string;
    date: string;
    status: DocStatus;
    extract: ExtractedInformation[];
    error?: string | null;
    attempts?: number;
    previewable: boolean;
    archive_after?: string | null;
    archived_at?: string | null;
}

const filters: Array<{ value: LibraryFilter; label: string }> = [
    { value: 'all', label: 'Semua' },
    { value: 'review', label: 'Perlu ditinjau' },
    { value: 'processing', label: 'Diproses' },
    { value: 'approved', label: 'Disetujui' },
    { value: 'failed', label: 'Gagal' },
];

const REVIEW_PAGE_SIZE = 5;

function documentState(document: DocumentItem): LibraryFilter {
    if (document.status === 'failed') {
        return 'failed';
    }

    if (document.status === 'processing') {
        return 'processing';
    }

    if (document.extract.some((item) => item.review_status === 'pending')) {
        return 'review';
    }

    if (document.extract.some((item) => item.review_status === 'approved')) {
        return 'approved';
    }

    return 'all';
}

function StatusBadge({ document }: { document: DocumentItem }) {
    const state = documentState(document);

    if (state === 'processing') {
        return (
            <Badge variant="secondary">
                <LoaderCircle className="animate-spin" /> Diproses
            </Badge>
        );
    }

    if (state === 'failed') {
        return (
            <Badge variant="destructive">
                <XCircle /> Gagal
            </Badge>
        );
    }

    if (state === 'review') {
        return (
            <Badge className="border-warning-border bg-warning-bg text-warning-text">
                <Clock3 /> Perlu ditinjau
            </Badge>
        );
    }

    if (state === 'approved') {
        return (
            <Badge className="border-success-border bg-success-bg text-success-text">
                <ShieldCheck /> Disetujui
            </Badge>
        );
    }

    return <Badge variant="outline">Tidak ada informasi</Badge>;
}

function documentQuality(document: DocumentItem): number | null {
    const scores = document.extract
        .map((item) => item.quality_score)
        .filter((score): score is number => score !== null);

    if (!scores.length) {
        return null;
    }

    return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function informationTitle(item: ExtractedInformation) {
    return item.text.split(' — ')[0] || 'Informasi hasil ekstraksi';
}

function informationDescription(item: ExtractedInformation) {
    const description = item.text.split(' — ').slice(1).join(' — ');

    return description || item.text;
}

export default function DocumentLibrary({
    documents = [],
    archived = false,
}: {
    documents?: DocumentItem[];
    archived?: boolean;
}) {
    const errors = (usePage().props.errors ?? {}) as Record<string, string>;
    const [fileType, updateFileType] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize, updatePageSize] = useState(10);
    const [preview, setPreview] = useState<DocumentItem | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [filter, updateFilter] = useState<LibraryFilter>('all');
    const [query, updateQuery] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [reviewPage, setReviewPage] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [selectedInformationIds, setSelectedInformationIds] = useState<
        number[]
    >([]);
    const [reviewTarget, setReviewTarget] = useState<{
        items: ExtractedInformation[];
        decision: 'approved' | 'rejected';
    } | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<{
        document: DocumentItem;
        action: 'archive' | 'restore';
    } | null>(null);
    const [uploading, setUploading] = useState<{
        label: string;
        progress: number;
    } | null>(null);
    const setFilter = (value: LibraryFilter) => {
        setPage(1);
        updateFilter(value);
    };
    const setQuery = (value: string) => {
        setPage(1);
        updateQuery(value);
    };
    const setFileType = (value: string) => {
        setPage(1);
        updateFileType(value);
    };
    const setPageSize = (value: number) => {
        setPage(1);
        updatePageSize(value);
    };
    const fileInput = useRef<HTMLInputElement>(null);

    const selected = useMemo(
        () => documents.find((document) => document.id === selectedId) ?? null,
        [documents, selectedId],
    );

    const reviewPageCount = Math.max(
        1,
        Math.ceil((selected?.extract.length ?? 0) / REVIEW_PAGE_SIZE),
    );
    const currentReviewPage = Math.min(reviewPage, reviewPageCount);
    const paginatedInformation = useMemo(() => {
        const start = (currentReviewPage - 1) * REVIEW_PAGE_SIZE;

        return selected?.extract.slice(start, start + REVIEW_PAGE_SIZE) ?? [];
    }, [currentReviewPage, selected]);
    const pendingOnPage = paginatedInformation.filter(
        (item) => item.review_status === 'pending',
    );
    const allPendingOnPageSelected =
        pendingOnPage.length > 0 &&
        pendingOnPage.every((item) => selectedInformationIds.includes(item.id));

    const counts = useMemo(() => {
        const count = (state: LibraryFilter) =>
            state === 'all'
                ? documents.length
                : documents.filter(
                      (document) => documentState(document) === state,
                  ).length;

        return Object.fromEntries(
            filters.map(({ value }) => [value, count(value)]),
        ) as Record<LibraryFilter, number>;
    }, [documents]);

    const shownDocuments = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase('id');

        return documents.filter((document) => {
            const matchesState =
                filter === 'all' || documentState(document) === filter;
            const matchesQuery =
                !needle ||
                [document.name, ...document.extract.map((item) => item.text)]
                    .join(' ')
                    .toLocaleLowerCase('id')
                    .includes(needle);

            return (
                matchesState &&
                matchesQuery &&
                (fileType === 'all' || document.type === fileType)
            );
        });
    }, [documents, filter, query, fileType]);
    const pageCount = Math.max(1, Math.ceil(shownDocuments.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const paginatedDocuments = shownDocuments.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
    );

    useEffect(() => {
        if (!documents.some((document) => document.status === 'processing')) {
            return;
        }

        const timer = window.setInterval(
            () => router.reload({ only: ['documents'] }),
            5000,
        );

        return () => window.clearInterval(timer);
    }, [documents]);

    function openReview(document: DocumentItem) {
        setSelectedId(document.id);
        setReviewPage(1);
        setSelectedInformationIds([]);
    }

    function previewDocument(document: DocumentItem) {
        setPreviewLoading(true);
        setPreview(document);
    }

    function upload(files: File[]) {
        if (!files.length) {
            return;
        }

        if (files.length > 5) {
            return window.alert('Maksimum lima file untuk setiap unggahan.');
        }

        const oversized = files.find((file) => file.size > 20 * 1024 * 1024);

        if (oversized) {
            window.alert(
                `${oversized.name} melebihi batas 20 MB per file. Pisahkan atau kompres file terlebih dahulu.`,
            );

            return;
        }

        const supported = [
            'pdf',
            'docx',
            'xlsx',
            'xlsm',
            'csv',
            'txt',
            'jpg',
            'jpeg',
            'png',
        ];

        if (
            files.some(
                (file) =>
                    !supported.includes(
                        file.name.split('.').pop()?.toLowerCase() ?? '',
                    ),
            )
        ) {
            return window.alert(
                'Gunakan PDF, DOCX, XLSX, XLSM, CSV, TXT, JPG, JPEG, atau PNG.',
            );
        }

        const data = new FormData();
        files.forEach((file) => data.append('documents[]', file));
        data.append('origin', 'library');
        data.append('intent', 'extract_information');
        data.append('extraction_mode', 'general');
        setUploading({ label: `${files.length} file`, progress: 0 });
        router.post('/admin/documents', data, {
            forceFormData: true,
            preserveScroll: true,
            onProgress: (progress) =>
                setUploading({
                    label: `${files.length} file`,
                    progress: progress?.percentage ?? 0,
                }),
            onFinish: () => setUploading(null),
        });
    }

    function changeFiles(event: ChangeEvent<HTMLInputElement>) {
        upload(Array.from(event.target.files ?? []));
        event.target.value = '';
    }

    function dropFiles(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragging(false);
        upload(Array.from(event.dataTransfer.files));
    }

    function confirmReview() {
        if (!reviewTarget) {
            return;
        }

        const ids = reviewTarget.items.map((item) => item.id);
        const url =
            ids.length === 1
                ? `/admin/information/${ids[0]}/review`
                : '/admin/information/review/bulk';
        const payload =
            ids.length === 1
                ? { decision: reviewTarget.decision }
                : {
                      decision: reviewTarget.decision,
                      information_ids: ids,
                  };

        router.post(url, payload, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedInformationIds([]);
                setReviewTarget(null);
                router.reload({ only: ['documents'] });
            },
        });
    }

    function confirmArchiveAction() {
        if (!archiveTarget) {
            return;
        }

        router.post(
            `/admin/documents/${archiveTarget.document.id}/${archiveTarget.action}`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setArchiveTarget(null),
            },
        );
    }

    return (
        <>
            <Dialog
                open={Boolean(preview)}
                onOpenChange={(open) => !open && setPreview(null)}
            >
                <DialogContent className="flex h-[90dvh] max-w-[96vw] flex-col sm:max-w-[96vw]">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">
                            {preview?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Pratinjau dokumen asli. Untuk format dan isi
                            lengkap, unduh file.
                        </DialogDescription>
                    </DialogHeader>
                    {preview && (
                        <>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <a
                                        href={`/admin/documents/${preview.id}/preview?download=1`}
                                    >
                                        Unduh asli
                                    </a>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        openReview(preview);
                                        setPreview(null);
                                    }}
                                >
                                    Tinjau informasi
                                </Button>
                            </div>
                            {previewLoading && (
                                <p
                                    role="status"
                                    className="text-sm text-muted-foreground"
                                >
                                    Memuat pratinjau…
                                </p>
                            )}
                            <iframe
                                key={preview.id}
                                title={`Pratinjau ${preview.name}`}
                                src={`/admin/documents/${preview.id}/preview`}
                                onLoad={() => setPreviewLoading(false)}
                                className="min-h-0 flex-1 rounded-lg border bg-white"
                            />
                        </>
                    )}
                </DialogContent>
            </Dialog>
            <Head title={archived ? 'Arsip Dokumen' : 'Pustaka Dokumen'} />
            <div className="min-h-full bg-background p-4 text-foreground md:p-6">
                <div className="mx-auto flex max-w-7xl flex-col gap-6">
                    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {archived ? 'Arsip dokumen' : 'Pustaka dokumen'}
                            </h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                                {archived
                                    ? 'Dokumen terarsip tidak ditampilkan atau digunakan oleh AI sampai dipulihkan.'
                                    : 'Kelola dokumen sumber, tinjau hasil ekstraksi, dan setujui fakta sebelum digunakan oleh AI.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.visit(
                                        archived
                                            ? '/admin/documents'
                                            : '/admin/documents/archived',
                                    )
                                }
                            >
                                {archived ? <FileText /> : <Archive />}
                                {archived ? 'Pustaka aktif' : 'Lihat arsip'}
                            </Button>
                        </div>
                    </header>

                    {(errors.document ||
                        errors.documents ||
                        errors.information) && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>
                                Dokumen memerlukan perhatian
                            </AlertTitle>
                            <AlertDescription>
                                {errors.document ||
                                    errors.documents ||
                                    errors.information}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!archived && (
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => fileInput.current?.click()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    fileInput.current?.click();
                                }
                            }}
                            className={`flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}`}
                            onDragEnter={(event) => {
                                event.preventDefault();
                                setDragging(true);
                            }}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={(event) => {
                                event.preventDefault();
                                setDragging(false);
                            }}
                            onDrop={dropFiles}
                        >
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Upload className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1 text-center sm:text-left">
                                <p className="text-sm font-medium">
                                    Klik untuk memilih atau seret hingga 5
                                    dokumen ke area ini
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Mendukung PDF, Word, Excel, CSV, teks, dan
                                    gambar (Maks 20 MB/file)
                                </p>
                                {uploading && (
                                    <div
                                        className="mt-3 max-w-sm"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Progress
                                            value={uploading.progress}
                                            className="h-1.5"
                                        />
                                        <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                                            Mengunggah {uploading.label} ·{' '}
                                            {Math.round(uploading.progress)}%
                                        </p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileInput}
                                type="file"
                                multiple
                                className="hidden"
                                accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.jpg,.jpeg,.png"
                                onChange={changeFiles}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="md:hidden">
                            <Select
                                value={filter}
                                onValueChange={(value) =>
                                    setFilter(value as LibraryFilter)
                                }
                            >
                                <SelectTrigger
                                    className="w-full"
                                    aria-label="Filter status dokumen"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {filters.map((item) => (
                                        <SelectItem
                                            key={item.value}
                                            value={item.value}
                                        >
                                            {item.label} ({counts[item.value]})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Tabs
                            className="hidden md:block"
                            value={filter}
                            onValueChange={(value) =>
                                setFilter(value as LibraryFilter)
                            }
                        >
                            <TabsList className="h-auto flex-wrap justify-start">
                                {filters.map((item) => (
                                    <TabsTrigger
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                        <Badge
                                            variant="secondary"
                                            className="ml-1.5"
                                        >
                                            {counts[item.value]}
                                        </Badge>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <div className="relative w-full xl:w-72">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Cari dokumen atau informasi…"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <p className="text-muted-foreground">
                            {shownDocuments.length} file ditemukan
                        </p>
                        <Select value={fileType} onValueChange={setFileType}>
                            <SelectTrigger
                                className="w-full sm:w-48"
                                aria-label="Filter jenis file"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Semua jenis file
                                </SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                                <SelectItem value="docx">Word</SelectItem>
                                <SelectItem value="spreadsheet">
                                    Excel & CSV
                                </SelectItem>
                                <SelectItem value="img">Gambar</SelectItem>
                                <SelectItem value="txt">Teks</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {shownDocuments.length === 0 ? (
                        <Card className="border-dashed py-14 text-center shadow-none">
                            <CardContent>
                                <FileSearch className="mx-auto size-9 text-muted-foreground" />
                                <p className="mt-3 font-medium">
                                    Tidak ada dokumen pada tahap ini
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {archived
                                        ? 'Belum ada dokumen yang diarsipkan.'
                                        : 'Ubah filter atau unggah dokumen baru.'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="overflow-hidden py-0 shadow-none">
                            <Table className="block md:table">
                                <TableHeader className="hidden md:table-header-group">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-5">
                                            Dokumen
                                        </TableHead>
                                        <TableHead>Informasi</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Diperbarui</TableHead>
                                        <TableHead>
                                            <span className="sr-only">
                                                Tindakan
                                            </span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="block md:table-row-group">
                                    {paginatedDocuments.map((document) => {
                                        const pending = document.extract.filter(
                                            (item) =>
                                                item.review_status ===
                                                'pending',
                                        ).length;
                                        const approved =
                                            document.extract.filter(
                                                (item) =>
                                                    item.review_status ===
                                                    'approved',
                                            ).length;

                                        return (
                                            <TableRow
                                                key={document.id}
                                                className="grid grid-cols-2 gap-2 p-3 md:table-row md:p-0"
                                            >
                                                <TableCell className="col-span-2 min-w-0 p-1 md:pl-5">
                                                    <div className="flex min-w-0 items-center gap-3 md:min-w-60">
                                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                                                            <FileText className="size-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button
                                                                type="button"
                                                                className="block max-w-full text-left font-medium break-all whitespace-normal hover:underline md:max-w-72 md:truncate"
                                                                onClick={() =>
                                                                    previewDocument(
                                                                        document,
                                                                    )
                                                                }
                                                            >
                                                                {document.name}
                                                            </button>
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {document.type.toUpperCase()}{' '}
                                                                ·{' '}
                                                                {document.size}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <p className="font-medium">
                                                            {
                                                                document.extract
                                                                    .length
                                                            }{' '}
                                                            ditemukan
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {pending > 0
                                                                ? `${pending} perlu ditinjau`
                                                                : `${approved} disetujui`}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        document={document}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {document.date}
                                                </TableCell>
                                                <TableCell className="col-span-2 p-1 text-right md:pr-4">
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                        {!archived && (
                                                            <Button
                                                                size="sm"
                                                                variant={
                                                                    pending > 0
                                                                        ? 'default'
                                                                        : 'outline'
                                                                }
                                                                className={
                                                                    document.status ===
                                                                    'failed'
                                                                        ? ' '
                                                                        : undefined
                                                                }
                                                                disabled={
                                                                    document.status ===
                                                                    'processing'
                                                                }
                                                                onClick={() => {
                                                                    if (
                                                                        document.status ===
                                                                        'failed'
                                                                    ) {
                                                                        router.post(
                                                                            `/admin/documents/${document.id}/retry`,
                                                                            {},
                                                                            {
                                                                                preserveScroll: true,
                                                                            },
                                                                        );

                                                                        return;
                                                                    }

                                                                    openReview(
                                                                        document,
                                                                    );
                                                                }}
                                                            >
                                                                {document.status ===
                                                                'failed' ? (
                                                                    <>
                                                                        <RotateCcw />
                                                                        Coba
                                                                        lagi
                                                                    </>
                                                                ) : document.status ===
                                                                  'processing' ? (
                                                                    <>
                                                                        <LoaderCircle className="animate-spin" />
                                                                        Diproses
                                                                    </>
                                                                ) : pending >
                                                                  0 ? (
                                                                    'Tinjau'
                                                                ) : (
                                                                    'Lihat'
                                                                )}
                                                            </Button>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    aria-label={`Tindakan untuk ${document.name}`}
                                                                >
                                                                    <MoreHorizontal />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        previewDocument(
                                                                            document,
                                                                        )
                                                                    }
                                                                >
                                                                    {document.previewable ? (
                                                                        <Eye />
                                                                    ) : (
                                                                        <Download />
                                                                    )}
                                                                    {document.previewable
                                                                        ? 'Pratinjau dokumen'
                                                                        : 'Unduh dokumen'}
                                                                </DropdownMenuItem>
                                                                {!archived &&
                                                                    approved >
                                                                        0 && (
                                                                        <DropdownMenuItem
                                                                            onClick={() =>
                                                                                router.visit(
                                                                                    `/admin/ai-assistant?doc=${document.id}`,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Bot />
                                                                            Gunakan
                                                                            di
                                                                            AI
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        setArchiveTarget(
                                                                            {
                                                                                document,
                                                                                action: archived
                                                                                    ? 'restore'
                                                                                    : 'archive',
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    {archived ? (
                                                                        <ArchiveRestore />
                                                                    ) : (
                                                                        <Archive />
                                                                    )}
                                                                    {archived
                                                                        ? 'Pulihkan dokumen'
                                                                        : 'Arsipkan dokumen'}
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
                                <label>
                                    File per halaman{' '}
                                    <select
                                        aria-label="File per halaman"
                                        value={pageSize}
                                        onChange={(e) =>
                                            setPageSize(Number(e.target.value))
                                        }
                                        className="ml-2 rounded border bg-background p-1"
                                    >
                                        {[10, 20, 50].map((n) => (
                                            <option key={n}>{n}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage === 1}
                                        onClick={() => setPage(safePage - 1)}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        {safePage} / {pageCount}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage === pageCount}
                                        onClick={() => setPage(safePage + 1)}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            <Sheet
                open={Boolean(selected)}
                onOpenChange={(open) => !open && setSelectedId(null)}
            >
                <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
                    <SheetHeader className="border-b px-5 py-4 pr-12">
                        <SheetTitle className="truncate">
                            {selected?.name}
                        </SheetTitle>
                        <SheetDescription>
                            Tinjau maksimal lima informasi per halaman. Hanya
                            informasi yang disetujui dapat digunakan oleh AI.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">
                                {selected?.extract.length ?? 0} informasi
                            </Badge>
                            {!!selected?.extract.filter(
                                (item) => item.review_status === 'pending',
                            ).length && (
                                <Badge className="border-warning-border bg-warning-bg text-warning-text">
                                    {
                                        selected.extract.filter(
                                            (item) =>
                                                item.review_status ===
                                                'pending',
                                        ).length
                                    }{' '}
                                    menunggu
                                </Badge>
                            )}
                        </div>
                        {selected && documentQuality(selected) !== null && (
                            <Badge variant="outline">
                                Kualitas dokumen{' '}
                                {documentQuality(selected)?.toFixed(1)}%
                            </Badge>
                        )}
                        {selected && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => previewDocument(selected)}
                            >
                                {selected.previewable ? <Eye /> : <Download />}
                                {selected.previewable
                                    ? 'Pratinjau dokumen'
                                    : 'Unduh dokumen'}
                            </Button>
                        )}
                    </div>

                    {!archived && pendingOnPage.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    checked={allPendingOnPageSelected}
                                    onCheckedChange={(checked) => {
                                        const pageIds = pendingOnPage.map(
                                            (item) => item.id,
                                        );
                                        setSelectedInformationIds((current) =>
                                            checked
                                                ? Array.from(
                                                      new Set([
                                                          ...current,
                                                          ...pageIds,
                                                      ]),
                                                  )
                                                : current.filter(
                                                      (id) =>
                                                          !pageIds.includes(id),
                                                  ),
                                        );
                                    }}
                                />
                                Pilih semua di halaman ini
                            </label>
                            <Button
                                size="sm"
                                disabled={selectedInformationIds.length === 0}
                                onClick={() =>
                                    setReviewTarget({
                                        items:
                                            selected?.extract.filter((item) =>
                                                selectedInformationIds.includes(
                                                    item.id,
                                                ),
                                            ) ?? [],
                                        decision: 'approved',
                                    })
                                }
                            >
                                <CheckCircle2 /> Setujui terpilih (
                                {selectedInformationIds.length})
                            </Button>
                        </div>
                    )}

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                        {selected?.status === 'processing' && (
                            <Alert>
                                <LoaderCircle className="animate-spin" />
                                <AlertTitle>Dokumen masih diproses</AlertTitle>
                                <AlertDescription>
                                    Hasil ekstraksi akan muncul otomatis setelah
                                    pekerja latar belakang selesai.
                                </AlertDescription>
                            </Alert>
                        )}
                        {selected?.status === 'failed' && (
                            <Alert variant="destructive">
                                <AlertCircle />
                                <AlertTitle>Ekstraksi gagal</AlertTitle>
                                <AlertDescription>
                                    {selected.error ||
                                        'Tidak ditemukan informasi yang dapat digunakan.'}
                                </AlertDescription>
                            </Alert>
                        )}
                        {paginatedInformation.map((item) => (
                            <Card
                                key={item.id}
                                className="gap-3 py-4 shadow-none"
                            >
                                <CardHeader className="px-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            {!archived &&
                                                item.review_status ===
                                                    'pending' && (
                                                    <Checkbox
                                                        className="mt-1"
                                                        checked={selectedInformationIds.includes(
                                                            item.id,
                                                        )}
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            setSelectedInformationIds(
                                                                (current) =>
                                                                    checked
                                                                        ? [
                                                                              ...current,
                                                                              item.id,
                                                                          ]
                                                                        : current.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  id !==
                                                                                  item.id,
                                                                          ),
                                                            )
                                                        }
                                                        aria-label={`Pilih ${informationTitle(item)}`}
                                                    />
                                                )}
                                            <CardTitle className="text-sm leading-6">
                                                {informationTitle(item)}
                                            </CardTitle>
                                        </div>
                                        <Badge
                                            variant={
                                                item.review_status ===
                                                'approved'
                                                    ? 'default'
                                                    : item.review_status ===
                                                        'rejected'
                                                      ? 'destructive'
                                                      : 'secondary'
                                            }
                                        >
                                            {item.review_status === 'approved'
                                                ? 'Disetujui'
                                                : item.review_status ===
                                                    'rejected'
                                                  ? 'Ditolak'
                                                  : 'Menunggu tinjauan'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 px-4">
                                    <p className="text-sm leading-6 text-muted-foreground">
                                        {informationDescription(item)}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline">
                                            Kualitas{' '}
                                            {item.quality_score == null
                                                ? '–'
                                                : `${item.quality_score.toFixed(1)}%`}
                                        </Badge>
                                        <Badge variant="outline">
                                            Keyakinan model{' '}
                                            {item.confidence == null
                                                ? '–'
                                                : `${Math.round(item.confidence * 100)}%`}
                                        </Badge>
                                        <Badge variant="outline">
                                            Indeks {item.embedding_status}
                                        </Badge>
                                    </div>
                                    {!archived &&
                                        item.review_status === 'pending' && (
                                            <div className="grid grid-cols-2 gap-2 border-t pt-3">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        setReviewTarget({
                                                            items: [item],
                                                            decision:
                                                                'approved',
                                                        })
                                                    }
                                                >
                                                    <CheckCircle2 /> Setujui
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() =>
                                                        setReviewTarget({
                                                            items: [item],
                                                            decision:
                                                                'rejected',
                                                        })
                                                    }
                                                >
                                                    <XCircle /> Tolak
                                                </Button>
                                            </div>
                                        )}
                                    {item.review_status !== 'pending' && (
                                        <p className="border-t pt-3 text-xs text-muted-foreground">
                                            Keputusan telah disimpan. Status
                                            dapat ditinjau dari label di atas.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                        {selected?.status === 'ready' &&
                            selected.extract.length === 0 && (
                                <Alert>
                                    <AlertCircle />
                                    <AlertTitle>Tidak ada informasi</AlertTitle>
                                    <AlertDescription>
                                        Dokumen dapat dibaca, tetapi belum
                                        menghasilkan informasi yang dapat
                                        ditinjau. Coba proses ulang dengan
                                        arahan ekstraksi yang lebih sesuai.
                                    </AlertDescription>
                                </Alert>
                            )}
                    </div>

                    {selected && selected.extract.length > REVIEW_PAGE_SIZE && (
                        <div className="flex flex-col gap-2 border-t bg-background px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">
                                Menampilkan{' '}
                                {(currentReviewPage - 1) * REVIEW_PAGE_SIZE + 1}
                                –
                                {Math.min(
                                    currentReviewPage * REVIEW_PAGE_SIZE,
                                    selected.extract.length,
                                )}{' '}
                                dari {selected.extract.length}
                            </p>
                            <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            aria-disabled={
                                                currentReviewPage === 1
                                            }
                                            className={
                                                currentReviewPage === 1
                                                    ? 'pointer-events-none opacity-50'
                                                    : undefined
                                            }
                                            onClick={(event) => {
                                                event.preventDefault();
                                                setReviewPage((page) =>
                                                    Math.max(1, page - 1),
                                                );
                                            }}
                                        />
                                    </PaginationItem>
                                    {Array.from(
                                        { length: reviewPageCount },
                                        (_, index) => index + 1,
                                    ).map((page) => (
                                        <PaginationItem key={page}>
                                            <PaginationLink
                                                href="#"
                                                isActive={
                                                    page === currentReviewPage
                                                }
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setReviewPage(page);
                                                }}
                                            >
                                                {page}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            aria-disabled={
                                                currentReviewPage ===
                                                reviewPageCount
                                            }
                                            className={
                                                currentReviewPage ===
                                                reviewPageCount
                                                    ? 'pointer-events-none opacity-50'
                                                    : undefined
                                            }
                                            onClick={(event) => {
                                                event.preventDefault();
                                                setReviewPage((page) =>
                                                    Math.min(
                                                        reviewPageCount,
                                                        page + 1,
                                                    ),
                                                );
                                            }}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <AlertDialog
                open={Boolean(reviewTarget)}
                onOpenChange={(open) => !open && setReviewTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {reviewTarget?.decision === 'approved'
                                ? 'Setujui informasi terpilih?'
                                : 'Tolak informasi ini?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {reviewTarget?.decision === 'approved'
                                ? `${reviewTarget.items.length} informasi akan ditambahkan ke indeks pencarian dan dapat digunakan oleh Asisten AI.`
                                : 'Informasi akan dihapus secara lunak dari pustaka aktif dan tidak dapat digunakan oleh Asisten AI.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className={
                                reviewTarget?.decision === 'rejected'
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : undefined
                            }
                            onClick={confirmReview}
                        >
                            {reviewTarget?.decision === 'approved'
                                ? 'Ya, setujui'
                                : 'Ya, tolak'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={Boolean(archiveTarget)}
                onOpenChange={(open) => !open && setArchiveTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {archiveTarget?.action === 'restore'
                                ? 'Pulihkan dokumen?'
                                : 'Arsipkan dokumen?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {archiveTarget?.action === 'restore'
                                ? 'Dokumen dan informasi yang pernah disetujui akan kembali tersedia untuk Asisten AI.'
                                : 'Dokumen akan disembunyikan dari pustaka aktif dan tidak dapat digunakan oleh Asisten AI. Dokumen tetap dapat dipulihkan dari arsip.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmArchiveAction}>
                            {archiveTarget?.action === 'restore'
                                ? 'Pulihkan'
                                : 'Arsipkan'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dokumen', href: '/admin/documents' },
];
DocumentLibrary.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);

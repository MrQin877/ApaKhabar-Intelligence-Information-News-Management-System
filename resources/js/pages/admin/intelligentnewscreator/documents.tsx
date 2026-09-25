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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
    type: 'pdf' | 'docx' | 'img';
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
    const [filter, setFilter] = useState<LibraryFilter>('all');
    const [query, setQuery] = useState('');
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

            return matchesState && matchesQuery;
        });
    }, [documents, filter, query]);

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
        window.open(
            `/admin/documents/${document.id}/preview`,
            '_blank',
            'noopener,noreferrer',
        );
    }

    function upload(files: File[]) {
        if (!files.length) {
            return;
        }

        if (files.length > 5) {
            return window.alert('Maksimum lima file untuk setiap unggahan.');
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
        if (!reviewTarget) return;

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
        if (!archiveTarget) return;

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
                        <div className="flex gap-2">
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
                            {!archived && (
                                <Button
                                    onClick={() => fileInput.current?.click()}
                                >
                                    <Upload /> Unggah dokumen
                                </Button>
                            )}
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

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            {
                                label: 'Semua dokumen',
                                value: counts.all,
                                icon: FileText,
                            },
                            {
                                label: 'Perlu ditinjau',
                                value: counts.review,
                                icon: Clock3,
                            },
                            {
                                label: 'Sedang diproses',
                                value: counts.processing,
                                icon: LoaderCircle,
                            },
                            {
                                label: 'Disetujui',
                                value: counts.approved,
                                icon: ShieldCheck,
                            },
                        ].map(({ label, value, icon: Icon }) => (
                            <Card
                                key={label}
                                className="gap-2 py-4 shadow-none"
                            >
                                <CardContent className="flex items-center justify-between px-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            {label}
                                        </p>
                                        <p className="mt-1 text-2xl font-semibold">
                                            {value}
                                        </p>
                                    </div>
                                    <Icon
                                        className={`size-5 text-muted-foreground ${label === 'Sedang diproses' && value > 0 ? 'animate-spin' : ''}`}
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {!archived && (
                        <Card
                            className={`border-dashed py-0 shadow-none transition-colors ${dragging ? 'border-primary bg-primary/5' : ''}`}
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
                            <CardContent className="flex flex-col items-center gap-3 px-5 py-7 text-center sm:flex-row sm:text-left">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Upload />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                        Letakkan hingga lima dokumen di sini
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        PDF, Word, Excel, CSV, teks, dan gambar
                                        OCR · maksimum 20 MB per file
                                    </p>
                                    {uploading && (
                                        <div className="mt-3 max-w-md">
                                            <Progress
                                                value={uploading.progress}
                                            />
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Mengunggah {uploading.label} ·{' '}
                                                {Math.round(uploading.progress)}
                                                %
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => fileInput.current?.click()}
                                >
                                    Pilih file
                                </Button>
                                <input
                                    ref={fileInput}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.jpg,.jpeg,.png"
                                    onChange={changeFiles}
                                />
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <Tabs
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
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-5">
                                            Dokumen
                                        </TableHead>
                                        <TableHead>Informasi</TableHead>
                                        <TableHead className="min-w-40">
                                            Kualitas
                                        </TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Diperbarui</TableHead>
                                        <TableHead>
                                            <span className="sr-only">
                                                Tindakan
                                            </span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shownDocuments.map((document) => {
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
                                        const quality =
                                            documentQuality(document);

                                        return (
                                            <TableRow key={document.id}>
                                                <TableCell className="pl-5">
                                                    <div className="flex min-w-60 items-center gap-3">
                                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                                                            <FileText className="size-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button
                                                                type="button"
                                                                className="block max-w-72 truncate text-left font-medium hover:underline"
                                                                onClick={() =>
                                                                    openReview(
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
                                                    {quality === null ? (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    ) : (
                                                        <div className="max-w-36 space-y-1.5">
                                                            <div className="flex justify-between gap-3 text-xs">
                                                                <span className="font-medium">
                                                                    {quality.toFixed(
                                                                        1,
                                                                    )}
                                                                    %
                                                                </span>
                                                                <span className="text-muted-foreground">
                                                                    {quality >=
                                                                    85
                                                                        ? 'Sangat baik'
                                                                        : quality >=
                                                                            70
                                                                          ? 'Baik'
                                                                          : 'Perlu cek'}
                                                                </span>
                                                            </div>
                                                            <Progress
                                                                value={quality}
                                                                className="h-1.5"
                                                            />
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        document={document}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {document.date}
                                                </TableCell>
                                                <TableCell className="pr-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
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

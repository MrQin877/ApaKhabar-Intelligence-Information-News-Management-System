import { Head, router, usePage } from '@inertiajs/react';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Archive,
    ArrowLeft,
    Bold,
    Bot,
    ChevronDown,
    ChevronRight,
    Clock3,
    Edit3,
    FileText,
    FolderSearch,
    ImagePlus,
    Italic,
    List,
    ListOrdered,
    LoaderCircle,
    Paperclip,
    Redo2,
    Save,
    Send,
    Sparkles,
    Underline,
    Undo2,
    X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { apiFetch } from '@/lib/api';
import type { BreadcrumbItem } from '@/types';

interface InformationItem {
    id: number;
    document_id: number;
    title: string;
    summary: string;
    labels: string[];
    document: { id: number; original_name: string };
}
interface DocumentItem {
    id: number;
    original_name: string;
    status: string;
}
interface MissingQuestion {
    field: string;
    importance: 'required' | 'recommended';
    kind?:
        | 'unverified_subject'
        | 'possible_typo'
        | 'format_choice'
        | 'missing_fact'
        | 'conflict';
    question: string;
    reason?: string | null;
    options?: string[];
    selection_type?: 'single' | 'multi' | 'ranked' | 'text';
    sources?: Array<{
        title: string;
        url: string;
        snippet: string;
        published_at?: string | null;
        source?: string;
    }>;
}
interface UserFact {
    field: string;
    value: string;
}
interface SessionMessage {
    id: number;
    role: 'user' | 'assistant' | 'tool' | 'system';
    intent: string | null;
    content: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
}
interface NewsSession {
    id: number;
    status:
        | 'collecting_sources'
        | 'processing_files'
        | 'awaiting_answers'
        | 'ready_to_generate'
        | 'draft_generated';
    prompt: string | null;
    selected_document_ids: number[];
    selected_information_ids: number[];
    pending_questions: MissingQuestion[];
    user_facts: UserFact[];
    conflicts: string[];
    messages?: SessionMessage[];
}
interface Evidence {
    source: string;
    quote: string;
}
interface Article {
    draft_id: number;
    headline: string;
    lead: string;
    body: string[];
    labels: string[];
    category: string | null;
    warnings: string[];
    image: string | null;
    version: number;
    reviewed_at: string | null;
    updated_at: string | null;
    quality?: {
        overall_score: number;
        quality_label: string;
        publish_blocked: boolean;
        dimensions: Record<string, number>;
        warnings: string[];
    } | null;
    selected_sources: Array<{
        id: number;
        title: string;
        document: string;
        evidence: Evidence[];
    }>;
}
interface Recommendation {
    information_id: number;
    document_id: number;
    name: string;
    source: string;
    excerpt: string;
    distance: number | null;
}
interface Props {
    informationItems: InformationItem[];
    documents: DocumentItem[];
    generatedArticle?: Article | null;
    newsSession?: NewsSession | null;
    preselectedInformationIds?: number[];
    initialDocumentIds?: number[];
    initialPrompt?: string | null;
    initialManualFact?: string | null;
    autoGenerate?: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Asisten AI', href: '/admin/ai-assistant' },
];

export default function NewsCreatorAgent({
    informationItems,
    documents,
    generatedArticle,
    newsSession,
    preselectedInformationIds = [],
    initialDocumentIds = [],
    initialPrompt = '',
    initialManualFact = '',
    autoGenerate = false,
}: Props) {
    const errors = (usePage().props.errors ?? {}) as Record<string, string>;
    const fileInput = useRef<HTMLInputElement>(null);
    const newsImageInput = useRef<HTMLInputElement>(null);
    const autoGenerated = useRef(false);
    const [prompt, setPrompt] = useState(
        initialPrompt ?? newsSession?.prompt ?? '',
    );
    const [files, setFiles] = useState<File[]>([]);
    const [manualFact, setManualFact] = useState(initialManualFact ?? '');
    const [informationIds, setInformationIds] = useState(
        newsSession?.selected_information_ids ??
            generatedArticle?.selected_sources.map((source) => source.id) ??
            preselectedInformationIds,
    );
    const [documentIds, setDocumentIds] = useState(
        newsSession?.selected_document_ids ?? initialDocumentIds,
    );
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [picker, setPicker] = useState(false);
    const [query, setQuery] = useState('');
    const [recommendations, setRecommendations] = useState<Recommendation[]>(
        [],
    );
    const [findingRelated, setFindingRelated] = useState(false);
    const [showProgressSteps, setShowProgressSteps] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [editedArticle, setEditedArticle] = useState<Article | null>(
        generatedArticle ?? null,
    );
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const questions = newsSession?.pending_questions ?? [];
    const displayedUserFacts = (newsSession?.user_facts ?? []).filter(
        (fact) =>
            !['category', 'topic', 'tone', 'format', 'report_type'].includes(
                fact.field.toLowerCase(),
            ),
    );
    const allQuestionsAnswered =
        questions.length > 0 &&
        questions.every((question) => Boolean(answers[question.field]?.trim()));
    const processingFiles = newsSession?.status === 'processing_files';
    const hasSources = informationIds.length > 0 || documentIds.length > 0;
    const shownInformation = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase('id');

        return needle
            ? informationItems.filter((item) =>
                  [
                      item.title,
                      item.summary,
                      item.document.original_name,
                      ...item.labels,
                  ]
                      .join(' ')
                      .toLocaleLowerCase('id')
                      .includes(needle),
              )
            : informationItems;
    }, [informationItems, query]);
    const actions = errors.guidance
        ? [
              'Pilih informasi tersimpan',
              'Unggah dokumen',
              'Jelaskan kejadian secara lengkap',
          ]
        : generatedArticle
          ? [
                'Buat ulang dengan sudut berbeda',
                'Ringkas draf',
                'Ubah judul',
                'Buat nada lebih formal',
            ]
          : questions.length
            ? ['Lengkapi informasi yang hilang', 'Tinjau kembali sumber']
            : hasSources || files.length
              ? [
                    'Buat draf berita',
                    'Gabungkan informasi terkait',
                    'Buat pengumuman',
                ]
              : [
                    'Buat berita tentang…',
                    'Ekstrak semua informasi penting dari file',
                    'Ekstrak informasi tertentu dari file',
                ];

    function handleQuickAction(action: string) {
        if (
            action === 'Pilih informasi tersimpan' ||
            action === 'Pilih sumber informasi'
        ) {
            setPicker(true);

            return;
        }

        if (action === 'Unggah dokumen' || action.includes('dari file')) {
            setPrompt(action);
            fileInput.current?.click();

            return;
        }

        if (action === 'Jelaskan kejadian secara lengkap') {
            setPrompt(
                'Apa yang terjadi: \nSiapa yang terlibat: \nLokasi: \nWaktu: ',
            );

            return;
        }

        setPrompt(action);
    }
    const generationStages = [
        'Mencari sumber relevan…',
        'Mengambil informasi…',
        'Menganalisis gaya penulisan…',
        'Menyusun artikel…',
        'Menyelesaikan draf…',
    ];
    const activeStage = Math.min(
        Math.floor(elapsedSeconds / 4),
        generationStages.length - 1,
    );

    const toggle = (
        values: number[],
        id: number,
        setter: (ids: number[]) => void,
    ) =>
        setter(
            values.includes(id)
                ? values.filter((value) => value !== id)
                : [...values, id],
        );
    function addFiles(list: FileList | null) {
        if (!list) {
            return;
        }

        const incoming = Array.from(list);

        if (files.length + incoming.length > 5) {
            window.alert('Maksimum lima dokumen untuk setiap permintaan.');

            return;
        }

        setFiles((current) => [...current, ...incoming]);
    }
    function submit(answerOverrides: Record<string, string> = {}) {
        if (files.length) {
            const data = new FormData();
            files.forEach((file) => data.append('documents[]', file));

            if (prompt.trim()) {
                data.append('prompt', prompt.trim());
            }

            const generationIntent =
                /\b(generate|create|write|buat|bikin|tulis)\b.{0,30}\b(news|article|berita|artikel|laporan)\b/i.test(
                    prompt,
                );
            const generalExtraction =
                !prompt.trim() ||
                /\b(all|everything|semua|seluruh|tidak tahu|don't know)\b/i.test(
                    prompt,
                );
            data.append(
                'intent',
                generationIntent ? 'generate_news' : 'extract_information',
            );
            data.append(
                'extraction_mode',
                generalExtraction ? 'general' : 'targeted',
            );

            if (!generalExtraction && prompt.trim()) {
                data.append('extraction_query', prompt.trim());
            }

            if (manualFact.trim()) {
                data.append('manual_fact', manualFact.trim());
            }

            informationIds.forEach((id) =>
                data.append('information_ids[]', String(id)),
            );
            documentIds.forEach((id) =>
                data.append('document_ids[]', String(id)),
            );

            setBusy(true);
            setElapsedSeconds(0);
            router.post('/admin/documents', data, {
                forceFormData: true,
                onFinish: () => setBusy(false),
            });

            return;
        }

        setBusy(true);
        setElapsedSeconds(0);
        router.post(
            '/admin/ai-assistant/generate',
            {
                draft_id: editedArticle?.draft_id ?? null,
                session_id: newsSession?.id ?? null,
                information_ids: informationIds,
                document_ids: documentIds,
                prompt: prompt.trim() || null,
                answers: manualFact.trim()
                    ? {
                          ...answers,
                          ...answerOverrides,
                          additional_context: manualFact.trim(),
                      }
                    : { ...answers, ...answerOverrides },
                tone: 'formal',
            },
            { onFinish: () => setBusy(false) },
        );
    }

    function saveDraft() {
        if (!editedArticle) {
            return;
        }

        router.put(
            `/admin/ai-assistant/drafts/${editedArticle.draft_id}`,
            {
                headline: editedArticle.headline,
                lead: editedArticle.lead,
                body: editedArticle.body,
            },
            { onSuccess: () => setEditMode(false) },
        );
    }

    function editorCommand(command: string, value?: string) {
        document.execCommand(command, false, value);
    }

    function markReviewed() {
        if (!editedArticle) {
            return;
        }

        router.post(
            `/admin/ai-assistant/drafts/${editedArticle.draft_id}/review`,
        );
    }

    function publishDraft() {
        if (!editedArticle?.reviewed_at) {
            return;
        }

        router.post(`/admin/news/drafts/${editedArticle.draft_id}/publish`);
    }

    function uploadNewsImage(file: File | undefined) {
        if (!editedArticle || !file) {
            return;
        }

        const data = new FormData();
        data.append('image', file);
        router.post(
            `/admin/ai-assistant/drafts/${editedArticle.draft_id}/image`,
            data,
            { forceFormData: true },
        );
    }
    async function findRelated() {
        if (!prompt.trim()) {
            return;
        }

        setFindingRelated(true);

        try {
            const token =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await apiFetch(
                '/admin/ai-assistant/recommendations',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': token,
                    },
                    body: JSON.stringify({ query: prompt.trim() }),
                },
            );
            const data = (await response.json()) as {
                recommendations?: Recommendation[];
            };
            setRecommendations(data.recommendations ?? []);
        } finally {
            setFindingRelated(false);
        }
    }
    useEffect(() => {
        if (
            !autoGenerate ||
            autoGenerated.current ||
            !preselectedInformationIds.length
        ) {
            return;
        }

        autoGenerated.current = true;
        setBusy(true);
        router.post(
            '/admin/ai-assistant/generate',
            {
                information_ids: preselectedInformationIds,
                document_ids: initialDocumentIds,
                prompt: initialPrompt || null,
                answers: initialManualFact
                    ? { additional_context: initialManualFact }
                    : {},
                tone: 'formal',
            },
            { onFinish: () => setBusy(false) },
        );
    }, [
        autoGenerate,
        initialDocumentIds,
        initialPrompt,
        initialManualFact,
        preselectedInformationIds,
    ]);

    useEffect(() => {
        if (!processingFiles) {
            return;
        }

        const timer = window.setInterval(
            () =>
                router.reload({
                    only: ['newsSession', 'documents', 'informationItems'],
                }),
            5000,
        );

        return () => window.clearInterval(timer);
    }, [processingFiles]);

    useEffect(() => {
        setEditedArticle(generatedArticle ?? null);
    }, [generatedArticle]);

    useEffect(() => {
        if (!busy) {
            return;
        }

        const timer = window.setInterval(
            () => setElapsedSeconds((value) => value + 1),
            1000,
        );

        return () => window.clearInterval(timer);
    }, [busy]);

    return (
        <>
            <Head title="Asisten AI" />
            <div className="dark flex h-[calc(100vh-4rem)] min-h-[640px] flex-col overflow-hidden bg-background text-foreground lg:flex-row">
                <section className="flex min-h-0 flex-1 flex-col border-b bg-background lg:w-[42%] lg:max-w-[620px] lg:border-r lg:border-b-0">
                    <header className="flex shrink-0 items-center justify-between border-b px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Bot className="size-5" />
                            </div>
                            <div>
                                <h1 className="font-semibold">Asisten AI</h1>
                                <p className="text-xs text-muted-foreground">
                                    Ekstraksi dokumen dan pembuatan berita
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => router.visit('/admin/news')}
                                title="Kembali ke daftar berita"
                            >
                                <ArrowLeft />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/admin/documents')}
                            >
                                <Archive /> Dokumen
                            </Button>
                        </div>
                    </header>
                    <MessageScrollerProvider
                        autoScroll
                        defaultScrollPosition="end"
                    >
                        <MessageScroller className="min-h-0 flex-1">
                            <MessageScrollerViewport className="px-5 py-5">
                                <MessageScrollerContent className="gap-4">
                                    <MessageScrollerItem messageId="welcome">
                                        <div className="max-w-[88%] rounded-xl border bg-muted/50 p-4 text-sm leading-6">
                                            Pilih informasi atau dokumen
                                            tersimpan, atau lampirkan hingga
                                            lima file baru. Saya akan memeriksa
                                            kelengkapan sebelum membuat draf.
                                        </div>
                                    </MessageScrollerItem>
                                    {(newsSession?.messages ?? []).map(
                                        (message) => (
                                            <MessageScrollerItem
                                                key={message.id}
                                                messageId={`history-${message.id}`}
                                            >
                                                <div
                                                    className={
                                                        message.role === 'user'
                                                            ? 'ml-auto max-w-[88%] rounded-xl bg-primary p-4 text-sm text-primary-foreground'
                                                            : 'max-w-[88%] rounded-xl border bg-muted/50 p-4 text-sm leading-6'
                                                    }
                                                >
                                                    {message.content}
                                                </div>
                                            </MessageScrollerItem>
                                        ),
                                    )}
                                    {hasSources && (
                                        <MessageScrollerItem messageId="sources">
                                            <div className="ml-auto max-w-[88%] rounded-xl bg-primary p-4 text-sm text-primary-foreground">
                                                Gunakan {informationIds.length}{' '}
                                                informasi dan{' '}
                                                {documentIds.length} dokumen
                                                yang saya setujui.
                                            </div>
                                        </MessageScrollerItem>
                                    )}
                                    {processingFiles && (
                                        <MessageScrollerItem
                                            messageId="processing-files"
                                            scrollAnchor
                                        >
                                            <div className="max-w-[88%] rounded-xl border bg-muted/50 p-4 text-sm leading-6">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <LoaderCircle className="size-4 animate-spin text-primary" />
                                                    Dokumen sedang diproses
                                                </div>
                                                <p className="mt-1 text-muted-foreground">
                                                    Anda boleh meninggalkan
                                                    halaman ini. Pemrosesan akan
                                                    dilanjutkan oleh antrean dan
                                                    percakapan dapat dibuka
                                                    kembali dari daftar draf.
                                                </p>
                                            </div>
                                        </MessageScrollerItem>
                                    )}
                                    {busy && !processingFiles && (
                                        <MessageScrollerItem
                                            messageId="generation-progress"
                                            scrollAnchor
                                        >
                                            <Collapsible
                                                open={showProgressSteps}
                                                onOpenChange={
                                                    setShowProgressSteps
                                                }
                                                className="max-w-[92%] rounded-xl border bg-card p-4"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="relative flex size-3">
                                                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" />
                                                        <span className="relative inline-flex size-3 rounded-full bg-primary" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium">
                                                            {
                                                                generationStages[
                                                                    activeStage
                                                                ]
                                                            }
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {elapsedSeconds}s
                                                            berlalu
                                                        </p>
                                                    </div>
                                                    <CollapsibleTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                        >
                                                            {showProgressSteps ? (
                                                                <ChevronDown />
                                                            ) : (
                                                                <ChevronRight />
                                                            )}
                                                            Lihat langkah
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                </div>
                                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-primary transition-all duration-500"
                                                        style={{
                                                            width: `${((activeStage + 1) / generationStages.length) * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                                <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
                                                    {generationStages.map(
                                                        (stage, index) => (
                                                            <div
                                                                key={stage}
                                                                className="flex items-center gap-2 text-xs"
                                                            >
                                                                <span
                                                                    className={`size-2 rounded-full ${index <= activeStage ? 'bg-primary' : 'bg-muted'}`}
                                                                />
                                                                <span
                                                                    className={
                                                                        index <=
                                                                        activeStage
                                                                            ? 'text-foreground'
                                                                            : 'text-muted-foreground'
                                                                    }
                                                                >
                                                                    {stage}
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </MessageScrollerItem>
                                    )}
                                    {!errors.guidance &&
                                        displayedUserFacts.length > 0 && (
                                            <MessageScrollerItem messageId="clarification-answer">
                                                <div className="ml-auto max-w-[88%] rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                                                    Saya memilih:{' '}
                                                    {displayedUserFacts
                                                        .map(
                                                            (fact) =>
                                                                fact.value,
                                                        )
                                                        .join(', ')}
                                                    . Silakan buat draf
                                                    berdasarkan pilihan ini.
                                                </div>
                                            </MessageScrollerItem>
                                        )}
                                    {questions.length > 0 && (
                                        <MessageScrollerItem
                                            messageId="clarification-round"
                                            scrollAnchor
                                        >
                                            <div className="max-w-[94%] space-y-3">
                                                <p className="text-sm leading-6 text-muted-foreground">
                                                    Jawab pertanyaan penting ini
                                                    bersama-sama. Setelah itu,
                                                    AI langsung membuat draf
                                                    tanpa pertanyaan tambahan.
                                                </p>
                                                <Card className="gap-3 border-border bg-card py-4 shadow-none">
                                                    <CardHeader className="gap-2 px-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <CardTitle className="text-sm leading-6">
                                                                Harap tentukan:
                                                            </CardTitle>
                                                            <Badge
                                                                variant="outline"
                                                                className="shrink-0 text-[10px]"
                                                            >
                                                                {
                                                                    questions.length
                                                                }{' '}
                                                                pertanyaan
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-3 px-4">
                                                        {questions.map(
                                                            (
                                                                question,
                                                                questionIndex,
                                                            ) => {
                                                                const selectionType =
                                                                    question.selection_type ??
                                                                    'single';
                                                                const selectedValues =
                                                                    (
                                                                        answers[
                                                                            question
                                                                                .field
                                                                        ] ?? ''
                                                                    )
                                                                        .split(
                                                                            selectionType ===
                                                                                'ranked'
                                                                                ? ' > '
                                                                                : ', ',
                                                                        )
                                                                        .filter(
                                                                            Boolean,
                                                                        );

                                                                return (
                                                                    <div
                                                                        key={
                                                                            question.field
                                                                        }
                                                                        className="space-y-3 rounded-xl border border-border p-3"
                                                                    >
                                                                        <div className="space-y-1">
                                                                            <p className="text-xs font-medium text-primary">
                                                                                {questionIndex +
                                                                                    1}

                                                                                .
                                                                            </p>
                                                                            <p className="text-sm leading-6 font-medium">
                                                                                {
                                                                                    question.question
                                                                                }
                                                                            </p>
                                                                            {question.reason && (
                                                                                <p className="text-xs leading-5 text-muted-foreground">
                                                                                    {
                                                                                        question.reason
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        {question.sources?.map(
                                                                            (
                                                                                source,
                                                                            ) => (
                                                                                <a
                                                                                    key={
                                                                                        source.url
                                                                                    }
                                                                                    href={
                                                                                        source.url
                                                                                    }
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="block rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                                                                                >
                                                                                    <span className="line-clamp-1 text-sm font-medium">
                                                                                        {
                                                                                            source.title
                                                                                        }
                                                                                    </span>
                                                                                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                                                        {
                                                                                            source.snippet
                                                                                        }
                                                                                    </span>
                                                                                </a>
                                                                            ),
                                                                        )}
                                                                        {question
                                                                            .options
                                                                            ?.length ? (
                                                                            <div className="grid gap-2">
                                                                                {question.options.map(
                                                                                    (
                                                                                        option,
                                                                                        optionIndex,
                                                                                    ) => {
                                                                                        const selected =
                                                                                            selectedValues.includes(
                                                                                                option,
                                                                                            );

                                                                                        return (
                                                                                            <Button
                                                                                                key={
                                                                                                    option
                                                                                                }
                                                                                                type="button"
                                                                                                variant={
                                                                                                    selected
                                                                                                        ? 'default'
                                                                                                        : 'outline'
                                                                                                }
                                                                                                className="h-auto justify-start px-4 py-3 text-left whitespace-normal"
                                                                                                disabled={
                                                                                                    busy
                                                                                                }
                                                                                                onClick={() => {
                                                                                                    const next =
                                                                                                        selectionType ===
                                                                                                        'single'
                                                                                                            ? [
                                                                                                                  option,
                                                                                                              ]
                                                                                                            : selected
                                                                                                              ? selectedValues.filter(
                                                                                                                    (
                                                                                                                        value,
                                                                                                                    ) =>
                                                                                                                        value !==
                                                                                                                        option,
                                                                                                                )
                                                                                                              : [
                                                                                                                    ...selectedValues,
                                                                                                                    option,
                                                                                                                ];
                                                                                                    setAnswers(
                                                                                                        (
                                                                                                            current,
                                                                                                        ) => ({
                                                                                                            ...current,
                                                                                                            [question.field]:
                                                                                                                next.join(
                                                                                                                    selectionType ===
                                                                                                                        'ranked'
                                                                                                                        ? ' > '
                                                                                                                        : ', ',
                                                                                                                ),
                                                                                                        }),
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                {selectionType ===
                                                                                                    'ranked' &&
                                                                                                    selected && (
                                                                                                        <Badge variant="secondary">
                                                                                                            {selectedValues.indexOf(
                                                                                                                option,
                                                                                                            ) +
                                                                                                                1}
                                                                                                        </Badge>
                                                                                                    )}
                                                                                                <span>
                                                                                                    {optionIndex +
                                                                                                        1}

                                                                                                    .{' '}
                                                                                                    {
                                                                                                        option
                                                                                                    }
                                                                                                </span>
                                                                                            </Button>
                                                                                        );
                                                                                    },
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <Input
                                                                                value={
                                                                                    answers[
                                                                                        question
                                                                                            .field
                                                                                    ] ??
                                                                                    ''
                                                                                }
                                                                                onChange={(
                                                                                    event,
                                                                                ) =>
                                                                                    setAnswers(
                                                                                        (
                                                                                            current,
                                                                                        ) => ({
                                                                                            ...current,
                                                                                            [question.field]:
                                                                                                event
                                                                                                    .target
                                                                                                    .value,
                                                                                        }),
                                                                                    )
                                                                                }
                                                                                placeholder="Ketik jawaban Anda…"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                );
                                                            },
                                                        )}
                                                        <Button
                                                            type="button"
                                                            className="w-full"
                                                            disabled={
                                                                busy ||
                                                                !allQuestionsAnswered
                                                            }
                                                            onClick={() =>
                                                                submit()
                                                            }
                                                        >
                                                            {busy ? (
                                                                <LoaderCircle className="animate-spin" />
                                                            ) : (
                                                                <Send />
                                                            )}
                                                            Gunakan jawaban dan
                                                            buat draf
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </MessageScrollerItem>
                                    )}
                                    {recommendations.length > 0 && (
                                        <MessageScrollerItem messageId="recommendations">
                                            <Card className="max-w-[92%] gap-3 py-4 shadow-none">
                                                <CardHeader className="px-4">
                                                    <CardTitle className="text-sm">
                                                        Rekomendasi informasi
                                                        terkait
                                                    </CardTitle>
                                                    <p className="text-xs text-muted-foreground">
                                                        Tinjau dan setujui
                                                        sebelum sumber
                                                        digunakan.
                                                    </p>
                                                </CardHeader>
                                                <CardContent className="space-y-2 px-4">
                                                    {recommendations.map(
                                                        (item) => (
                                                            <div
                                                                key={
                                                                    item.information_id
                                                                }
                                                                className="rounded-lg border p-3"
                                                            >
                                                                <p className="text-sm font-medium">
                                                                    {item.name}
                                                                </p>
                                                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                                                    {
                                                                        item.excerpt
                                                                    }
                                                                </p>
                                                                <Button
                                                                    className="mt-2"
                                                                    variant={
                                                                        informationIds.includes(
                                                                            item.information_id,
                                                                        )
                                                                            ? 'secondary'
                                                                            : 'outline'
                                                                    }
                                                                    size="xs"
                                                                    onClick={() =>
                                                                        toggle(
                                                                            informationIds,
                                                                            item.information_id,
                                                                            setInformationIds,
                                                                        )
                                                                    }
                                                                >
                                                                    {informationIds.includes(
                                                                        item.information_id,
                                                                    )
                                                                        ? 'Disetujui'
                                                                        : 'Setujui sumber'}
                                                                </Button>
                                                            </div>
                                                        ),
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </MessageScrollerItem>
                                    )}
                                    {generatedArticle && !errors.guidance && (
                                        <MessageScrollerItem
                                            messageId="done"
                                            scrollAnchor
                                        >
                                            <div className="max-w-[88%] rounded-xl border border-success-border bg-success-bg p-4 text-sm text-success-text">
                                                Draf telah dibuat. Tinjau
                                                artikel dan bukti sebelum
                                                publikasi.
                                            </div>
                                        </MessageScrollerItem>
                                    )}
                                    {errors.guidance && (
                                        <MessageScrollerItem
                                            messageId="prompt-guidance"
                                            scrollAnchor
                                        >
                                            <div className="max-w-[92%] rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-6">
                                                <p className="font-medium text-primary">
                                                    Saya memerlukan fakta, bukan
                                                    hanya topik.
                                                </p>
                                                <p className="mt-1 text-muted-foreground">
                                                    {errors.guidance}
                                                </p>
                                                {generatedArticle && (
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        Permintaan terakhir
                                                        tidak diterapkan. Draf
                                                        yang terlihat di sebelah
                                                        kanan tetap merupakan
                                                        versi sebelumnya.
                                                    </p>
                                                )}
                                            </div>
                                        </MessageScrollerItem>
                                    )}
                                </MessageScrollerContent>
                            </MessageScrollerViewport>
                            <MessageScrollerButton />
                        </MessageScroller>
                    </MessageScrollerProvider>
                    <div className="shrink-0 space-y-3 border-t bg-background p-4">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {actions.map((action) => (
                                <Button
                                    key={action}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    onClick={() => handleQuickAction(action)}
                                >
                                    {action}
                                </Button>
                            ))}
                            {prompt.trim() && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    disabled={findingRelated}
                                    onClick={findRelated}
                                >
                                    {findingRelated ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : (
                                        <Sparkles />
                                    )}
                                    Cari informasi terkait
                                </Button>
                            )}
                        </div>
                        {(files.length > 0 || hasSources) && (
                            <div className="flex flex-wrap gap-2">
                                {files.map((file, index) => (
                                    <Badge
                                        key={`${file.name}-${index}`}
                                        variant="secondary"
                                        className="gap-1 py-1.5"
                                    >
                                        <Paperclip className="size-3" />
                                        {file.name}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFiles((current) =>
                                                    current.filter(
                                                        (_, position) =>
                                                            position !== index,
                                                    ),
                                                )
                                            }
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </Badge>
                                ))}
                                {informationIds.length > 0 && (
                                    <Badge variant="secondary">
                                        {informationIds.length} informasi
                                    </Badge>
                                )}
                                {documentIds.length > 0 && (
                                    <Badge variant="secondary">
                                        {documentIds.length} dokumen
                                    </Badge>
                                )}
                            </div>
                        )}
                        <div className="rounded-xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
                            <Textarea
                                value={prompt}
                                onChange={(event) =>
                                    setPrompt(event.target.value)
                                }
                                placeholder="Jelaskan berita yang ingin dibuat atau tambahkan arahan editorial…"
                                className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                            />
                            <div className="flex items-center justify-between border-t pt-2">
                                <div className="flex gap-1">
                                    <input
                                        ref={fileInput}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.jpg,.jpeg,.png"
                                        onChange={(event) => {
                                            addFiles(event.target.files);
                                            event.target.value = '';
                                        }}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                            fileInput.current?.click()
                                        }
                                        title="Unggah file"
                                    >
                                        <Paperclip />
                                    </Button>
                                    <Dialog
                                        open={picker}
                                        onOpenChange={setPicker}
                                    >
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                title="Pilih sumber"
                                            >
                                                <FolderSearch />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-h-[80vh] sm:max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Pilih sumber yang disetujui
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Hanya sumber terpilih yang
                                                    dipakai untuk membuat
                                                    berita.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <Input
                                                value={query}
                                                onChange={(event) =>
                                                    setQuery(event.target.value)
                                                }
                                                placeholder="Cari sumber…"
                                            />
                                            <Tabs defaultValue="information">
                                                <TabsList>
                                                    <TabsTrigger value="information">
                                                        Informasi
                                                    </TabsTrigger>
                                                    <TabsTrigger value="documents">
                                                        Dokumen
                                                    </TabsTrigger>
                                                    <TabsTrigger value="manual">
                                                        Fakta manual
                                                    </TabsTrigger>
                                                </TabsList>
                                                <TabsContent
                                                    value="information"
                                                    className="max-h-[48vh] space-y-2 overflow-y-auto"
                                                >
                                                    {shownInformation.map(
                                                        (item) => (
                                                            <label
                                                                key={item.id}
                                                                className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted/50"
                                                            >
                                                                <Checkbox
                                                                    checked={informationIds.includes(
                                                                        item.id,
                                                                    )}
                                                                    onCheckedChange={() =>
                                                                        toggle(
                                                                            informationIds,
                                                                            item.id,
                                                                            setInformationIds,
                                                                        )
                                                                    }
                                                                />
                                                                <span>
                                                                    <span className="block text-sm font-medium">
                                                                        {
                                                                            item.title
                                                                        }
                                                                    </span>
                                                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                                                        {
                                                                            item.summary
                                                                        }
                                                                    </span>
                                                                    <span className="text-xs text-primary">
                                                                        {
                                                                            item
                                                                                .document
                                                                                .original_name
                                                                        }
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        ),
                                                    )}
                                                </TabsContent>
                                                <TabsContent
                                                    value="documents"
                                                    className="max-h-[48vh] space-y-2 overflow-y-auto"
                                                >
                                                    {documents.map(
                                                        (document) => (
                                                            <label
                                                                key={
                                                                    document.id
                                                                }
                                                                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
                                                            >
                                                                <Checkbox
                                                                    checked={documentIds.includes(
                                                                        document.id,
                                                                    )}
                                                                    onCheckedChange={() =>
                                                                        toggle(
                                                                            documentIds,
                                                                            document.id,
                                                                            setDocumentIds,
                                                                        )
                                                                    }
                                                                />
                                                                <FileText className="size-4" />
                                                                <span className="text-sm font-medium">
                                                                    {
                                                                        document.original_name
                                                                    }
                                                                </span>
                                                            </label>
                                                        ),
                                                    )}
                                                </TabsContent>
                                                <TabsContent value="manual">
                                                    <div className="space-y-2 rounded-lg border p-3">
                                                        <p className="text-sm font-medium">
                                                            Fakta yang diberikan
                                                            moderator
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Fakta ini akan
                                                            ditandai sebagai
                                                            user-provided dan
                                                            tidak dianggap
                                                            berasal dari
                                                            dokumen.
                                                        </p>
                                                        <Textarea
                                                            value={manualFact}
                                                            onChange={(event) =>
                                                                setManualFact(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Contoh: Kegiatan akan berlangsung pada 20 September 2026."
                                                        />
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                            <Button
                                                onClick={() => setPicker(false)}
                                            >
                                                Gunakan sumber terpilih
                                            </Button>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                                <Button
                                    size="icon"
                                    disabled={
                                        busy ||
                                        processingFiles ||
                                        (!files.length &&
                                            !hasSources &&
                                            !newsSession &&
                                            !prompt.trim() &&
                                            !manualFact.trim())
                                    }
                                    onClick={() => submit()}
                                >
                                    {busy ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : (
                                        <Send />
                                    )}
                                </Button>
                            </div>
                        </div>
                        {(errors.document ||
                            errors.documents ||
                            errors.generation) && (
                            <p className="text-sm text-danger-text">
                                {errors.document ||
                                    errors.documents ||
                                    errors.generation}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Maksimum 5 file baru · dokumen, spreadsheet, teks,
                            dan gambar OCR
                        </p>
                    </div>
                </section>
                <section className="flex min-h-0 flex-1 flex-col bg-background">
                    {editedArticle ? (
                        <>
                            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-semibold">
                                            Pratinjau berita
                                        </h2>
                                        <Badge variant="secondary">
                                            DRAF AI
                                        </Badge>
                                        {editedArticle.quality && (
                                            <Badge
                                                variant={
                                                    editedArticle.quality
                                                        .publish_blocked
                                                        ? 'destructive'
                                                        : 'outline'
                                                }
                                            >
                                                Kualitas{' '}
                                                {editedArticle.quality.overall_score.toFixed(
                                                    1,
                                                )}
                                                %
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock3 className="size-3" />
                                            Terakhir dibuat{' '}
                                            {editedArticle.updated_at
                                                ? new Date(
                                                      editedArticle.updated_at,
                                                  ).toLocaleString('id-ID')
                                                : 'baru saja'}
                                        </span>
                                        <span>
                                            Versi {editedArticle.version ?? 1}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {editMode ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setEditedArticle(
                                                        generatedArticle ??
                                                            null,
                                                    );
                                                    setEditMode(false);
                                                }}
                                            >
                                                Batal
                                            </Button>
                                            <Button onClick={saveDraft}>
                                                <Save /> Simpan perubahan
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setEditMode(true)
                                                }
                                            >
                                                <Edit3 /> Edit
                                            </Button>
                                            {!editedArticle.reviewed_at && (
                                                <Button
                                                    variant="secondary"
                                                    onClick={markReviewed}
                                                >
                                                    Tandai sudah ditinjau
                                                </Button>
                                            )}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        disabled={
                                                            !editedArticle.reviewed_at ||
                                                            Boolean(
                                                                editedArticle
                                                                    .quality
                                                                    ?.publish_blocked,
                                                            )
                                                        }
                                                    >
                                                        Publikasikan
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            Publikasikan berita
                                                            ini?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Anda mengonfirmasi
                                                            bahwa fakta, sumber,
                                                            dan versi artikel
                                                            ini telah ditinjau.
                                                            Tindakan ini tidak
                                                            dilakukan otomatis
                                                            oleh AI.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>
                                                            Kembali meninjau
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={
                                                                publishDraft
                                                            }
                                                        >
                                                            Ya, publikasikan
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    )}
                                </div>
                            </header>
                            {editMode && (
                                <div className="flex flex-wrap items-center gap-1 border-b bg-card px-5 py-2">
                                    {[
                                        ['bold', Bold],
                                        ['italic', Italic],
                                        ['underline', Underline],
                                        ['justifyLeft', AlignLeft],
                                        ['justifyCenter', AlignCenter],
                                        ['justifyRight', AlignRight],
                                        ['insertUnorderedList', List],
                                        ['insertOrderedList', ListOrdered],
                                        ['undo', Undo2],
                                        ['redo', Redo2],
                                    ].map(([command, Icon]) => (
                                        <Button
                                            key={command as string}
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onMouseDown={(event) =>
                                                event.preventDefault()
                                            }
                                            onClick={() =>
                                                editorCommand(command as string)
                                            }
                                        >
                                            <Icon className="size-4" />
                                        </Button>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled
                                        title="Penyisipan gambar akan menggunakan pustaka media"
                                    >
                                        <ImagePlus /> Gambar
                                    </Button>
                                </div>
                            )}
                            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-8">
                                <article className="mx-auto max-w-3xl rounded-xl border bg-card p-6 shadow-sm md:p-10">
                                    <input
                                        ref={newsImageInput}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={(event) => {
                                            uploadNewsImage(
                                                event.target.files?.[0],
                                            );
                                            event.target.value = '';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="relative mb-6 flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                                        disabled={!editMode}
                                        onClick={() =>
                                            newsImageInput.current?.click()
                                        }
                                    >
                                        {editedArticle.image ? (
                                            <>
                                                <img
                                                    src={editedArticle.image}
                                                    alt="Gambar berita"
                                                    className="absolute inset-0 size-full object-cover"
                                                />
                                                {editMode && (
                                                    <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity hover:opacity-100">
                                                        <ImagePlus className="mr-2 size-5" />
                                                        Ganti gambar
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <ImagePlus className="mr-2 size-5" />
                                                Unggah gambar berita
                                            </>
                                        )}
                                    </button>
                                    <div className="mb-5 flex flex-wrap gap-2">
                                        {editedArticle.category && (
                                            <Badge>
                                                {editedArticle.category}
                                            </Badge>
                                        )}
                                        {editedArticle.labels.map((label) => (
                                            <Badge
                                                key={label}
                                                variant="secondary"
                                            >
                                                {label}
                                            </Badge>
                                        ))}
                                    </div>
                                    {editMode ? (
                                        <Input
                                            value={editedArticle.headline}
                                            onChange={(event) =>
                                                setEditedArticle({
                                                    ...editedArticle,
                                                    headline:
                                                        event.target.value,
                                                })
                                            }
                                            className="h-auto border-0 px-0 text-3xl leading-tight font-semibold shadow-none focus-visible:ring-0"
                                        />
                                    ) : (
                                        <h1 className="text-3xl leading-tight font-semibold">
                                            {editedArticle.headline}
                                        </h1>
                                    )}
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Oleh Moderator ApaKhabar · Versi{' '}
                                        {editedArticle.version ?? 1}
                                    </p>
                                    <div className="my-6 h-px bg-border" />
                                    <div className="space-y-5 leading-8">
                                        {[
                                            editedArticle.lead,
                                            ...editedArticle.body,
                                        ].map((paragraph, index) =>
                                            editMode ? (
                                                <div
                                                    key={index}
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    className={`${index === 0 ? 'text-lg font-medium' : ''} rounded-md outline-none focus:ring-2 focus:ring-ring/30`}
                                                    onBlur={(event) => {
                                                        const value =
                                                            event.currentTarget
                                                                .textContent ??
                                                            '';

                                                        if (index === 0) {
                                                            setEditedArticle({
                                                                ...editedArticle,
                                                                lead: value,
                                                            });
                                                        } else {
                                                            const body = [
                                                                ...editedArticle.body,
                                                            ];
                                                            body[index - 1] =
                                                                value;
                                                            setEditedArticle({
                                                                ...editedArticle,
                                                                body,
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {paragraph}
                                                </div>
                                            ) : (
                                                <p
                                                    key={index}
                                                    className={
                                                        index === 0
                                                            ? 'text-lg font-medium'
                                                            : ''
                                                    }
                                                >
                                                    {paragraph}
                                                    {editedArticle
                                                        .selected_sources
                                                        .length > 0 && (
                                                        <sup className="ml-1 text-primary">
                                                            [
                                                            {(index %
                                                                editedArticle
                                                                    .selected_sources
                                                                    .length) +
                                                                1}
                                                            ]
                                                        </sup>
                                                    )}
                                                </p>
                                            ),
                                        )}
                                    </div>
                                    <Collapsible
                                        open={sourcesOpen}
                                        onOpenChange={setSourcesOpen}
                                        className="mt-8 border-t pt-6"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-between"
                                            >
                                                Sumber digunakan (
                                                {
                                                    editedArticle
                                                        .selected_sources.length
                                                }
                                                )
                                                {sourcesOpen ? (
                                                    <ChevronDown />
                                                ) : (
                                                    <ChevronRight />
                                                )}
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-3 space-y-2">
                                            {editedArticle.selected_sources.map(
                                                (source, sourceIndex) => (
                                                    <Collapsible
                                                        key={source.id}
                                                        className="rounded-lg border bg-muted/20 p-3"
                                                    >
                                                        <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
                                                            <FileText className="size-4 text-primary" />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-medium">
                                                                    {sourceIndex +
                                                                        1}
                                                                    .{' '}
                                                                    {
                                                                        source.document
                                                                    }
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {source.evidence
                                                                        .map(
                                                                            (
                                                                                item,
                                                                            ) =>
                                                                                item.source,
                                                                        )
                                                                        .join(
                                                                            ', ',
                                                                        ) ||
                                                                        source.title}
                                                                </span>
                                                            </span>
                                                            <ChevronDown className="size-4" />
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
                                                            {source.evidence.map(
                                                                (
                                                                    evidence,
                                                                    index,
                                                                ) => (
                                                                    <p
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="text-xs leading-5 text-muted-foreground"
                                                                    >
                                                                        <strong>
                                                                            {
                                                                                evidence.source
                                                                            }
                                                                        </strong>
                                                                        : “
                                                                        {
                                                                            evidence.quote
                                                                        }
                                                                        ”
                                                                    </p>
                                                                ),
                                                            )}
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                ),
                                            )}
                                        </CollapsibleContent>
                                    </Collapsible>
                                </article>
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-full flex-1 items-center justify-center p-5">
                            <div className="max-w-md text-center">
                                <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm">
                                    <Sparkles className="size-7" />
                                </div>
                                <h2 className="text-xl font-semibold">
                                    Draf berita akan muncul di sini
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Tambahkan arahan, unggah hingga lima file,
                                    atau pilih informasi dan dokumen tersimpan.
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-5"
                                    onClick={() => setPicker(true)}
                                >
                                    <FolderSearch />
                                    Pilih sumber
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}

NewsCreatorAgent.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);

import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Clock3,
    Copy,
    Edit3,
    FileText,
    FolderSearch,
    ImagePlus,
    LoaderCircle,
    Maximize2,
    Minimize2,
    Paperclip,
    PanelRightClose,
    Plus,
    Save,
    Sparkles,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AgentWorkTrace,
    SavedAgentWorkTrace,
} from '@/components/intelligent-news/agent-work-trace';
import {
    AssistantConversationIntro,
    AssistantEmptyState,
} from '@/components/intelligent-news/assistant-empty-state';
import { CategoryProposalCard } from '@/components/intelligent-news/category-proposal';
import {
    ChatMessage,
    PendingUserMessage,
} from '@/components/intelligent-news/chat-message';
import { DocumentProcessingStatus } from '@/components/intelligent-news/document-processing-status';
import { ExtractedInformationReview } from '@/components/intelligent-news/extracted-information-review';
import { PreviewFrame } from '@/components/intelligent-news/preview-frame';
import {
    QualityScoreBadge,
    QualityScoreBreakdown,
} from '@/components/intelligent-news/quality-score';
import { SessionPanel } from '@/components/intelligent-news/session-panel';
import { SourcePicker } from '@/components/intelligent-news/source-picker';
import type {
    Article,
    AssistantPageProps,
    AgentRunEvent,
    InformationItem,
    Recommendation,
} from '@/components/intelligent-news/types';
import { WorkspaceActions } from '@/components/intelligent-news/workspace-actions';
import { NewsImageCropDialog } from '@/components/news-image-crop-dialog';
import { NewsRichEditor } from '@/components/news-rich-editor';
import type { PublicationPreviewData } from '@/components/publication-preview';
import { PublishNewsDialog } from '@/components/publish-news-dialog';
import type { PublishPlatformId } from '@/components/publish-news-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { assistantTurnAnchors } from '@/lib/assistant-turns';
import { csrfPost } from '@/lib/csrf-request';
import { groupDocumentSources } from '@/lib/group-document-sources';
import { metaRequest } from '@/lib/meta-auth';
import { newsEditorContent } from '@/lib/news-editor-content';
import { requestsNewsGeneration } from '@/lib/upload-intent';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Asisten AI', href: '/admin/ai-assistant' },
];

export default function NewsCreatorAgent({
    publishPlatforms,
    metaAuth,
    conversationReadOnly = false,
    sessions = [],
    categories = [],
    informationItems,
    pendingInformation = [],
    documents,
    generatedArticle,
    newsSession,
    preselectedInformationIds = [],
    initialDocumentIds = [],
    initialPrompt = '',
    initialManualFact = '',
    autoGenerate = false,
}: AssistantPageProps) {
    const progressStorageKey = `ai-generation:${usePage().props.auth.user?.id ?? 'guest'}:${newsSession?.id ?? 'new'}`;
    const [generationErrors, setGenerationErrors] = useState<
        Record<string, string>
    >({});
    const errors = {
        ...((usePage().props.errors ?? {}) as Record<string, string>),
        ...generationErrors,
    };
    const fileInput = useRef<HTMLInputElement>(null);
    const dragDepth = useRef(0);
    const [draggingFiles, setDraggingFiles] = useState(false);
    useEffect(() => {
        // Prevent the browser from navigating away when a file misses the chat area.
        const preventFileNavigation = (event: DragEvent) => {
            if (event.dataTransfer?.types.includes('Files')) {
                event.preventDefault();

                if (event.type === 'dragover') {
                    event.dataTransfer.dropEffect = 'none';
                }
            }
        };
        const resetDrag = () => {
            dragDepth.current = 0;
            setDraggingFiles(false);
        };
        window.addEventListener('dragover', preventFileNavigation);
        window.addEventListener('drop', preventFileNavigation);
        window.addEventListener('drop', resetDrag);
        window.addEventListener('dragend', resetDrag);
        window.addEventListener('blur', resetDrag);

        return () => {
            window.removeEventListener('dragover', preventFileNavigation);
            window.removeEventListener('drop', preventFileNavigation);
            window.removeEventListener('drop', resetDrag);
            window.removeEventListener('dragend', resetDrag);
            window.removeEventListener('blur', resetDrag);
        };
    }, []);
    const composerInput = useRef<HTMLTextAreaElement>(null);
    const newsImageInput = useRef<HTMLInputElement>(null);
    const autoGenerated = useRef(false);
    const workspace = useRef<HTMLDivElement>(null);
    const [prompt, setPrompt] = useState(initialPrompt ?? '');
    const [pendingUserMessage, setPendingUserMessage] = useState<{
        content: string;
        attachments?: string[];
        informationAttachments?: InformationItem[];
    } | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [manualFact] = useState(initialManualFact ?? '');
    const [workflowMode, setWorkflowMode] = useState<
        'news' | 'extract' | 'search' | null
    >(null);
    const [informationIds, setInformationIds] = useState(
        newsSession?.selected_information_ids ??
            generatedArticle?.selected_sources.map((source) => source.id) ??
            preselectedInformationIds,
    );
    const [documentIds, setDocumentIds] = useState(
        newsSession ? [] : (initialDocumentIds ?? []),
    );
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [liveEvents, setLiveEvents] = useState<AgentRunEvent[]>([]);
    const [progressMessage, setProgressMessage] = useState(
        'Menunggu pekerja antrean AI…',
    );
    const startGeneration = useCallback(
        async (payload: Record<string, unknown>) => {
            const selectedIds = new Set(
                (payload.information_ids ?? []) as number[],
            );
            const selectedDocuments = new Set(
                (payload.document_ids ?? []) as number[],
            );
            const candidates = new Map(
                [...informationItems, ...pendingInformation].map((item) => [
                    item.id,
                    item,
                ]),
            );
            const attachments = [...candidates.values()].filter(
                (item) =>
                    selectedIds.has(item.id) ||
                    (selectedDocuments.has(item.document_id) &&
                        informationItems.some(
                            (approved) => approved.id === item.id,
                        )),
            );
            setPendingUserMessage((previous) => ({
                content:
                    previous?.content ??
                    String(payload.prompt || 'Lanjutkan permintaan ini.'),
                informationAttachments: attachments,
            }));
            setGenerationErrors({});
            setProgressMessage('Menunggu pekerja antrean AI…');

            try {
                sessionStorage.setItem(
                    progressStorageKey,
                    JSON.stringify({
                        id: payload.request_id,
                        started: Date.now(),
                    }),
                );
            } catch {
                /* Storage can be disabled; polling still works. */
            }

            try {
                const response = await csrfPost(
                    '/admin/ai-assistant/generate-async',
                    payload,
                );
                const data = await response.json();

                if (!response.ok) {
                    const messages = Object.values(data.errors ?? {})
                        .flat()
                        .join(' ');

                    throw new Error(
                        messages ||
                            data.message ||
                            'Permintaan AI tidak dapat dimulai.',
                    );
                }
            } catch (error) {
                try {
                    sessionStorage.removeItem(progressStorageKey);
                } catch {
                    /* Storage unavailable. */
                }

                setGenerationErrors({
                    generation:
                        error instanceof Error
                            ? error.message
                            : 'Permintaan AI gagal.',
                });
                setBusy(false);
                setActiveRequestId(null);
                setPendingUserMessage(null);
            }
        },
        [progressStorageKey, informationItems, pendingInformation],
    );
    useEffect(() => {
        if (!newsSession?.id || conversationReadOnly) {
            return;
        }

        try {
            const saved = JSON.parse(
                sessionStorage.getItem(progressStorageKey) ?? 'null',
            );

            if (saved?.id && Date.now() - saved.started < 86400000) {
                autoGenerated.current = true;
                setActiveRequestId(saved.id);
                setElapsedSeconds(
                    Math.floor((Date.now() - saved.started) / 1000),
                );
                setBusy(true);
            }
        } catch {
            /* No recoverable local progress. */
        }
    }, [progressStorageKey, newsSession?.id, conversationReadOnly]);
    useEffect(() => {
        if (!busy || !activeRequestId) {
            return;
        }

        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        let missing = 0;
        const poll = async () => {
            try {
                const response = await fetch(
                    `/admin/ai-assistant/runs/${activeRequestId}`,
                    {
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );

                if (
                    response.status === 401 ||
                    response.status === 403 ||
                    response.status === 419
                ) {
                    setGenerationErrors({
                        generation:
                            'Sesi berakhir. Muat ulang halaman untuk masuk kembali.',
                    });
                    setBusy(false);

                    return;
                }

                if (!response.ok) {
                    if (response.status === 404 && ++missing > 15) {
                        setGenerationErrors({
                            generation:
                                'Proses tidak ditemukan. Muat ulang percakapan lalu coba lagi.',
                        });
                        setBusy(false);

                        return;
                    }

                    throw new Error('Progress unavailable');
                }

                missing = 0;
                const data = await response.json();

                if (data.message?.role === 'user') {
                    setPendingUserMessage({
                        content: data.message.content,
                        informationAttachments:
                            data.message.payload?.information_attachments ?? [],
                    });
                }

                if (data.status === 'completed' || data.status === 'failed') {
                    try {
                        sessionStorage.removeItem(progressStorageKey);
                    } catch {
                        /* Storage unavailable. */
                    }
                }

                if (data.status === 'completed' && data.url) {
                    setBusy(false);
                    setActiveRequestId(null);
                    setPendingUserMessage(null);
                    // Old queued results can contain APP_URL's host rather than this tab's host.
                    const destination = new URL(
                        data.url,
                        window.location.origin,
                    );
                    router.visit(destination.pathname + destination.search, {
                        preserveScroll: true,
                    });

                    return;
                }

                if (data.status === 'failed') {
                    setGenerationErrors(
                        Object.fromEntries(
                            Object.entries(
                                data.errors ?? {
                                    generation: 'Proses AI gagal.',
                                },
                            ).map(([key, value]) => [
                                key,
                                Array.isArray(value)
                                    ? value.join(' ')
                                    : String(value),
                            ]),
                        ),
                    );
                    setBusy(false);
                    setActiveRequestId(null);
                    setPendingUserMessage(null);

                    return;
                }

                setProgressMessage(
                    data.status === 'queued'
                        ? 'Menunggu pekerja antrean AI. Proses belum dimulai.'
                        : 'Terhubung ke layanan AI · pembaruan setiap 2 detik',
                );
                setLiveEvents(
                    (data.events ?? []).map(
                        (event: AgentRunEvent & { sequence: number }) => ({
                            ...event,
                            id: event.sequence,
                        }),
                    ),
                );
            } catch {
                if (!controller.signal.aborted) {
                    setProgressMessage(
                        'Pembaruan terputus; mencoba menyambung kembali…',
                    );
                }
            }

            if (!controller.signal.aborted) {
                timer = setTimeout(poll, 2000);
            }
        };
        void poll();

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [busy, activeRequestId, progressStorageKey]);
    const [picker, setPicker] = useState(false);
    const [recommendations, setRecommendations] = useState<Recommendation[]>(
        [],
    );
    const [findingRelated, setFindingRelated] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [cropOpen, setCropOpen] = useState(false);
    const [imageSaving, setImageSaving] = useState(false);
    const [imageError, setImageError] = useState('');
    const [publishOpen, setPublishOpen] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [selectedPlatforms, setSelectedPlatforms] = useState<
        PublishPlatformId[]
    >(['website']);
    const [publishError, setPublishError] = useState('');
    const [editedArticle, setEditedArticle] = useState<Article | null>(
        generatedArticle ?? null,
    );
    const articleContent = editedArticle
        ? [editedArticle.lead, ...editedArticle.body]
              .filter(Boolean)
              .join('\n\n')
        : '';
    const documentSources = groupDocumentSources(
        editedArticle?.selected_sources ?? [],
    );
    const formattedContent = newsEditorContent(articleContent);
    const wordCount = formattedContent.text
        .trim()
        .split(/\s+/u)
        .filter(Boolean).length;
    const draftDirty = Boolean(
        editedArticle &&
        generatedArticle &&
        (editedArticle.category_id !== generatedArticle.category_id ||
            editedArticle.headline !== generatedArticle.headline ||
            editedArticle.subheadline !== generatedArticle.subheadline ||
            editedArticle.lead !== generatedArticle.lead ||
            JSON.stringify(editedArticle.body) !==
                JSON.stringify(generatedArticle.body)),
    );
    const [previewOpen, setPreviewOpen] = useState(Boolean(generatedArticle));
    const [previewWidth, setPreviewWidth] = useState(720);
    const [resizingPreview, setResizingPreview] = useState(false);
    const [composerExpanded, setComposerExpanded] = useState(false);
    const [composerOverflowing, setComposerOverflowing] = useState(false);
    const [composerMultiline, setComposerMultiline] = useState(false);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);
    async function stopGeneration() {
        if (!activeRequestId) {
            return;
        }

        const response = await csrfPost(
            `/admin/ai-assistant/runs/${activeRequestId}/stop`,
            {},
        );

        if (!response.ok) {
            setGenerationErrors({
                generation: 'Proses belum dapat dihentikan. Coba lagi.',
            });

            return;
        }

        try {
            sessionStorage.removeItem(progressStorageKey);
        } catch {
            /* Optional storage. */
        }

        setBusy(false);
        setActiveRequestId(null);
        setPendingUserMessage(null);
        setGenerationErrors({
            generation:
                'Permintaan dihentikan. Panggilan model yang sedang berjalan dapat memerlukan waktu untuk selesai.',
        });
    }
    const questions = newsSession?.pending_questions ?? [];
    const allQuestionsAnswered =
        questions.length > 0 &&
        questions.every((question) => Boolean(answers[question.field]?.trim()));
    const { draftMessageId, extractionMessageId } = assistantTurnAnchors(
        newsSession?.messages ?? [],
    );
    const draftCard = generatedArticle && !errors.guidance && (
        <>
            <Card className="max-w-[94%] gap-3 border-success-border bg-success-bg py-4 shadow-sm">
                <CardHeader className="gap-2 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge>Draf AI</Badge>
                        <QualityScoreBadge quality={generatedArticle.quality} />
                        {generatedArticle.category && (
                            <Badge variant="outline">
                                {generatedArticle.category}
                            </Badge>
                        )}
                    </div>
                    <CardTitle className="text-base leading-6 text-foreground">
                        {generatedArticle.headline}
                    </CardTitle>
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {generatedArticle.lead}
                    </p>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                            ±
                            {Math.max(
                                1,
                                Math.ceil(
                                    (generatedArticle.body
                                        .join(' ')
                                        .split(/\s+/).length +
                                        generatedArticle.lead.split(/\s+/)
                                            .length) /
                                        200,
                                ),
                            )}{' '}
                            menit baca
                        </span>
                        <span>
                            {generatedArticle.selected_sources.length} sumber
                        </span>
                        <span>Versi {generatedArticle.version ?? 1}</span>
                    </div>
                    {generatedArticle.warnings.length > 0 && (
                        <div className="rounded-lg border border-warning-border bg-warning-bg p-3 text-xs leading-5 text-warning-text">
                            {generatedArticle.warnings[0]}
                        </div>
                    )}
                    {generatedArticle.quality && (
                        <QualityScoreBreakdown
                            quality={generatedArticle.quality}
                        />
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setEditMode(false);
                                setPreviewOpen(true);
                            }}
                        >
                            Pratinjau
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={conversationReadOnly}
                            onClick={() => {
                                setEditMode(true);
                                setPreviewOpen(true);
                            }}
                        >
                            <Edit3 /> Edit
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </>
    );
    const processingFiles = newsSession?.status === 'processing_files';
    const reviewingExtraction = pendingInformation.length > 0;
    const hasSources = informationIds.length > 0 || documentIds.length > 0;
    const conversationStarted = Boolean(
        newsSession ||
        generatedArticle ||
        busy ||
        processingFiles ||
        errors.guidance,
    );
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
        if (action.toLocaleLowerCase('id').includes('berita')) {
            setWorkflowMode('news');
        } else if (
            action.toLocaleLowerCase('id').includes('ekstrak') ||
            action === 'Unggah dokumen'
        ) {
            setWorkflowMode('extract');
        } else if (
            action.toLocaleLowerCase('id').includes('informasi') ||
            action.toLocaleLowerCase('id').includes('sumber')
        ) {
            setWorkflowMode('search');
        }

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

    const resizeComposer = useCallback(
        (element: HTMLTextAreaElement) => {
            element.style.height = 'auto';
            const collapsedLimit = 160;
            const heightLimit = composerExpanded
                ? Math.round(window.innerHeight * 0.45)
                : collapsedLimit;
            const contentHeight = element.scrollHeight;
            const nextHeight = Math.min(
                Math.max(contentHeight, 36),
                heightLimit,
            );

            element.style.height = `${nextHeight}px`;
            element.style.overflowY =
                contentHeight > heightLimit ? 'auto' : 'hidden';
            setComposerOverflowing(contentHeight > collapsedLimit);
            setComposerMultiline(contentHeight > 44);
        },
        [composerExpanded],
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
        if (!list || conversationReadOnly || busy || processingFiles) {
            return;
        }

        const incoming = Array.from(list);
        const unsupported = incoming.find(
            (file) =>
                !/\.(pdf|docx|xlsx|xlsm|csv|txt|jpe?g|png)$/i.test(file.name),
        );

        if (unsupported) {
            window.alert(
                `${unsupported.name}: format tidak didukung. Gunakan PDF, Word (.docx), Excel (.xlsx/.xlsm), CSV, TXT, JPG, atau PNG.`,
            );

            return;
        }

        if (files.length + incoming.length > 5) {
            window.alert('Maksimum lima dokumen untuk setiap permintaan.');

            return;
        }

        const oversized = incoming.find((file) => file.size > 20 * 1024 * 1024);

        if (oversized) {
            window.alert(
                `${oversized.name} melebihi batas 20 MB per file. Pisahkan atau kompres file terlebih dahulu.`,
            );

            return;
        }

        setFiles((current) => [...current, ...incoming]);
    }
    function submit(answerOverrides: Record<string, string> = {}) {
        if (conversationReadOnly) {
            return;
        }

        const submittedPrompt = prompt.trim();
        const submittedAnswers = { ...answers, ...answerOverrides };

        if (
            !files.length &&
            !submittedPrompt &&
            !Object.values(submittedAnswers).some(Boolean)
        ) {
            setGenerationErrors({
                prompt: 'Tulis pertanyaan atau instruksi sebelum mengirim.',
            });

            return;
        }

        if (files.length) {
            if (submittedPrompt.length > 2000) {
                setGenerationErrors({
                    prompt: 'Pesan dengan lampiran maksimal 2.000 karakter. Ringkas instruksi sebelum mengirim.',
                });

                return;
            }

            setGenerationErrors({});
            setActiveRequestId(null);
            setLiveEvents([]);
            const data = new FormData();
            files.forEach((file) => data.append('documents[]', file));
            data.append('origin', 'assistant');

            if (submittedPrompt) {
                data.append('prompt', submittedPrompt);
            }

            const generationIntent = requestsNewsGeneration(submittedPrompt);
            const generalExtraction =
                !submittedPrompt ||
                /\b(all|everything|semua|seluruh|tidak tahu|don't know)\b/i.test(
                    prompt,
                );
            data.append(
                'intent',
                generationIntent
                    ? 'generate_news'
                    : /\b(simpan saja|store only|save only)\b/i.test(
                            submittedPrompt,
                        )
                      ? 'store_document'
                      : /\b(bandingkan|analisis|analyze|compare)\b/i.test(
                              submittedPrompt,
                          )
                        ? 'analysis'
                        : /[?]|\b(apa|berapa|siapa|kapan|what|how many|who|when)\b/i.test(
                                submittedPrompt,
                            )
                          ? 'question'
                          : 'extract_information',
            );
            data.append(
                'extraction_mode',
                generalExtraction ? 'general' : 'targeted',
            );

            if (!generalExtraction && submittedPrompt) {
                data.append('extraction_query', submittedPrompt);
            }

            if (manualFact.trim()) {
                data.append('manual_fact', manualFact.trim());
            }

            if (newsSession?.id) {
                data.append('session_id', String(newsSession.id));
            }

            informationIds.forEach((id) =>
                data.append('information_ids[]', String(id)),
            );
            documentIds.forEach((id) =>
                data.append('document_ids[]', String(id)),
            );

            const attachedNames = files.map((f) => f.name);
            setFiles([]);
            setDocumentIds([]);

            if (fileInput.current) {
                fileInput.current.value = '';
            }

            setBusy(true);
            setElapsedSeconds(0);
            setPendingUserMessage({
                content: submittedPrompt || 'Proses file yang saya lampirkan.',
                attachments: attachedNames,
            });
            setPrompt('');
            router.post('/admin/documents', data, {
                forceFormData: true,
                onError: (uploadErrors) => {
                    setGenerationErrors(uploadErrors);
                    setPrompt(submittedPrompt);
                    setFiles(files);
                    setDocumentIds(documentIds);
                },
                onCancel: () => {
                    setPrompt(submittedPrompt);
                    setFiles(files);
                    setDocumentIds(documentIds);
                    setGenerationErrors({
                        documents:
                            'Pengiriman terhenti. Dokumen dan pesan tetap tersedia. Silakan kirim ulang.',
                    });
                },
                preserveState: true,
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    setPendingUserMessage(null);
                },
            });

            return;
        }

        setBusy(true);
        setElapsedSeconds(0);
        const answerText = Object.values(submittedAnswers)
            .filter(Boolean)
            .join(', ');
        setPendingUserMessage({
            content:
                submittedPrompt ||
                (answerText
                    ? `Saya memilih: ${answerText}`
                    : 'Lanjutkan permintaan ini.'),
        });
        setPrompt('');
        const requestId = crypto.randomUUID();
        setActiveRequestId(requestId);
        setLiveEvents([]);
        void startGeneration({
            mode:
                questions.length > 0 && Object.keys(submittedAnswers).length > 0
                    ? 'news'
                    : 'auto',
            request_id: requestId,
            draft_id: editedArticle?.draft_id ?? null,
            session_id: newsSession?.id ?? null,
            information_ids: informationIds,
            document_ids: documentIds,
            prompt: submittedPrompt || null,
            answers: manualFact.trim()
                ? {
                      ...submittedAnswers,
                      additional_context: manualFact.trim(),
                  }
                : submittedAnswers,
            tone: 'formal',
        });
    }

    function continueAfterInformationReview(newlyApprovedIds: number[]) {
        if (!newsSession?.id) {
            return;
        }

        const approvedIds = Array.from(
            new Set([...informationIds, ...newlyApprovedIds]),
        );
        setInformationIds(approvedIds);

        if (newsSession.current_intent !== 'generate_news') {
            router.reload({
                only: [
                    'informationItems',
                    'pendingInformation',
                    'newsSession',
                    'sessions',
                ],
            });

            return;
        }

        setBusy(true);
        setElapsedSeconds(0);
        const requestId = crypto.randomUUID();
        setActiveRequestId(requestId);
        setLiveEvents([]);
        void startGeneration({
            request_id: requestId,
            session_id: newsSession.id,
            information_ids: approvedIds,
            document_ids: [],
            prompt: newsSession.prompt,
            draft_id: editedArticle?.draft_id ?? null,
            answers: {},
            tone: 'formal',
        });
    }

    useEffect(() => {
        const current = sessions.find((s) => s.id === newsSession?.id);

        if (current?.request_id && !activeRequestId) {
            setActiveRequestId(current.request_id);
            setBusy(true);
        }
    }, [sessions, newsSession?.id, activeRequestId]);
    useEffect(() => {
        if (busy) {
            return;
        }

        const timer = window.setInterval(
            () => router.reload({ only: ['sessions'], async: true }),
            8000,
        );

        return () => window.clearInterval(timer);
    }, [busy]);

    const [conflictApprovalOpen, setConflictApprovalOpen] = useState(false);
    const [conflictApprovalWord, setConflictApprovalWord] = useState('');
    const [approvingConflict, setApprovingConflict] = useState(false);
    const [conflictApprovalError, setConflictApprovalError] = useState('');

    function approveConflict() {
        if (
            !editedArticle ||
            draftDirty ||
            editMode ||
            conversationReadOnly ||
            approvingConflict ||
            conflictApprovalWord.trim() !== 'setuju'
        ) {
            return;
        }

        setApprovingConflict(true);
        setConflictApprovalError('');
        router.post(
            `/admin/ai-assistant/drafts/${editedArticle.draft_id}/approve-conflict`,
            {
                version: editedArticle.version,
                confirm: true,
                confirmation_word: conflictApprovalWord.trim(),
            },
            {
                onSuccess: () => {
                    setConflictApprovalOpen(false);
                    setConflictApprovalWord('');
                },
                onError: (errors) =>
                    setConflictApprovalError(Object.values(errors).join(' ')),
                onFinish: () => setApprovingConflict(false),
            },
        );
    }

    function saveDraft() {
        if (!editedArticle) {
            return;
        }

        router.put(
            `/admin/ai-assistant/drafts/${editedArticle.draft_id}`,
            {
                title: editedArticle.headline,
                content: articleContent,
                category_id: editedArticle.category_id ?? null,
            },
            { onSuccess: () => setEditMode(false) },
        );
    }

    function publishDraft() {
        if (
            conversationReadOnly ||
            editMode ||
            draftDirty ||
            publishing ||
            imageSaving ||
            !editedArticle ||
            editedArticle.quality?.publish_blocked
        ) {
            return;
        }

        setPublishError('');
        setPublishOpen(true);
    }

    function confirmPublish(previewToken: string) {
        if (
            conversationReadOnly ||
            editMode ||
            draftDirty ||
            publishing ||
            imageSaving ||
            !editedArticle ||
            editedArticle.quality?.publish_blocked ||
            !selectedPlatforms.length
        ) {
            return;
        }

        setPublishing(true);
        router.post(
            `/admin/news/drafts/${editedArticle.draft_id}/publish`,
            {
                platforms: selectedPlatforms,
                version: editedArticle.version,
                confirm_review: true,
                preview_token: previewToken,
            },
            {
                preserveScroll: true,
                onSuccess: () => setPublishOpen(false),
                onError: (errors) =>
                    setPublishError(Object.values(errors).join(' ')),
                onFinish: () => setPublishing(false),
            },
        );
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
            {
                forceFormData: true,
                onStart: () => {
                    setImageSaving(true);
                    setImageError('');
                },
                onSuccess: () => setCropOpen(true),
                onError: (errors) =>
                    setImageError(Object.values(errors).join(' ')),
                onFinish: () => setImageSaving(false),
            },
        );
    }
    async function findRelated() {
        if (!prompt.trim()) {
            return;
        }

        setFindingRelated(true);

        try {
            const response = await csrfPost(
                '/admin/ai-assistant/recommendations',
                { query: prompt.trim() },
            );
            const data = (await response.json()) as {
                recommendations?: Recommendation[];
            };
            setRecommendations(data.recommendations ?? []);
        } catch (error) {
            setGenerationErrors({
                generation:
                    error instanceof Error
                        ? error.message
                        : 'Pencarian sumber gagal.',
            });
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
        const requestId = crypto.randomUUID();
        setActiveRequestId(requestId);
        setLiveEvents([]);
        void startGeneration({
            request_id: requestId,
            information_ids: preselectedInformationIds,
            document_ids: initialDocumentIds,
            prompt: initialPrompt || null,
            answers: initialManualFact
                ? { additional_context: initialManualFact }
                : {},
            tone: 'formal',
        });
    }, [
        autoGenerate,
        initialDocumentIds,
        initialPrompt,
        initialManualFact,
        preselectedInformationIds,
        startGeneration,
    ]);

    useEffect(() => {
        if (!processingFiles) {
            return;
        }

        const timer = window.setInterval(
            () =>
                router.reload({
                    only: [
                        'newsSession',
                        'documents',
                        'informationItems',
                        'pendingInformation',
                    ],
                }),
            5000,
        );

        return () => window.clearInterval(timer);
    }, [processingFiles]);

    useEffect(() => {
        setEditedArticle(generatedArticle ?? null);

        if (generatedArticle) {
            setPreviewOpen(true);
        }
    }, [generatedArticle]);

    useEffect(() => {
        if (!resizingPreview) {
            return;
        }

        const resize = (event: MouseEvent) => {
            const minimumChatWidth = 420;
            const minimumPreviewWidth = 380;
            const workspaceBounds = workspace.current?.getBoundingClientRect();
            const availableWidth = workspaceBounds?.width ?? window.innerWidth;
            const rightEdge = workspaceBounds?.right ?? window.innerWidth;
            const maximumPreviewWidth = Math.min(
                960,
                availableWidth - minimumChatWidth,
            );
            setPreviewWidth(
                Math.max(
                    minimumPreviewWidth,
                    Math.min(maximumPreviewWidth, rightEdge - event.clientX),
                ),
            );
        };
        const stop = () => setResizingPreview(false);

        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stop);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stop);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [resizingPreview]);

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

    useEffect(() => {
        if (composerInput.current) {
            resizeComposer(composerInput.current);
        }
    }, [prompt, resizeComposer]);

    return (
        <>
            <PublishNewsDialog
                open={publishOpen}
                onOpenChange={setPublishOpen}
                platforms={publishPlatforms}
                metaAuth={metaAuth}
                selected={selectedPlatforms}
                onSelectionChange={setSelectedPlatforms}
                processing={publishing}
                contentReady={
                    !editMode &&
                    !draftDirty &&
                    !imageSaving &&
                    Boolean(editedArticle)
                }
                requireReviewConfirmation
                error={publishError}
                onPreparePreview={() =>
                    metaRequest<PublicationPreviewData>(
                        `/admin/news/drafts/${editedArticle!.draft_id}/preview`,
                        { version: editedArticle!.version },
                    )
                }
                onPublish={confirmPublish}
            />
            {cropOpen && editedArticle?.image && (
                <NewsImageCropDialog
                    src={editedArticle.image}
                    initial={editedArticle.image_crops ?? null}
                    onClose={() => setCropOpen(false)}
                    onReplace={() => {
                        setCropOpen(false);
                        newsImageInput.current?.click();
                    }}
                    onSave={(crops) => {
                        setCropOpen(false);
                        router.post(
                            `/admin/news/drafts/${editedArticle.draft_id}/crops`,
                            {
                                image_crops: crops,
                                version: editedArticle.version,
                            },
                            {
                                preserveScroll: true,
                                onStart: () => {
                                    setImageSaving(true);
                                    setImageError('');
                                },
                                onError: (errors) =>
                                    setImageError(
                                        Object.values(errors).join(' '),
                                    ),
                                onFinish: () => setImageSaving(false),
                            },
                        );
                    }}
                />
            )}
            <Head title="Asisten AI" />
            <div
                ref={workspace}
                className="relative -mt-16 flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground lg:flex-row"
            >
                <SessionPanel sessions={sessions} current={newsSession?.id} />
                <section
                    onDragEnter={(event) => {
                        if (!event.dataTransfer.types.includes('Files')) {
                            return;
                        }

                        event.preventDefault();
                        dragDepth.current += 1;
                        setDraggingFiles(true);
                    }}
                    onDragOver={(event) => {
                        if (!event.dataTransfer.types.includes('Files')) {
                            return;
                        }

                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect =
                            conversationReadOnly || busy || processingFiles
                                ? 'none'
                                : 'copy';
                    }}
                    onDragLeave={(event) => {
                        if (!event.dataTransfer.types.includes('Files')) {
                            return;
                        }

                        dragDepth.current = Math.max(0, dragDepth.current - 1);

                        if (dragDepth.current === 0) {
                            setDraggingFiles(false);
                        }
                    }}
                    onDrop={(event) => {
                        if (!event.dataTransfer.types.includes('Files')) {
                            return;
                        }

                        event.preventDefault();
                        event.stopPropagation();
                        dragDepth.current = 0;
                        setDraggingFiles(false);
                        addFiles(event.dataTransfer.files);
                    }}
                    className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-background ${previewOpen && editedArticle ? 'border-b lg:border-b-0' : 'w-full'}`}
                >
                    {draggingFiles && (
                        <div
                            className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/95 p-6 text-center"
                            role="status"
                            aria-live="polite"
                        >
                            <div className="space-y-3">
                                <Paperclip className="mx-auto size-10 text-primary" />
                                <p className="text-lg font-semibold">
                                    {conversationReadOnly
                                        ? 'Percakapan ini hanya dapat dibaca'
                                        : busy || processingFiles
                                          ? 'Tunggu proses selesai sebelum menambahkan file'
                                          : 'Lepaskan file untuk melampirkan'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Maksimum 5 file · 20 MB per file
                                </p>
                                {!conversationReadOnly &&
                                    !busy &&
                                    !processingFiles && (
                                        <p className="text-sm text-muted-foreground">
                                            Tambahkan instruksi, lalu kirim
                                            untuk mulai memproses.
                                        </p>
                                    )}
                            </div>
                        </div>
                    )}
                    <WorkspaceActions
                        canOpenPreview={Boolean(editedArticle && !previewOpen)}
                        onOpenPreview={() => setPreviewOpen(true)}
                        onOpenHistory={() => router.visit('/admin/news')}
                        onOpenDocuments={() => router.visit('/admin/documents')}
                    />
                    <MessageScrollerProvider
                        autoScroll
                        defaultScrollPosition="end"
                    >
                        <MessageScroller className="min-h-0 flex-1">
                            <MessageScrollerViewport
                                className={`px-5 pt-32 ${conversationStarted ? 'pb-56' : 'pb-28'} ${previewOpen && editedArticle ? '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}`}
                            >
                                <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-4">
                                    {conversationReadOnly && (
                                        <MessageScrollerItem messageId="read-only">
                                            <p className="rounded-lg border p-3 text-sm">
                                                Berita sudah terbit. Percakapan
                                                ini hanya dapat dibaca. Mulai
                                                percakapan baru untuk perubahan.
                                            </p>
                                        </MessageScrollerItem>
                                    )}
                                    <MessageScrollerItem messageId="welcome">
                                        {!conversationStarted ? (
                                            <AssistantEmptyState />
                                        ) : (
                                            <AssistantConversationIntro />
                                        )}
                                    </MessageScrollerItem>
                                    {(newsSession?.messages ?? [])
                                        .filter(
                                            (message) =>
                                                message.intent !==
                                                'queued_request',
                                        )
                                        .map((message) => (
                                            <MessageScrollerItem
                                                key={message.id}
                                                messageId={`history-${message.id}`}
                                                className="group/message"
                                            >
                                                <CategoryProposalCard
                                                    readOnly={
                                                        conversationReadOnly
                                                    }
                                                    message={message}
                                                    categories={categories}
                                                />
                                                <ChatMessage
                                                    message={message}
                                                    documents={documents}
                                                />
                                                {message.role === 'user' &&
                                                    message.content && (
                                                        <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/message:opacity-100 [@media(hover:hover)]:group-hover/message:opacity-100">
                                                            {message.created_at &&
                                                                !Number.isNaN(
                                                                    Date.parse(
                                                                        message.created_at,
                                                                    ),
                                                                ) && (
                                                                    <time
                                                                        dateTime={
                                                                            message.created_at
                                                                        }
                                                                        title={new Date(
                                                                            message.created_at,
                                                                        ).toLocaleString(
                                                                            'id-ID',
                                                                        )}
                                                                        className="text-xs text-muted-foreground"
                                                                    >
                                                                        {new Date(
                                                                            message.created_at,
                                                                        ).toLocaleString(
                                                                            'id-ID',
                                                                            {
                                                                                day: 'numeric',
                                                                                month: 'short',
                                                                                year: 'numeric',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit',
                                                                                hourCycle:
                                                                                    'h23',
                                                                            },
                                                                        )}
                                                                    </time>
                                                                )}
                                                            <Button
                                                                type="button"
                                                                size="icon-sm"
                                                                variant="ghost"
                                                                title="Salin pesan"
                                                                aria-label="Salin pesan"
                                                                onClick={() => {
                                                                    void navigator.clipboard
                                                                        .writeText(
                                                                            message.content ??
                                                                                '',
                                                                        )
                                                                        .catch(
                                                                            () =>
                                                                                setGenerationErrors(
                                                                                    {
                                                                                        generation:
                                                                                            'Tidak dapat menyalin pesan.',
                                                                                    },
                                                                                ),
                                                                        );
                                                                }}
                                                            >
                                                                <Copy aria-hidden="true" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="icon-sm"
                                                                variant="ghost"
                                                                title="Edit dan kirim ulang"
                                                                aria-label="Edit dan kirim ulang"
                                                                disabled={
                                                                    busy ||
                                                                    processingFiles ||
                                                                    conversationReadOnly
                                                                }
                                                                onClick={() =>
                                                                    setPrompt(
                                                                        message.content ??
                                                                            '',
                                                                    )
                                                                }
                                                            >
                                                                <Edit3 aria-hidden="true" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                {message.id ===
                                                    draftMessageId && draftCard}
                                                {processingFiles &&
                                                    message.id ===
                                                        extractionMessageId && (
                                                        <DocumentProcessingStatus
                                                            documents={documents.filter(
                                                                (doc) =>
                                                                    (
                                                                        (message
                                                                            .payload
                                                                            ?.document_ids ??
                                                                            []) as number[]
                                                                    ).includes(
                                                                        doc.id,
                                                                    ),
                                                            )}
                                                        />
                                                    )}
                                                {Array.isArray(
                                                    message.payload
                                                        ?.historical_sources,
                                                ) &&
                                                    message.payload
                                                        .historical_sources
                                                        .length > 0 && (
                                                        <details className="group/context mt-2 text-sm">
                                                            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                                                                <ChevronRight
                                                                    aria-hidden="true"
                                                                    className="size-3.5 shrink-0 transition-transform group-open/context:rotate-90"
                                                                />
                                                                Konteks
                                                                terdahulu (
                                                                {
                                                                    message
                                                                        .payload
                                                                        .historical_sources
                                                                        .length
                                                                }
                                                                )
                                                            </summary>
                                                            {message.payload.historical_sources.map(
                                                                (source: {
                                                                    source_id: string;
                                                                    title: string;
                                                                    content: string;
                                                                }) => (
                                                                    <div
                                                                        key={
                                                                            source.source_id
                                                                        }
                                                                        className="mt-3 ml-1.5 border-l border-border/60 pl-4"
                                                                    >
                                                                        <p className="font-medium">
                                                                            {
                                                                                source.title
                                                                            }{' '}
                                                                            ·{' '}
                                                                            {
                                                                                source.source_id
                                                                            }
                                                                        </p>
                                                                        <p className="whitespace-pre-wrap text-muted-foreground">
                                                                            {
                                                                                source.content
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </details>
                                                    )}
                                            </MessageScrollerItem>
                                        ))}
                                    {!busy &&
                                        (newsSession?.runs ?? [])
                                            .filter(
                                                (run) =>
                                                    run.user_message_id ===
                                                    [
                                                        ...(newsSession?.messages ??
                                                            []),
                                                    ]
                                                        .reverse()
                                                        .find(
                                                            (message) =>
                                                                message.role ===
                                                                'user',
                                                        )?.id,
                                            )
                                            .slice(-1)
                                            .map((run) => (
                                                <MessageScrollerItem
                                                    key={`run-${run.id}`}
                                                    messageId={`run-${run.id}`}
                                                >
                                                    <SavedAgentWorkTrace
                                                        run={run}
                                                    />
                                                </MessageScrollerItem>
                                            ))}
                                    {pendingUserMessage && (
                                        <MessageScrollerItem messageId="pending-user-message">
                                            <PendingUserMessage
                                                attachments={
                                                    pendingUserMessage.attachments
                                                }
                                                informationAttachments={
                                                    pendingUserMessage.informationAttachments
                                                }
                                            >
                                                {pendingUserMessage.content}
                                            </PendingUserMessage>
                                        </MessageScrollerItem>
                                    )}
                                    {processingFiles &&
                                        !extractionMessageId && (
                                            <MessageScrollerItem
                                                messageId="processing-files"
                                                scrollAnchor
                                            >
                                                <DocumentProcessingStatus
                                                    documents={documents.filter(
                                                        (doc) =>
                                                            newsSession?.selected_document_ids.includes(
                                                                doc.id,
                                                            ),
                                                    )}
                                                />
                                            </MessageScrollerItem>
                                        )}
                                    {!conversationReadOnly &&
                                        reviewingExtraction &&
                                        !processingFiles && (
                                            <MessageScrollerItem
                                                messageId="extracted-information-review"
                                                scrollAnchor
                                            >
                                                <ExtractedInformationReview
                                                    items={pendingInformation}
                                                    onFinished={
                                                        continueAfterInformationReview
                                                    }
                                                />
                                            </MessageScrollerItem>
                                        )}
                                    {busy && !processingFiles && (
                                        <MessageScrollerItem
                                            messageId="generation-progress"
                                            scrollAnchor
                                        >
                                            <AgentWorkTrace
                                                elapsedSeconds={elapsedSeconds}
                                                events={liveEvents}
                                                connectionMessage={
                                                    progressMessage
                                                }
                                                hasSources={hasSources}
                                                hasFiles={files.length > 0}
                                            />
                                        </MessageScrollerItem>
                                    )}
                                    {!conversationReadOnly &&
                                        questions.length > 0 &&
                                        !busy && (
                                            <MessageScrollerItem
                                                messageId="clarification-round"
                                                scrollAnchor
                                            >
                                                <div className="max-w-[94%] space-y-3">
                                                    <p className="text-sm leading-6 text-muted-foreground">
                                                        Jawab pertanyaan penting
                                                        ini bersama-sama.
                                                        Setelah itu, AI langsung
                                                        membuat draf tanpa
                                                        pertanyaan tambahan.
                                                    </p>
                                                    <Card className="gap-3 border-border bg-card py-4 shadow-none">
                                                        <CardHeader className="gap-2 px-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <CardTitle className="text-sm leading-6">
                                                                    Harap
                                                                    tentukan:
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
                                                                            ] ??
                                                                            ''
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
                                                                                    <Input
                                                                                        value={
                                                                                            question.options.includes(
                                                                                                answers[
                                                                                                    question
                                                                                                        .field
                                                                                                ] ??
                                                                                                    '',
                                                                                            )
                                                                                                ? ''
                                                                                                : (answers[
                                                                                                      question
                                                                                                          .field
                                                                                                  ] ??
                                                                                                  '')
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
                                                                                        placeholder="Atau ketik jawaban sendiri…"
                                                                                    />
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
                                                                    <ArrowUp />
                                                                )}
                                                                Gunakan jawaban
                                                                dan buat draf
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
                                    {!draftMessageId && draftCard}
                                    {errors.guidance && (
                                        <MessageScrollerItem
                                            messageId="prompt-guidance"
                                            scrollAnchor
                                        >
                                            <div className="max-w-2xl text-sm leading-7 text-foreground">
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
                    <div
                        className={`pointer-events-none absolute inset-x-0 z-20 px-4 ${conversationReadOnly ? 'hidden' : ''} ${conversationStarted ? 'bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-3' : 'top-[53%] pt-4'}`}
                    >
                        <div className="pointer-events-auto mx-auto w-full max-w-4xl space-y-2">
                            {(questions.length === 0 || busy) && (
                                <>
                                    <div className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {actions.map((action) => (
                                            <Button
                                                key={action}
                                                variant="outline"
                                                size="sm"
                                                className="rounded-full"
                                                onClick={() =>
                                                    handleQuickAction(action)
                                                }
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
                                                    <span aria-label="Hentikan proses">
                                                        ■
                                                    </span>
                                                ) : (
                                                    <Sparkles />
                                                )}
                                                Cari informasi terkait
                                            </Button>
                                        )}
                                    </div>
                                    {(workflowMode ||
                                        files.length > 0 ||
                                        hasSources) && (
                                        <Collapsible
                                            open={attachmentsOpen}
                                            onOpenChange={setAttachmentsOpen}
                                        >
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="max-w-full"
                                                >
                                                    <Paperclip className="size-4" />
                                                    {files.length +
                                                        informationIds.length +
                                                        documentIds.length}{' '}
                                                    sumber terlampir{' '}
                                                    {attachmentsOpen ? (
                                                        <ChevronDown className="size-4" />
                                                    ) : (
                                                        <ChevronRight className="size-4" />
                                                    )}
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="max-h-40 overflow-y-auto">
                                                <div className="flex flex-wrap gap-2 py-2">
                                                    {workflowMode && (
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1.5 border-primary/30 bg-primary/5 py-1.5 text-primary"
                                                        >
                                                            {workflowMode ===
                                                            'news'
                                                                ? 'Buat berita'
                                                                : workflowMode ===
                                                                    'extract'
                                                                  ? 'Ekstrak informasi'
                                                                  : 'Cari sumber'}
                                                            <button
                                                                type="button"
                                                                aria-label="Hapus mode"
                                                                onClick={() =>
                                                                    setWorkflowMode(
                                                                        null,
                                                                    )
                                                                }
                                                            >
                                                                <X className="size-3" />
                                                            </button>
                                                        </Badge>
                                                    )}
                                                    {files.map(
                                                        (file, index) => (
                                                            <Badge
                                                                key={`${file.name}-${index}`}
                                                                variant="secondary"
                                                                className="gap-1 py-1.5"
                                                            >
                                                                <Paperclip className="size-3" />
                                                                <span className="max-w-40 truncate">
                                                                    {file.name}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setFiles(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                current.filter(
                                                                                    (
                                                                                        _,
                                                                                        position,
                                                                                    ) =>
                                                                                        position !==
                                                                                        index,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    <X className="size-3" />
                                                                </button>
                                                            </Badge>
                                                        ),
                                                    )}
                                                    {informationIds.map(
                                                        (id) => {
                                                            const information =
                                                                informationItems.find(
                                                                    (item) =>
                                                                        item.id ===
                                                                        id,
                                                                );

                                                            return (
                                                                <Badge
                                                                    key={`information-${id}`}
                                                                    variant="secondary"
                                                                    className="gap-1 py-1.5"
                                                                >
                                                                    <FolderSearch className="size-3" />
                                                                    <span className="max-w-48 truncate">
                                                                        {information?.title ??
                                                                            `Informasi #${id}`}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        aria-label="Hapus informasi"
                                                                        onClick={() =>
                                                                            toggle(
                                                                                informationIds,
                                                                                id,
                                                                                setInformationIds,
                                                                            )
                                                                        }
                                                                    >
                                                                        <X className="size-3" />
                                                                    </button>
                                                                </Badge>
                                                            );
                                                        },
                                                    )}
                                                    {documentIds.map((id) => {
                                                        const document =
                                                            documents.find(
                                                                (item) =>
                                                                    item.id ===
                                                                    id,
                                                            );

                                                        return (
                                                            <Badge
                                                                key={`document-${id}`}
                                                                variant="secondary"
                                                                className="gap-1 py-1.5"
                                                            >
                                                                <FileText className="size-3" />
                                                                <span className="max-w-48 truncate">
                                                                    {document?.original_name ??
                                                                        `Dokumen #${id}`}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    aria-label="Hapus dokumen"
                                                                    onClick={() =>
                                                                        toggle(
                                                                            documentIds,
                                                                            id,
                                                                            setDocumentIds,
                                                                        )
                                                                    }
                                                                >
                                                                    <X className="size-3" />
                                                                </button>
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )}
                                    <div
                                        className={`grid items-center gap-1 rounded-2xl border bg-card p-1.5 shadow-lg focus-within:ring-2 focus-within:ring-ring/30 ${composerMultiline ? 'grid-cols-[1fr_auto]' : 'grid-cols-[auto_1fr_auto]'}`}
                                    >
                                        <Textarea
                                            ref={composerInput}
                                            value={prompt}
                                            rows={1}
                                            onChange={(event) => {
                                                setPrompt(event.target.value);
                                                resizeComposer(
                                                    event.currentTarget,
                                                );
                                            }}
                                            placeholder="Tulis instruksi atau seret file ke percakapan…"
                                            className={`min-h-9 resize-none rounded-none border-0 bg-transparent px-3 py-1.5 leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent ${composerMultiline ? 'col-span-2 col-start-1 row-start-1' : 'col-start-2 row-start-1'}`}
                                        />
                                        <div className="contents">
                                            <div
                                                className={`flex items-center gap-1 ${composerMultiline ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1'}`}
                                            >
                                                <input
                                                    ref={fileInput}
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.jpg,.jpeg,.png"
                                                    onChange={(event) => {
                                                        addFiles(
                                                            event.target.files,
                                                        );
                                                        event.target.value = '';
                                                    }}
                                                />
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="rounded-full"
                                                            title="Tambahkan sumber"
                                                            aria-label="Tambahkan sumber"
                                                        >
                                                            <Plus />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        side="top"
                                                        align="start"
                                                        className="w-56"
                                                    >
                                                        <DropdownMenuItem
                                                            onSelect={() => {
                                                                setWorkflowMode(
                                                                    'extract',
                                                                );
                                                                fileInput.current?.click();
                                                            }}
                                                        >
                                                            <Paperclip /> Unggah
                                                            file
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                setPicker(true)
                                                            }
                                                        >
                                                            <FolderSearch />{' '}
                                                            Pilih sumber
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                {picker && (
                                                    <SourcePicker
                                                        information={
                                                            informationItems
                                                        }
                                                        documents={documents}
                                                        informationIds={
                                                            informationIds
                                                        }
                                                        documentIds={
                                                            documentIds
                                                        }
                                                        pendingInformation={
                                                            pendingInformation
                                                        }
                                                        onClose={() =>
                                                            setPicker(false)
                                                        }
                                                        onApply={(
                                                            info,
                                                            docs,
                                                        ) => {
                                                            setInformationIds(
                                                                info,
                                                            );
                                                            setDocumentIds(
                                                                docs,
                                                            );
                                                            setPicker(false);
                                                        }}
                                                    />
                                                )}

                                                {(composerOverflowing ||
                                                    composerExpanded) && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        title={
                                                            composerExpanded
                                                                ? 'Ciutkan kotak pesan'
                                                                : 'Perbesar kotak pesan'
                                                        }
                                                        aria-label={
                                                            composerExpanded
                                                                ? 'Ciutkan kotak pesan'
                                                                : 'Perbesar kotak pesan'
                                                        }
                                                        onClick={() =>
                                                            setComposerExpanded(
                                                                (current) =>
                                                                    !current,
                                                            )
                                                        }
                                                    >
                                                        {composerExpanded ? (
                                                            <Minimize2 />
                                                        ) : (
                                                            <Maximize2 />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                            <Button
                                                size="icon"
                                                className={`rounded-full ${composerMultiline ? 'col-start-2 row-start-2' : 'col-start-3 row-start-1'}`}
                                                disabled={
                                                    (busy &&
                                                        !activeRequestId) ||
                                                    processingFiles ||
                                                    (!files.length &&
                                                        !hasSources &&
                                                        !newsSession &&
                                                        !prompt.trim() &&
                                                        !manualFact.trim())
                                                }
                                                onClick={() =>
                                                    busy
                                                        ? void stopGeneration()
                                                        : submit()
                                                }
                                            >
                                                {busy ? (
                                                    <span aria-label="Hentikan proses">
                                                        ■
                                                    </span>
                                                ) : (
                                                    <ArrowUp />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    {Object.entries(errors)
                                        .filter(
                                            ([field]) =>
                                                [
                                                    'document',
                                                    'documents',
                                                    'generation',
                                                    'prompt',
                                                    'extraction_query',
                                                    'manual_fact',
                                                    'session_id',
                                                ].includes(field) ||
                                                field.startsWith('documents.'),
                                        )
                                        .map(([field, message]) => (
                                            <p
                                                key={field}
                                                role="alert"
                                                className="text-sm text-danger-text"
                                            >
                                                {message}
                                            </p>
                                        ))}
                                    <p className="text-xs text-muted-foreground">
                                        Maksimum 5 file baru · dokumen,
                                        spreadsheet, teks, dan gambar OCR
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </section>
                {editedArticle && previewOpen && (
                    <PreviewFrame
                        onClose={() => setPreviewOpen(false)}
                        width={previewWidth}
                        onResizeStart={(event) => {
                            event.preventDefault();
                            setResizingPreview(true);
                        }}
                    >
                        <Dialog
                            open={
                                conflictApprovalOpen &&
                                Boolean(editedArticle.can_approve_conflict)
                            }
                            onOpenChange={(open) => {
                                if (!approvingConflict) {
                                    setConflictApprovalOpen(open);
                                    setConflictApprovalWord('');
                                    setConflictApprovalError('');
                                }
                            }}
                        >
                            <DialogContent closeDisabled={approvingConflict}>
                                <DialogHeader>
                                    <DialogTitle>
                                        Setujui berita dengan perbedaan data?
                                    </DialogTitle>
                                    <DialogDescription>
                                        AI menemukan perbedaan pada sumber.
                                        Pastikan berita menjelaskan perbedaan
                                        tersebut dengan benar. Persetujuan
                                        membuka akses publikasi untuk versi ini;
                                        berita belum langsung dipublikasikan.
                                    </DialogDescription>
                                </DialogHeader>
                                <ul className="max-h-40 list-disc space-y-2 overflow-auto pl-5 text-sm">
                                    {editedArticle.quality?.warnings.map(
                                        (warning, i) => (
                                            <li key={i}>{warning}</li>
                                        ),
                                    )}
                                </ul>
                                <label
                                    className="block text-sm"
                                    htmlFor="conflict-approval-word"
                                >
                                    Ketik <strong>setuju</strong> untuk
                                    menyetujui.
                                    <input
                                        id="conflict-approval-word"
                                        className="mt-2 w-full rounded border bg-background p-2"
                                        value={conflictApprovalWord}
                                        disabled={approvingConflict}
                                        autoComplete="off"
                                        onChange={(event) =>
                                            setConflictApprovalWord(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="setuju"
                                    />
                                </label>
                                {conflictApprovalError && (
                                    <p
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {conflictApprovalError}
                                    </p>
                                )}
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        disabled={approvingConflict}
                                        onClick={() => {
                                            setConflictApprovalOpen(false);
                                            setConflictApprovalWord('');
                                        }}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        onClick={approveConflict}
                                        disabled={
                                            approvingConflict ||
                                            conversationReadOnly ||
                                            editMode ||
                                            draftDirty ||
                                            conflictApprovalWord.trim() !==
                                                'setuju'
                                        }
                                    >
                                        {approvingConflict
                                            ? 'Menyetujui…'
                                            : 'Setujui'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-card/80 px-5 py-4 backdrop-blur-xl">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-semibold">
                                        Pratinjau berita
                                    </h2>
                                    <Badge variant="secondary">DRAF AI</Badge>
                                    <QualityScoreBadge
                                        quality={editedArticle.quality}
                                    />
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
                                {editMode || draftDirty ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setEditedArticle(
                                                    generatedArticle ?? null,
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
                                            disabled={conversationReadOnly}
                                            onClick={() => setEditMode(true)}
                                        >
                                            <Edit3 /> Edit
                                        </Button>
                                        {editedArticle.can_approve_conflict && (
                                            <Button
                                                variant="outline"
                                                disabled={
                                                    conversationReadOnly ||
                                                    approvingConflict
                                                }
                                                onClick={() => {
                                                    setConflictApprovalWord('');
                                                    setConflictApprovalError(
                                                        '',
                                                    );
                                                    setConflictApprovalOpen(
                                                        true,
                                                    );
                                                }}
                                            >
                                                Tinjau dan setujui konflik
                                            </Button>
                                        )}
                                        <Button
                                            disabled={
                                                conversationReadOnly ||
                                                publishing ||
                                                Boolean(
                                                    editedArticle.quality
                                                        ?.publish_blocked,
                                                )
                                            }
                                            onClick={publishDraft}
                                        >
                                            Publikasikan
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPreviewOpen(false)}
                                    title="Tutup pratinjau"
                                    aria-label="Tutup pratinjau"
                                >
                                    <PanelRightClose />
                                </Button>
                            </div>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 p-5 lg:p-8">
                            <article className="mx-auto max-w-3xl rounded-2xl bg-background p-6 shadow-lg ring-1 ring-border/50 md:p-10">
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
                                    disabled={
                                        !editMode || imageSaving || draftDirty
                                    }
                                    onClick={() =>
                                        newsImageInput.current?.click()
                                    }
                                >
                                    {editedArticle.image ? (
                                        <>
                                            <img
                                                src={
                                                    editedArticle.image_variants
                                                        ?.website ??
                                                    editedArticle.image
                                                }
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
                                {editMode && draftDirty && (
                                    <p className="mb-4 text-sm text-muted-foreground">
                                        Simpan perubahan teks sebelum mengganti
                                        atau menyesuaikan gambar.
                                    </p>
                                )}
                                {imageError && (
                                    <p
                                        role="alert"
                                        className="mb-4 text-sm text-destructive"
                                    >
                                        {imageError}
                                    </p>
                                )}
                                {editedArticle.image &&
                                    !conversationReadOnly && (
                                        <Button
                                            variant="outline"
                                            className="mb-5"
                                            disabled={
                                                imageSaving ||
                                                publishing ||
                                                draftDirty
                                            }
                                            onClick={() => setCropOpen(true)}
                                        >
                                            {imageSaving
                                                ? 'Menyimpan gambar...'
                                                : 'Pratinjau & Sesuaikan Gambar'}
                                        </Button>
                                    )}
                                {editMode ? (
                                    <div className="mb-5 space-y-2">
                                        <Label htmlFor="draft-category">
                                            Kategori
                                        </Label>
                                        <Select
                                            value={
                                                categories.some(
                                                    (category) =>
                                                        category.categoryID ===
                                                        editedArticle.category_id,
                                                )
                                                    ? String(
                                                          editedArticle.category_id,
                                                      )
                                                    : ''
                                            }
                                            onValueChange={(value) => {
                                                const category =
                                                    categories.find(
                                                        (item) =>
                                                            item.categoryID ===
                                                            Number(value),
                                                    );

                                                if (category) {
setEditedArticle({
                                                        ...editedArticle,
                                                        category_id:
                                                            category.categoryID,
                                                        category: category.name,
                                                    });
}
                                            }}
                                        >
                                            <SelectTrigger
                                                id="draft-category"
                                                aria-invalid={Boolean(
                                                    errors.category_id,
                                                )}
                                            >
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem
                                                        key={
                                                            category.categoryID
                                                        }
                                                        value={String(
                                                            category.categoryID,
                                                        )}
                                                    >
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.category_id && (
                                            <p className="text-sm text-destructive">
                                                {errors.category_id}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    editedArticle.category && (
                                        <div className="mb-5 flex flex-wrap gap-2">
                                            <Badge>
                                                {editedArticle.category}
                                            </Badge>
                                        </div>
                                    )
                                )}
                                {editMode ? (
                                    <Input
                                        value={editedArticle.headline}
                                        onChange={(event) =>
                                            setEditedArticle({
                                                ...editedArticle,
                                                headline: event.target.value,
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
                                <p
                                    className="mb-3 text-xs text-muted-foreground"
                                    aria-live="polite"
                                >
                                    {wordCount} kata · Maksimal 250 kata untuk
                                    draf AI
                                </p>
                                {editMode ? (
                                    <NewsRichEditor
                                        value={formattedContent.html}
                                        characterCount={
                                            Array.from(formattedContent.text)
                                                .length
                                        }
                                        invalid={false}
                                        disabled={busy || conversationReadOnly}
                                        onChange={(html) =>
                                            setEditedArticle({
                                                ...editedArticle,
                                                lead: '',
                                                body: [html],
                                            })
                                        }
                                    />
                                ) : (
                                    <div
                                        className="prose prose-sm dark:prose-invert max-w-none break-words [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:list-disc"
                                        dangerouslySetInnerHTML={{
                                            __html: formattedContent.html,
                                        }}
                                    />
                                )}
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
                                            {documentSources.length} dokumen ·{' '}
                                            {documentSources.reduce(
                                                (count, group) =>
                                                    count +
                                                    group.information.length,
                                                0,
                                            )}{' '}
                                            informasi)
                                            {sourcesOpen ? (
                                                <ChevronDown />
                                            ) : (
                                                <ChevronRight />
                                            )}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-3 space-y-2">
                                        {documentSources.map((group, index) => (
                                            <Collapsible
                                                key={group.key}
                                                className="rounded-lg border bg-muted/20 p-3"
                                            >
                                                <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
                                                    <FileText className="size-4 shrink-0 text-primary" />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-medium break-words">
                                                            {index + 1}.{' '}
                                                            {group.document}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {
                                                                group
                                                                    .information
                                                                    .length
                                                            }{' '}
                                                            informasi
                                                        </span>
                                                    </span>
                                                    <ChevronDown className="size-4 shrink-0" />
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-3 space-y-3 border-t pt-3">
                                                    {group.information.map(
                                                        (source) => (
                                                            <div
                                                                key={source.id}
                                                                className="space-y-1"
                                                            >
                                                                <p className="text-sm font-medium">
                                                                    {
                                                                        source.title
                                                                    }
                                                                </p>
                                                                {source.evidence
                                                                    .length ===
                                                                    0 && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Kutipan
                                                                        bukti
                                                                        belum
                                                                        tersedia.
                                                                    </p>
                                                                )}
                                                                {source.evidence.map(
                                                                    (
                                                                        evidence,
                                                                        evidenceIndex,
                                                                    ) => (
                                                                        <p
                                                                            key={
                                                                                evidenceIndex
                                                                            }
                                                                            className="text-xs leading-5 break-words text-muted-foreground"
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
                                                            </div>
                                                        ),
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            </article>
                        </div>
                    </PreviewFrame>
                )}
            </div>
        </>
    );
}

NewsCreatorAgent.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);

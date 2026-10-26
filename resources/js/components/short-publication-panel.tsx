import { Link, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronUp,
    Clapperboard,
    Newspaper,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PlatformIcon } from '@/components/publication-preview';
import { FeedbackToast } from '@/components/feedback-toast';
import type { Feedback } from '@/components/feedback-toast';
import { PublishResultDialog } from '@/components/publish-result-dialog';
import { Button } from '@/components/ui/button';
import { VideoPublicationIndicator } from '@/components/video-publication-indicator';
import type { PublishResult } from '@/lib/manual-publish';
import { metaRequest } from '@/lib/meta-auth';
import { publicationPolling } from '@/lib/short-publication';

type Platform = 'website' | 'instagram' | 'facebook';
type Job = {
    key: string;
    kind: 'news' | 'video';
    id: number | string;
    title: string;
    thumbnail_url?: string | null;
    duration?: number;
    destinations: Platform[];
    ready: boolean;
    result?: PublishResult;
};
type DraftJob = {
    id: number;
    title: string | null;
    thumbnail_url?: string | null;
    revision: string | null;
    status: 'queued' | 'processing' | 'ready' | 'failed';
    error?: string | null;
    notified: boolean;
};
const platforms: Platform[] = ['website', 'instagram', 'facebook'];
const names = {
    website: 'ApaKhabar',
    instagram: 'Instagram',
    facebook: 'Facebook',
};
const jobKey = (kind: Job['kind'], id: Job['id']) => `${kind}:${id}`;
const status = (job: Job, platform: Platform) =>
    job.result?.results[kindPlatform(job.kind, platform)]?.status ??
    (job.kind === 'news' &&
    job.result?.results[kindPlatform(job.kind, platform)]
        ? job.result.results[kindPlatform(job.kind, platform)].success
            ? 'published'
            : 'failed'
        : job.kind === 'news'
          ? 'unknown'
          : 'queued');
const kindPlatform = (kind: Job['kind'], platform: Platform) =>
    kind === 'news' && platform === 'website' ? 'application' : platform;
const completed = (job: Job) =>
    job.destinations.filter((platform) =>
        ['published', 'failed'].includes(status(job, platform)),
    ).length;
const successful = (job: Job) =>
    job.ready &&
    job.destinations.length > 0 &&
    job.destinations.every((platform) => status(job, platform) === 'published');
const failed = (job: Job) =>
    job.destinations.some((platform) =>
        ['failed', 'uncertain'].includes(status(job, platform)),
    );
const active = (job: Job) =>
    !job.ready ||
    job.destinations.some((platform) =>
        ['queued', 'uploading', 'processing'].includes(status(job, platform)),
    );

function readJobs(key: string): Job[] {
    try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? '[]');
        return Array.isArray(value)
            ? value.filter(
                  (job) =>
                      (job?.kind === 'news' || job?.kind === 'video') &&
                      typeof job.key === 'string' &&
                      typeof job.title === 'string',
              )
            : [];
    } catch {
        return [];
    }
}
function readDrafts(key: string): DraftJob[] {
    try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? '[]');
        return Array.isArray(value)
            ? value.filter(
                  (draft) =>
                      typeof draft?.id === 'number' &&
                      (draft.title === null || typeof draft.title === 'string') &&
                      ['queued', 'processing', 'ready', 'failed'].includes(
                          draft.status,
                      ),
              )
            : [];
    } catch {
        return [];
    }
}
function persist(key: string, jobs: Job[] | DraftJob[]) {
    try {
        sessionStorage.setItem(key, JSON.stringify(jobs));
    } catch {
        /* The panel still works in memory. */
    }
}

export function ShortPublicationPanel() {
    const { auth } = usePage<{ auth: { user: { id: number } | null } }>().props;
    const storageKey = `publication-workloads:${auth.user?.id}`;
    const draftStorageKey = `draft-workloads:${auth.user?.id}`;
    const [jobs, setJobs] = useState<Job[]>(() => readJobs(storageKey));
    const [drafts, setDrafts] = useState<DraftJob[]>(() =>
        readDrafts(draftStorageKey),
    );
    const [draftToasts, setDraftToasts] = useState<Feedback[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [minimized, setMinimized] = useState(false);
    const [error, setError] = useState('');
    const [retrying, setRetrying] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const inFlight = useRef(new Set<string>());
    const draftInFlight = useRef(new Set<number>());
    const dismissTimers = useRef(new Map<string, number>());
    const latest = useRef<Job[]>(jobs);
    const latestDrafts = useRef<DraftJob[]>(drafts);
    const announcedDrafts = useRef(new Set<DraftJob>());
    const update = (apply: (previous: Job[]) => Job[]) => {
        setJobs((previous) => {
            const next = apply(previous);
            latest.current = next;
            persist(storageKey, next);
            return next;
        });
    };
    const remove = (key: string) => {
        update((previous) => previous.filter((job) => job.key !== key));
        setSelected((current) => (current === key ? null : current));
    };
    const updateDrafts = (apply: (previous: DraftJob[]) => DraftJob[]) => {
        setDrafts((previous) => {
            const next = apply(previous);
            latestDrafts.current = next;
            persist(draftStorageKey, next);
            return next;
        });
    };
    const removeDraft = (id: number) => {
        updateDrafts((previous) => previous.filter((draft) => draft.id !== id));
    };
    useEffect(() => {
        const video = (event: Event) => {
            const detail = (
                event as CustomEvent<{
                    id?: number;
                    removeId?: number;
                    replaceId?: number;
                    title?: string;
                    thumbnail_url?: string | null;
                    duration?: number;
                    destinations?: Platform[];
                    ready?: boolean;
                    result?: PublishResult;
                    open?: boolean;
                }>
            ).detail;
            if (detail.removeId !== undefined) {
                remove(jobKey('video', detail.removeId));
                return;
            }
            if (detail.id === undefined) return;
            const key = jobKey('video', detail.id);
            const oldKey =
                detail.replaceId === undefined
                    ? null
                    : jobKey('video', detail.replaceId);
            update((previous) => {
                const old = previous.find(
                    (job) => job.key === key || job.key === oldKey,
                );
                return [
                    ...previous.filter(
                        (job) => job.key !== key && job.key !== oldKey,
                    ),
                    {
                        key,
                        kind: 'video',
                        id: detail.id!,
                        title: detail.title ?? old?.title ?? '',
                        thumbnail_url:
                            detail.thumbnail_url ?? old?.thumbnail_url,
                        duration: detail.duration ?? old?.duration,
                        destinations:
                            detail.destinations ??
                            old?.destinations ??
                            platforms,
                        ready: detail.ready ?? old?.ready ?? true,
                        result: detail.result ?? old?.result,
                    },
                ];
            });
            if (detail.open) setSelected(key);
        };
        const news = (event: Event) => {
            const detail = (
                event as CustomEvent<{
                    id: string;
                    title: string;
                    thumbnail_url?: string | null;
                    destinations: Platform[];
                    result?: PublishResult;
                    ready: boolean;
                    open?: boolean;
                }>
            ).detail;
            const key = jobKey('news', detail.id);
            update((previous) => [
                ...previous.filter((job) => job.key !== key),
                {
                    key,
                    kind: 'news',
                    id: detail.id,
                    title: detail.title,
                    thumbnail_url: detail.thumbnail_url,
                    destinations: detail.destinations,
                    ready: detail.ready,
                    result: detail.result,
                },
            ]);
            if (detail.open) setSelected(key);
        };
        const draftSaved = (event: Event) => {
            const detail = (event as CustomEvent<Omit<DraftJob, 'notified'>>)
                .detail;
            if (!detail || typeof detail.id !== 'number') return;
            updateDrafts((previous) => {
                return [
                    ...previous.filter((draft) => draft.id !== detail.id),
                    {
                        ...detail,
                        notified: false,
                    },
                ];
            });
        };
        window.addEventListener('short-publication', video);
        window.addEventListener('news-publication', news);
        window.addEventListener('short-draft', draftSaved);
        return () => {
            window.removeEventListener('short-publication', video);
            window.removeEventListener('news-publication', news);
            window.removeEventListener('short-draft', draftSaved);
        };
    }, [storageKey, draftStorageKey]);
    useEffect(() => {
        let mounted = true;
        const poll = () => {
            latest.current
                .filter(
                    (job) =>
                        job.kind === 'video' &&
                        job.ready &&
                        publicationPolling(job.result) &&
                        !inFlight.current.has(job.key),
                )
                .forEach((job) => {
                    inFlight.current.add(job.key);
                    void metaRequest<{
                        result: PublishResult;
                        video?: {
                            title?: string;
                            thumbnail_url?: string | null;
                            metadata?: { duration?: number };
                        };
                    }>(`/admin/short-videos/${job.id}/status`)
                        .then((data) => {
                            update((previous) =>
                                previous.map((current) =>
                                    current.key === job.key
                                        ? {
                                              ...current,
                                              result: data.result,
                                              title:
                                                  data.video?.title ??
                                                  current.title,
                                              thumbnail_url:
                                                  data.video?.thumbnail_url ??
                                                  current.thumbnail_url,
                                              duration:
                                                  data.video?.metadata
                                                      ?.duration ??
                                                  current.duration,
                                          }
                                        : current,
                                ),
                            );
                            setError('');
                        })
                        .catch(() => setError('Status belum dapat diperbarui.'))
                        .finally(() => inFlight.current.delete(job.key));
                });
            latestDrafts.current
                .filter(
                    (draft) =>
                        ['queued', 'processing'].includes(draft.status) &&
                        !draftInFlight.current.has(draft.id),
                )
                .forEach((draft) => {
                    draftInFlight.current.add(draft.id);
                    void fetch(`/admin/short-videos/${draft.id}/processing`, {
                        headers: { Accept: 'application/json' },
                    })
                        .then((response) => {
                            if (!response.ok)
                                throw new Error('Status draf gagal dimuat.');
                            return response.json() as Promise<{
                                video: {
                                    title: string | null;
                                    thumbnail_url: string | null;
                                    metadata: {
                                        processing?: {
                                            revision: string;
                                            status: DraftJob['status'];
                                            error?: string | null;
                                        };
                                    };
                                };
                            }>;
                        })
                        .then(({ video }) => {
                            if (!mounted) return;
                            const processing = video.metadata.processing;
                            updateDrafts((previous) =>
                                previous.map((current) => {
                                    if (current.id !== draft.id) return current;
                                    // An older response must not replace a newer save or retry.
                                    if (current.revision !== draft.revision)
                                        return current;
                                    const revision =
                                        processing?.revision ?? null;
                                    const nextStatus =
                                        processing?.status ?? 'ready';
                                    return {
                                        ...current,
                                        title: video.title,
                                        thumbnail_url: video.thumbnail_url,
                                        revision,
                                        status: nextStatus,
                                        error: processing?.error ?? null,
                                        notified:
                                            revision === current.revision &&
                                            nextStatus === current.status
                                                ? current.notified
                                                : false,
                                    };
                                }),
                            );
                            setError('');
                        })
                        .catch(() => {
                            if (mounted)
                                setError('Status draf belum dapat diperbarui.');
                        })
                        .finally(() => draftInFlight.current.delete(draft.id));
                });
        };
        const timer = window.setInterval(poll, 2000);
        poll();
        return () => {
            mounted = false;
            window.clearInterval(timer);
        };
    }, [refresh]);
    useEffect(() => {
        const completedDrafts = drafts.filter(
            (draft) =>
                ['ready', 'failed'].includes(draft.status) &&
                !draft.notified &&
                !announcedDrafts.current.has(draft),
        );
        if (!completedDrafts.length) return;
        completedDrafts.forEach((draft) => announcedDrafts.current.add(draft));
        updateDrafts((previous) =>
            previous.map((draft) =>
                completedDrafts.some(
                    (completed) =>
                        completed.id === draft.id &&
                        completed.revision === draft.revision &&
                        completed.status === draft.status,
                )
                    ? { ...draft, notified: true }
                    : draft,
            ),
        );
        setDraftToasts((previous) => [
            ...previous,
            ...completedDrafts.map(
                (draft): Feedback =>
                    draft.status === 'ready'
                        ? {
                              variant: 'success',
                              message: 'Draf berhasil disimpan',
                          }
                        : {
                              variant: 'error',
                              message:
                                  draft.error ??
                                  'Video gagal diproses. Draf dan video asli tetap tersimpan.',
                          },
            ),
        ]);
    }, [drafts]);
    useEffect(() => {
        for (const job of jobs) {
            if (successful(job) && !dismissTimers.current.has(job.key)) {
                dismissTimers.current.set(
                    job.key,
                    window.setTimeout(() => {
                        dismissTimers.current.delete(job.key);
                        remove(job.key);
                    }, 5000),
                );
            }
        }
        for (const draft of drafts) {
            const key = `draft:${draft.id}`;
            if (
                draft.status === 'ready' &&
                draft.notified &&
                !dismissTimers.current.has(key)
            ) {
                dismissTimers.current.set(
                    key,
                    window.setTimeout(() => {
                        dismissTimers.current.delete(key);
                        removeDraft(draft.id);
                    }, 5000),
                );
            }
        }
        for (const [key, timer] of dismissTimers.current) {
            const stillComplete = key.startsWith('draft:')
                ? drafts.some(
                      (draft) =>
                          `draft:${draft.id}` === key &&
                          draft.status === 'ready' &&
                          draft.notified,
                  )
                : jobs.some((job) => job.key === key && successful(job));
            if (!stillComplete) {
                window.clearTimeout(timer);
                dismissTimers.current.delete(key);
            }
        }
    }, [jobs, drafts]);
    useEffect(
        () => () => {
            for (const timer of dismissTimers.current.values())
                window.clearTimeout(timer);
        },
        [],
    );

    if (!jobs.length && !drafts.length) {
        return draftToasts.length ? (
            <FeedbackToast
                feedback={draftToasts[0]}
                onDismiss={() =>
                    setDraftToasts((previous) => previous.slice(1))
                }
            />
        ) : null;
    }
    const chosen = jobs.find((job) => job.key === selected);
    const activeCount =
        jobs.filter(active).length +
        drafts.filter((draft) =>
            ['queued', 'processing'].includes(draft.status),
        ).length;
    return (
        <>
            <FeedbackToast
                feedback={draftToasts[0] ?? null}
                onDismiss={() =>
                    setDraftToasts((previous) => previous.slice(1))
                }
            />
            <aside
                aria-label="Aktivitas"
                hidden={selected !== null}
                className="fixed right-4 bottom-4 z-40 max-h-[min(36rem,calc(100dvh-2rem))] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border/80 bg-card p-4 shadow-2xl"
            >
                <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-foreground">Aktivitas</h2>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {activeCount} proses
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                                minimized
                                    ? 'Perluas status publikasi'
                                    : 'Minimalkan status publikasi'
                            }
                            aria-expanded={!minimized}
                            onClick={() => setMinimized(!minimized)}
                        >
                            {minimized ? (
                                <ChevronUp className="size-4" />
                            ) : (
                                <ChevronDown className="size-4" />
                            )}
                        </Button>
                    </div>
                </div>
                {!minimized && (
                    <div className="mt-3 divide-y divide-border/70 border-t border-border/70">
                        {drafts.map((draft) => (
                            <div
                                key={`draft:${draft.id}`}
                                className="flex gap-3 py-3"
                            >
                                {draft.thumbnail_url ? (
                                    <img
                                        src={draft.thumbnail_url}
                                        alt=""
                                        className="h-16 w-12 shrink-0 rounded-md object-cover"
                                    />
                                ) : (
                                    <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                        <Clapperboard className="size-5" />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1 space-y-2">
                                    <p className="line-clamp-2 text-sm font-semibold">
                                        Draf Video: {draft.title || 'Belum ada judul'}
                                    </p>
                                    <p
                                        role={
                                            draft.status === 'failed'
                                                ? 'alert'
                                                : 'status'
                                        }
                                        className="text-xs text-muted-foreground"
                                    >
                                        {draft.status === 'queued'
                                            ? 'Menunggu pemrosesan...'
                                            : draft.status === 'processing'
                                              ? 'Memproses video...'
                                              : draft.status === 'failed'
                                                ? (draft.error ??
                                                  'Video gagal diproses. Draf dan video asli tetap tersimpan.')
                                                : 'Draf berhasil disimpan'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/short-videos/create?draft=${draft.id}`}
                                            className="text-xs text-primary"
                                        >
                                            Edit Draf
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Tutup status draf ${draft.title || 'Belum ada judul'}`}
                                            onClick={() =>
                                                removeDraft(draft.id)
                                            }
                                        >
                                            <X className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {jobs.map((job) => (
                            <div key={job.key} className="flex gap-3 py-3">
                                {job.thumbnail_url ? (
                                    <img
                                        src={job.thumbnail_url}
                                        alt=""
                                        className="h-16 w-12 shrink-0 rounded-md object-cover"
                                    />
                                ) : (
                                    <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                        {job.kind === 'news' ? (
                                            <Newspaper className="size-5" />
                                        ) : (
                                            <Clapperboard className="size-5" />
                                        )}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1 space-y-2">
                                    <p className="line-clamp-2 text-sm font-semibold">
                                        {job.kind === 'news'
                                            ? 'Berita'
                                            : 'Video Pendek'}
                                        : {job.title}
                                    </p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                        {job.destinations.map((platform) => (
                                            <span
                                                key={platform}
                                                className="inline-flex items-center gap-1 text-xs"
                                            >
                                                <PlatformIcon
                                                    platform={platform}
                                                />
                                                {names[platform]}{' '}
                                                <VideoPublicationIndicator
                                                    status={status(
                                                        job,
                                                        platform,
                                                    )}
                                                />
                                            </span>
                                        ))}
                                    </div>
                                    <div
                                        role="progressbar"
                                        aria-label={`${job.title}: platform selesai`}
                                        aria-valuemin={0}
                                        aria-valuemax={job.destinations.length}
                                        aria-valuenow={completed(job)}
                                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                                    >
                                        <div
                                            className="h-full bg-primary"
                                            style={{
                                                width: `${job.destinations.length ? (completed(job) / job.destinations.length) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <span>
                                            {completed(job)} dari{' '}
                                            {job.destinations.length} selesai
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setSelected(job.key)
                                                }
                                            >
                                                Lihat Detail
                                            </Button>
                                            {(failed(job) ||
                                                successful(job)) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Tutup status ${job.title}`}
                                                    onClick={() =>
                                                        remove(job.key)
                                                    }
                                                >
                                                    <X className="size-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {error && (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                        {error}{' '}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRefresh((value) => value + 1)}
                        >
                            Perbarui Status
                        </Button>
                    </p>
                )}
            </aside>
            {chosen?.result && (
                <PublishResultDialog
                    key={chosen.key}
                    result={chosen.result}
                    videoMode={chosen.kind === 'video'}
                    video={
                        chosen.kind === 'video'
                            ? {
                                  id: Number(chosen.id),
                                  title: chosen.title,
                                  thumbnail_url: chosen.thumbnail_url,
                                  duration: chosen.duration,
                              }
                            : undefined
                    }
                    onDismiss={() => setSelected(null)}
                    statusError={error}
                    onRefreshStatus={() => setRefresh((value) => value + 1)}
                    retrying={retrying}
                    onRetry={
                        chosen.kind === 'video'
                            ? (platform) => {
                                  if (retrying) return;
                                  setRetrying(true);
                                  void metaRequest<{ result: PublishResult }>(
                                      `/admin/short-videos/${chosen.id}/retry/${platform}`,
                                      {},
                                  )
                                      .then((data) => {
                                          update((previous) =>
                                              previous.map((job) =>
                                                  job.key === chosen.key
                                                      ? {
                                                            ...job,
                                                            result: data.result,
                                                        }
                                                      : job,
                                              ),
                                          );
                                          setRefresh((value) => value + 1);
                                      })
                                      .catch(() =>
                                          setError(
                                              'Publikasi belum dapat dicoba kembali.',
                                          ),
                                      )
                                      .finally(() => setRetrying(false));
                              }
                            : undefined
                    }
                />
            )}
            {chosen && !chosen.result && (
                <div className="fixed right-4 bottom-4 z-40 rounded-lg border bg-card p-4 text-sm">
                    <p>
                        Menunggu hasil publikasi{' '}
                        {chosen.kind === 'news' ? 'berita' : 'video'}...
                    </p>
                    <Button variant="ghost" onClick={() => setSelected(null)}>
                        Tutup
                    </Button>
                    <Link
                        href={
                            chosen.kind === 'news'
                                ? '/admin/news'
                                : '/admin/short-videos'
                        }
                        className="text-primary"
                    >
                        {chosen.kind === 'news'
                            ? 'Daftar Berita'
                            : 'Daftar Video'}
                    </Link>
                </div>
            )}
        </>
    );
}

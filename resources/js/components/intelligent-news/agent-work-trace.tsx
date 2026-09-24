import {
    Check,
    ChevronDown,
    ChevronRight,
    FileSearch,
    LoaderCircle,
    Search,
    Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import type { AgentRun } from '@/components/intelligent-news/types';

type AgentWorkTraceProps = {
    elapsedSeconds: number;
    hasSources: boolean;
    hasFiles: boolean;
};

export function AgentWorkTrace({
    elapsedSeconds,
    hasSources,
    hasFiles,
}: AgentWorkTraceProps) {
    const [open, setOpen] = useState(true);
    const events = useMemo(
        () => [
            {
                at: 0,
                icon: Sparkles,
                label: 'Memahami permintaan',
                detail: 'Menentukan apakah tugas ini ekstraksi, pencarian, atau penulisan berita.',
            },
            {
                at: 2,
                icon: FileSearch,
                label: hasFiles ? 'Membaca file' : 'Memeriksa sumber',
                detail: hasFiles
                    ? 'Mengambil teks dan bukti yang dapat diverifikasi dari lampiran.'
                    : hasSources
                      ? 'Memeriksa informasi dan dokumen yang telah dipilih.'
                      : 'Memeriksa konteks yang tersedia dalam percakapan.',
            },
            {
                at: 5,
                icon: Search,
                label: 'Mencocokkan fakta',
                detail: 'Membandingkan fakta, waktu, pelaku, lokasi, dan sumber yang tersedia.',
            },
            {
                at: 9,
                icon: Sparkles,
                label: 'Menulis hasil',
                detail: 'Menyusun jawaban dan memeriksa struktur, bahasa, serta kualitas.',
            },
        ],
        [hasFiles, hasSources],
    );
    const visibleEvents = events.filter((event) => elapsedSeconds >= event.at);

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="max-w-2xl">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2 text-sm">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                <span className="font-medium">
                    Bekerja selama {elapsedSeconds} detik
                </span>
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-1 rounded-full"
                    >
                        {open ? <ChevronDown /> : <ChevronRight />}
                        <span className="sr-only">Tampilkan proses kerja</span>
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-4 pt-4">
                {visibleEvents.map((event, index) => {
                    const Icon = event.icon;
                    const complete = index < visibleEvents.length - 1;

                    return (
                        <div
                            key={event.label}
                            className="grid grid-cols-[1.25rem_1fr] gap-2 text-sm"
                        >
                            {complete ? (
                                <Check className="mt-0.5 size-4 text-primary" />
                            ) : (
                                <Icon className="mt-0.5 size-4 text-muted-foreground" />
                            )}
                            <div>
                                <p className="font-medium">{event.label}</p>
                                <p className="mt-1 leading-6 text-muted-foreground">
                                    {event.detail}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </CollapsibleContent>
        </Collapsible>
    );
}

export function SavedAgentWorkTrace({ run }: { run: AgentRun }) {
    const [open, setOpen] = useState(false);
    const started = run.started_at ? new Date(run.started_at).getTime() : 0;
    const completed = run.completed_at
        ? new Date(run.completed_at).getTime()
        : Date.now();
    const seconds = started
        ? Math.max(0, Math.round((completed - started) / 1000))
        : 0;

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="max-w-2xl">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2 text-sm text-muted-foreground">
                {run.status === 'failed' ? (
                    <span className="size-2 rounded-full bg-destructive" />
                ) : (
                    <Check className="size-4 text-primary" />
                )}
                <span>Bekerja selama {seconds} detik</span>
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                    >
                        {open ? <ChevronDown /> : <ChevronRight />}
                        <span className="sr-only">Tampilkan proses kerja</span>
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-4 pt-4">
                {run.events.map((event) => (
                    <div
                        key={event.id}
                        className="grid grid-cols-[1.25rem_1fr] gap-2 text-sm"
                    >
                        {event.event_type === 'tool' ? (
                            <FileSearch className="mt-0.5 size-4 text-muted-foreground" />
                        ) : event.event_type === 'error' ? (
                            <span className="mt-1.5 size-2 rounded-full bg-destructive" />
                        ) : (
                            <Check className="mt-0.5 size-4 text-primary" />
                        )}
                        <div>
                            <p className="font-medium">{event.label}</p>
                            <p className="mt-1 leading-6 text-muted-foreground">
                                {event.content}
                            </p>
                        </div>
                    </div>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}

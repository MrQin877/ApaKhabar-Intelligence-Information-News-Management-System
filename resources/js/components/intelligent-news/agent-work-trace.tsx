import {
    Check,
    ChevronDown,
    ChevronRight,
    FileSearch,
    LoaderCircle,
} from 'lucide-react';
import { useState } from 'react';
import type {
    AgentRun,
    AgentRunEvent,
} from '@/components/intelligent-news/types';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

type AgentWorkTraceProps = {
    elapsedSeconds: number;
    hasSources: boolean;
    hasFiles: boolean;
    events?: AgentRunEvent[];
    connectionMessage?: string;
};

export function AgentWorkTrace({
    elapsedSeconds,
    events = [],
    connectionMessage,
}: AgentWorkTraceProps) {
    const [open, setOpen] = useState(true);

    const visibleEvents = events.filter(
        (event, index) =>
            event.event_type !== 'stage_started' ||
            !events
                .slice(index + 1)
                .some(
                    (later) =>
                        ['stage_completed', 'stage_failed'].includes(
                            later.event_type,
                        ) && later.payload?.stage === event.payload?.stage,
                ),
    );

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
            <CollapsibleContent className="space-y-4 pt-4" aria-live="polite">
                {connectionMessage && (
                    <p className="text-xs text-muted-foreground">
                        {connectionMessage}
                    </p>
                )}
                {events.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Menunggu pembaruan dari layanan AI…
                    </p>
                )}
                {visibleEvents.map((event) => (
                    <div
                        key={event.id}
                        className="grid grid-cols-[1.25rem_1fr] gap-2 text-sm"
                    >
                        {event.event_type === 'stage_started' ? (
                            <LoaderCircle className="mt-0.5 size-4 animate-spin text-primary" />
                        ) : event.event_type === 'stage_failed' ? (
                            <span className="mt-1.5 size-2 rounded-full bg-destructive" />
                        ) : (
                            <Check className="mt-0.5 size-4 text-primary" />
                        )}
                        <div>
                            <p className="font-medium">
                                {event.label}
                                {event.payload?.elapsed_seconds !==
                                    undefined && (
                                    <span className="ml-2 font-normal text-muted-foreground">
                                        {event.payload.elapsed_seconds.toFixed(
                                            1,
                                        )}{' '}
                                        dtk
                                    </span>
                                )}
                            </p>
                            {event.content !== event.label && (
                                <p className="mt-1 leading-6 text-muted-foreground">
                                    {event.content}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}

export function SavedAgentWorkTrace({ run }: { run: AgentRun }) {
    const [open, setOpen] = useState(false);
    const started = run.started_at ? new Date(run.started_at).getTime() : 0;
    const completed = new Date(
        run.completed_at ?? run.started_at ?? 0,
    ).getTime();
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

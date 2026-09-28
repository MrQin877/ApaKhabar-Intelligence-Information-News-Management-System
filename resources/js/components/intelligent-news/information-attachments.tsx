import { FileText, Quote } from 'lucide-react';
import type { InformationItem } from './types';

/** Saved message attachments are snapshots; never substitute current library data. */
export function InformationAttachments({
    items,
}: {
    items: InformationItem[];
}) {
    if (!items.length) {
        return null;
    }

    return (
        <div
            className="mt-2 space-y-2 text-left"
            aria-label="Informasi yang dilampirkan"
        >
            {items.map((item) => (
                <div
                    key={item.id}
                    className="min-w-0 rounded-xl border border-border bg-background p-3 text-sm"
                >
                    <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                            <p className="font-medium break-words">
                                {item.title}
                            </p>
                            <p className="mt-0.5 text-xs break-words text-muted-foreground">
                                {item.document.original_name}
                            </p>
                        </div>
                    </div>
                    <p className="mt-2 line-clamp-2 leading-6 break-words text-muted-foreground">
                        {item.summary}
                    </p>
                    <details className="mt-2">
                        <summary className="cursor-pointer rounded text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2">
                            Lihat detail &amp; bukti sumber
                        </summary>
                        <div className="mt-3 space-y-3">
                            <p className="leading-6 break-words whitespace-pre-wrap">
                                {item.summary}
                            </p>
                            {(item.evidence ?? []).map((evidence, index) => (
                                <figure
                                    key={index}
                                    className="border-l-2 border-primary/30 pl-3"
                                >
                                    <figcaption className="mb-1 flex items-start gap-1 text-xs break-words text-muted-foreground">
                                        <Quote className="size-3 shrink-0" />
                                        {evidence.source}
                                    </figcaption>
                                    <blockquote className="leading-6 break-words whitespace-pre-wrap">
                                        {evidence.quote}
                                    </blockquote>
                                </figure>
                            ))}
                            {!item.evidence?.length && (
                                <p className="text-xs text-muted-foreground">
                                    Kutipan sumber tidak tersedia untuk
                                    informasi ini.
                                </p>
                            )}
                        </div>
                    </details>
                </div>
            ))}
        </div>
    );
}

import { Paperclip } from 'lucide-react';
import type {
    DocumentItem,
    SessionMessage,
    InformationItem,
} from '@/components/intelligent-news/types';
import { InformationAttachments } from './information-attachments';

type ChatMessageProps = {
    message: SessionMessage;
    documents?: DocumentItem[];
};

export function ChatMessage({ message, documents }: ChatMessageProps) {
    if (!message.content) {
        return null;
    }

    const attachedNames: string[] = (() => {
        if (!message.payload) {
return [];
}

        const filenames = message.payload.filenames;

        if (Array.isArray(filenames) && filenames.length > 0) {
            return filenames as string[];
        }

        const docIds = message.payload.document_ids;

        if (Array.isArray(docIds) && docIds.length > 0 && documents) {
            return docIds
                .map((id) => documents.find((d) => d.id === id)?.original_name)
                .filter(Boolean) as string[];
        }

        return [];
    })();

    if (message.role === 'user') {
        return (
            <div className="ml-auto max-w-[78%]">
                <div className="rounded-2xl rounded-tr-md border border-border bg-card px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-card-foreground shadow-sm [overflow-wrap:anywhere]">
                    {message.content}
                </div>
                <InformationAttachments
                    items={message.payload?.information_attachments ?? []}
                />
                {attachedNames.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                        {attachedNames.map((name) => (
                            <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground"
                            >
                                <Paperclip className="size-3" />
                                {name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-2xl text-sm leading-7 whitespace-pre-wrap text-foreground">
            {message.content}
        </div>
    );
}

export function PendingUserMessage({
    children,
    attachments,
    informationAttachments = [],
}: {
    children: string;
    attachments?: string[];
    informationAttachments?: InformationItem[];
}) {
    return (
        <div className="ml-auto max-w-[78%]">
            <div className="rounded-2xl rounded-tr-md border border-border bg-card px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-card-foreground shadow-sm [overflow-wrap:anywhere]">
                {children}
            </div>
            <InformationAttachments items={informationAttachments} />
            {attachments && attachments.length > 0 && (
                <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                    {attachments.map((name) => (
                        <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                            <Paperclip className="size-3" />
                            {name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

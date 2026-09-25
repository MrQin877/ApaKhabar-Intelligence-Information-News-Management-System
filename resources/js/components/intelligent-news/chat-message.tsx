import type { SessionMessage } from '@/components/intelligent-news/types';

type ChatMessageProps = {
    message: Pick<SessionMessage, 'role' | 'content'>;
};

export function ChatMessage({ message }: ChatMessageProps) {
    if (!message.content) {
        return null;
    }

    if (message.role === 'user') {
        return (
            <div className="ml-auto max-w-[78%] rounded-3xl bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                {message.content}
            </div>
        );
    }

    return (
        <div className="max-w-2xl text-sm leading-7 whitespace-pre-wrap text-foreground">
            {message.content}
        </div>
    );
}

export function PendingUserMessage({ children }: { children: string }) {
    return (
        <div className="ml-auto max-w-[78%] rounded-3xl bg-muted px-4 py-3 text-sm leading-6 text-foreground">
            {children}
        </div>
    );
}

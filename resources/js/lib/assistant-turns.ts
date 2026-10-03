type TurnMessage = {
    id: number;
    intent?: string | null;
    payload?: Record<string, unknown> | null;
};

export function assistantTurnAnchors(messages: TurnMessage[]) {
    const latest = [...messages].reverse();

    return {
        draftMessageId: latest.find((message) =>
            Boolean(message.payload?.article),
        )?.id,
        extractionMessageId: latest.find(
            (message) => message.intent === 'document_processing',
        )?.id,
    };
}

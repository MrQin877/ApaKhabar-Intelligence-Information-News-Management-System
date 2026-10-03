type Source = {
    id: number;
    document_id?: number;
    document: string;
    title: string;
    evidence: Array<{ source: string; quote: string }>;
};

export function groupDocumentSources(sources: Source[]) {
    const groups = new Map<
        string,
        { key: string; document: string; information: Source[] }
    >();

    for (const source of sources) {
        // A filename is not an identity: different uploads can share a name.
        const key =
            source.document_id == null
                ? `information:${source.id}`
                : `document:${source.document_id}`;
        const group = groups.get(key) ?? {
            key,
            document: source.document,
            information: [],
        };

        if (!group.information.some((item) => item.id === source.id)) {
            group.information.push(source);
        }

        groups.set(key, group);
    }

    return [...groups.values()];
}

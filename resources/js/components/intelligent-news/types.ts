export interface InformationItem {
    id: number;
    document_id: number;
    title: string;
    summary: string;
    labels: string[];
    document: { id: number; original_name: string };
}

export interface DocumentItem {
    id: number;
    original_name: string;
    status: string;
}

export interface MissingQuestion {
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

export interface UserFact {
    field: string;
    value: string;
}

export interface SessionMessage {
    id: number;
    role: 'user' | 'assistant' | 'tool' | 'system';
    intent: string | null;
    content: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
}

export interface NewsSession {
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

export interface Evidence {
    source: string;
    quote: string;
}

export type QualityDimension =
    | number
    | {
          score: number;
          explanation?: string;
          issues?: string[];
      };

export interface ArticleQuality {
    overall_score: number;
    quality_label: string;
    publish_blocked: boolean;
    dimensions: Record<string, QualityDimension>;
    warnings: string[];
}

export interface Article {
    draft_id: number;
    headline: string;
    subheadline: string | null;
    lead: string;
    body: string[];
    labels: string[];
    category: string | null;
    warnings: string[];
    image: string | null;
    version: number;
    reviewed_at: string | null;
    updated_at: string | null;
    quality?: ArticleQuality | null;
    selected_sources: Array<{
        id: number;
        title: string;
        document: string;
        evidence: Evidence[];
    }>;
}

export interface Recommendation {
    information_id: number;
    document_id: number;
    name: string;
    source: string;
    excerpt: string;
    distance: number | null;
}

export interface AssistantPageProps {
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

import { ChevronDown } from 'lucide-react';
import type {
    ArticleQuality,
    QualityDimension,
} from '@/components/intelligent-news/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

const labels: Record<string, string> = {
    accuracy: 'Akurasi',
    completeness: 'Kelengkapan',
    relevance: 'Relevansi',
    readability: 'Keterbacaan',
    structure: 'Struktur',
    language: 'Bahasa',
    safety: 'Keamanan',
};

function scoreOf(dimension: QualityDimension) {
    return typeof dimension === 'number' ? dimension : dimension.score;
}

export function QualityScoreBadge({
    quality,
}: {
    quality?: ArticleQuality | null;
}) {
    if (!quality) {
        return <Badge variant="outline">Skor AI belum tersedia</Badge>;
    }

    if (quality.quality_label === 'evaluation_unavailable') {
        return <Badge variant="destructive">Evaluasi belum tersedia</Badge>;
    }
    return (
        <Badge variant={quality.publish_blocked ? 'destructive' : 'outline'}>
            {quality.evaluation_version === 'separate-judge-v1'
                ? 'Skor evaluator'
                : 'Skor evaluasi mandiri'}{' '}
            {quality.overall_score.toFixed(1)}/100
        </Badge>
    );
}

export function QualityScoreBreakdown({
    quality,
}: {
    quality: ArticleQuality;
}) {
    return (
        <Collapsible className="rounded-lg border bg-background/60 p-3">
            <CollapsibleTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                >
                    Lihat rincian kualitas
                    <ChevronDown />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                <p className="text-xs text-muted-foreground sm:col-span-2">
                    Penilai: {quality.evaluator_model ?? 'Tidak tercatat'}. Skor
                    merupakan penilaian otomatis, bukan persentase akurasi
                    terukur.
                </p>
                {quality.warnings?.map((warning, index) => (
                    <p
                        key={index}
                        className="text-xs text-destructive sm:col-span-2"
                    >
                        {warning}
                    </p>
                ))}
                {quality.quality_label !== 'evaluation_unavailable' &&
                    Object.entries(quality.dimensions).map(
                        ([key, dimension]) => {
                            const score = scoreOf(dimension);

                            return (
                                <div key={key} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span>{labels[key] ?? key}</span>
                                        <span className="font-medium">
                                            {score.toFixed(0)}/100
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${Math.max(0, Math.min(100, score))}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        },
                    )}
            </CollapsibleContent>
        </Collapsible>
    );
}

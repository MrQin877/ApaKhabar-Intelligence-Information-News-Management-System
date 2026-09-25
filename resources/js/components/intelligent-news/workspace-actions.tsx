import { Archive, History, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

type WorkspaceActionsProps = {
    canOpenPreview: boolean;
    onOpenPreview: () => void;
    onOpenHistory: () => void;
    onOpenDocuments: () => void;
};

export function WorkspaceActions({
    canOpenPreview,
    onOpenPreview,
    onOpenHistory,
    onOpenDocuments,
}: WorkspaceActionsProps) {
    return (
        <div className="absolute top-[4.75rem] right-4 z-30 flex items-center gap-1 rounded-xl border border-border/40 bg-background/70 p-1 backdrop-blur-xl">
            {canOpenPreview && (
                <Button variant="ghost" size="sm" onClick={onOpenPreview}>
                    <PanelRightOpen /> Pratinjau
                </Button>
            )}
            <Button
                variant="ghost"
                size="sm"
                onClick={onOpenHistory}
                title="Riwayat percakapan dan draf"
            >
                <History /> Riwayat
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpenDocuments}>
                <Archive /> Dokumen
            </Button>
        </div>
    );
}

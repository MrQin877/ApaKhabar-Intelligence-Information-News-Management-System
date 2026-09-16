import { Languages } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { WebsiteLanguage } from '@/lib/translation/dictionary';
import { translateWebsite } from '@/lib/translation/website-translator';

export function WebsiteLanguage() {
    const [language, setLanguage] = useState<WebsiteLanguage>(() => {
        try {
            return typeof window !== 'undefined' &&
                localStorage.getItem('apakhabar-language') === 'en'
                ? 'en'
                : 'id';
        } catch {
            return 'id';
        }
    });
    const [state, setState] = useState<'working' | 'ready' | 'error'>('ready');
    const [attempt, setAttempt] = useState(0);
    const [enabled, setEnabled] = useState(true);
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const originalLanguage = document.documentElement.lang;
        document.documentElement.lang = language;

        try {
            localStorage.setItem('apakhabar-language', language);
        } catch {
            /* The current page still works. */
        }

        const stop = translateWebsite(language, setState);

        return () => {
            stop();
            document.documentElement.lang = originalLanguage;
        };
    }, [language, attempt, enabled]);

    return (
        <div
            translate="no"
            data-no-translate
            className="fixed right-4 bottom-4 z-[60] max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-2 shadow-md"
        >
            <div className="flex items-center gap-2">
                <Languages className="size-4 text-muted-foreground" />
                <Select
                    value={language ?? 'id'}
                    onValueChange={(value) => {
                        setLanguage(value as WebsiteLanguage);
                        setEnabled(true);
                    }}
                >
                    <SelectTrigger
                        aria-label="Website language / Bahasa situs"
                        className="h-8 w-36"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent translate="no" data-no-translate>
                        <SelectItem value="id">Indonesia</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                    {enabled
                        ? language === 'en'
                            ? 'Machine translated'
                            : 'Terjemahan otomatis'
                        : language === 'en'
                          ? 'Original text'
                          : 'Teks asli'}
                </span>
                <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px]"
                    onClick={() => setEnabled((value) => !value)}
                >
                    {enabled
                        ? language === 'en'
                            ? 'Show original'
                            : 'Lihat asli'
                        : language === 'en'
                          ? 'Translate'
                          : 'Terjemahkan'}
                </Button>
            </div>
            {enabled && state === 'working' && (
                <p role="status" className="mt-1 text-xs text-muted-foreground">
                    {language === 'en' ? 'Translating…' : 'Menerjemahkan…'}
                </p>
            )}
            {enabled && state === 'error' && (
                <div className="mt-1 max-w-60 text-xs" role="status">
                    <p>
                        {language === 'en'
                            ? 'Some text could not be translated.'
                            : 'Sebagian teks belum dapat diterjemahkan.'}
                    </p>
                    <Button
                        variant="link"
                        size="sm"
                        className="h-7 p-0"
                        onClick={() => setAttempt((value) => value + 1)}
                    >
                        {language === 'en' ? 'Retry' : 'Coba lagi'}
                    </Button>
                </div>
            )}
        </div>
    );
}

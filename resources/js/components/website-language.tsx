import { Globe } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { WebsiteLanguage } from '@/lib/translation/dictionary';
import { translateWebsite } from '@/lib/translation/website-translator';

type TranslationState = 'working' | 'ready' | 'error';
const LanguageContext = createContext<{
    language: WebsiteLanguage;
    toggle: () => void;
    state: TranslationState;
} | null>(null);

export function WebsiteLanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<WebsiteLanguage>(() => {
        try {
            const saved =
                typeof window !== 'undefined'
                    ? localStorage.getItem('apakhabar-language')
                    : null;
            return saved === 'en' ? 'en' : 'id';
        } catch {
            return 'id';
        }
    });
    const [state, setState] = useState<TranslationState>('ready');
    useEffect(() => {
        const originalLanguage = document.documentElement.lang;
        document.documentElement.lang = language;

        try {
            localStorage.setItem('apakhabar-language', language);
        } catch {
            /* The current page still works when storage is unavailable. */
        }

        const stop = translateWebsite(language, setState);

        return () => {
            stop();
            document.documentElement.lang = originalLanguage;
        };
    }, [language]);

    return (
        <LanguageContext.Provider
            value={{
                language,
                state,
                toggle: () =>
                    setLanguage((value) => (value === 'id' ? 'en' : 'id')),
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
}

export function WebsiteLanguage() {
    const context = useContext(LanguageContext);

    if (!context) {
        return null;
    }

    const { language, toggle, state } = context;
    const label =
        language === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia';
    const status =
        state === 'working'
            ? language === 'en'
                ? 'Translating...'
                : 'Menerjemahkan...'
            : '';

    return (
        <span translate="no" data-no-translate className="inline-flex shrink-0">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggle}
                aria-label={label}
                title={
                    status ||
                    `${label} · ${language === 'en' ? 'Automatic translation' : 'Terjemahan otomatis'}`
                }
                className="h-9 min-w-11 px-3 text-xs font-semibold tracking-wide"
            >
                <Globe />
                {language.toUpperCase()}
            </Button>
            <span role="status" className="sr-only">
                {status}
            </span>
        </span>
    );
}

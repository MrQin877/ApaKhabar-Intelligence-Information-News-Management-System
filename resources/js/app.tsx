import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ManualDraftToast } from '@/components/manual-draft-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WebsiteLanguageProvider } from '@/components/website-language';
import '../css/app.css';
import { initializeTheme } from '@/hooks/use-appearance';
import { installNavigationGuard } from '@/lib/navigation-guard';

import { installVillagerActivity } from '@/lib/villager-activity';

installVillagerActivity();
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
installNavigationGuard(window);

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <StrictMode>
                <TooltipProvider delayDuration={0}>
                    <WebsiteLanguageProvider>
                        <App {...props} />
                        <ManualDraftToast />
                    </WebsiteLanguageProvider>
                </TooltipProvider>
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();

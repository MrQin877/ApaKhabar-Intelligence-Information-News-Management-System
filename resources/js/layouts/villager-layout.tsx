// resources/js/layouts/villager-layout.tsx
import ProfileCompletionBanner from '@/components/profile-completion-banner';
import AppLayoutTemplate from '@/layouts/app/app-header-layout';
import type { AppLayoutProps } from '@/types';

export default function VillagerLayout({
    children,
    breadcrumbs,
    ...props
}: AppLayoutProps) {
    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            <ProfileCompletionBanner />
            {children}
        </AppLayoutTemplate>
    );
}

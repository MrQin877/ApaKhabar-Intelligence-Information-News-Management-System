// resources/js/layouts/app-layout.tsx — for admin layout
import { PublishResultDialog } from '@/components/publish-result-dialog';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { AppLayoutProps } from '@/types';

export default ({ children, breadcrumbs, ...props }: AppLayoutProps) => (
    <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
        {children}
        <PublishResultDialog />
    </AppLayoutTemplate>
);

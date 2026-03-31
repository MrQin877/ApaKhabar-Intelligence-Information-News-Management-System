import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { SettingsWrapper } from '@/layouts/settings/setting-wrapper';
import { edit as editAppearance } from '@/routes/appearance';
import type { BreadcrumbItem } from '@/types';
 
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Ketentuan Penampilan',
        href: editAppearance(),
    },
];
 
export default function Appearance() {
    return (
        <SettingsWrapper title="Ketentuan Penampilan" breadcrumbs={breadcrumbs}>
            <Head title="Ketentuan Penampilan" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Ketentuan Penampilan"
                    description="Atur ketentuan tampilan akun anda"
                />
                <AppearanceTabs />
            </div>
        </SettingsWrapper>
    );
}
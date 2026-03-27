import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { edit as editAppearance } from '@/routes/appearance';
import type { BreadcrumbItem } from '@/types';
import { SettingsWrapper } from '@/layouts/settings/setting-wrapper';
 
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Tetapan Penampilan',
        href: editAppearance(),
    },
];
 
export default function Appearance() {
    return (
        <SettingsWrapper title="Tetapan Penampilan" breadcrumbs={breadcrumbs}>
            <Head title="Tetapan Penampilan" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Tetapan Penampilan"
                    description="Kemaskini tetapan penampilan akaun anda"
                />
                <AppearanceTabs />
            </div>
        </SettingsWrapper>
    );
}
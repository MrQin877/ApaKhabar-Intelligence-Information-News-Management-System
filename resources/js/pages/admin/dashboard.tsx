import { Head, Link, usePage } from '@inertiajs/react';
import type { ReportWidget } from '@/components/analytics/report-widgets';
import SectionDashboard from '@/components/analytics/section-dashboard';
import AppLayout from '@/layouts/app-layout';
import type { SectionLayout } from '@/lib/analytics-sections';
import type { SharedData } from '@/types';
export default function Dashboard({
    widgets,
    period,
    layout,
}: {
    widgets: ReportWidget[];
    layout: SectionLayout;
    period: { from: string; to: string };
}) {
    const { auth } = usePage<SharedData>().props;

    return (
        <div className="space-y-6 p-4 md:p-6">
            <Head title="Dasbor" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Dasbor</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {period.from} — {period.to} ·{' '}
                        {auth.user?.role === 'admin'
                            ? 'Ringkasan analisis'
                            : 'Ringkasan yang dibagikan admin'}
                    </p>
                </div>
                {auth.user?.role === 'admin' && (
                    <Link
                        href="/admin/analytics"
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                        Buka Analisis & pengaturan
                    </Link>
                )}
            </div>
            {widgets.length ? (
                <SectionDashboard widgets={widgets} layout={layout} />
            ) : (
                <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                    Admin belum membagikan ringkasan analisis. Gunakan menu
                    untuk mengelola berita dan siaran.
                </div>
            )}
        </div>
    );
}
Dashboard.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={[{ title: 'Dasbor', href: '/admin/dashboard' }]}>
        {page}
    </AppLayout>
);

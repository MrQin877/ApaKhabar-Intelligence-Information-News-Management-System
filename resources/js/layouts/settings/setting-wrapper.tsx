// resources/js/layouts/settings/settings-wrapper.tsx
import { Link, router, usePage } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '@/layouts/app-layout'
import SettingsLayout from '@/layouts/settings/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { edit as editProfile } from '@/routes/profile'
import { edit as editSecurity } from '@/routes/security'
import { edit as editAppearance } from '@/routes/appearance'
import type { BreadcrumbItem } from '@/types'

type Props = {
    children: React.ReactNode
    breadcrumbs?: BreadcrumbItem[]
    title: string
}

const villagerTabs = [
    { label: 'Profil',      href: editProfile() },
    { label: 'Keselamatan', href: editSecurity() },
    { label: 'Penampilan',  href: editAppearance() },
]

function VillagerSettingsTabs() {
    const { url } = usePage()
    return (
        <div className="flex gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
            {villagerTabs.map(tab => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors",
                        url.startsWith(tab.href)
                            ? "bg-green-600 text-white"
                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                >
                    {tab.label}
                </Link>
            ))}
        </div>
    )
}

export function SettingsWrapper({ children, breadcrumbs = [], title }: Props) {
    const { auth } = usePage().props as any
    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'moderator'

    if (isAdmin) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <SettingsLayout>
                    {children}
                </SettingsLayout>
            </AppLayout>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
            <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 sticky top-0 z-10">
                <div className="mx-auto flex max-w-2xl items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.visit('/')}
                        className="gap-1.5 text-sm text-neutral-600 dark:text-neutral-400"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Button>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {title}
                    </span>
                </div>
            </div>
            <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
                <VillagerSettingsTabs />
                {children}
            </div>
        </div>
    )
}
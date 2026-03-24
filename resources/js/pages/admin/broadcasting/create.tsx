import { Head } from '@inertiajs/react'
import { BroadcastComposeForm } from '@/components/broadcast-compose-form'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Penyiaran', href: '/admin/broadcasting' },
    { title: 'Siaran Baru', href: '/admin/broadcasting/create' },
]

export default function BroadcastCreatePage() {
    return (
        <>
            <Head title="Siaran Baru" />
            <div className="flex flex-1 flex-col gap-4 p-4 min-w-0">
                <BroadcastComposeForm />
            </div>
        </>
    )
}

BroadcastCreatePage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
)
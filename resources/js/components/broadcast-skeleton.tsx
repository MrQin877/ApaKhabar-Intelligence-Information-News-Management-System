import { Skeleton } from '@/components/ui/skeleton'

export function BroadcastSkeleton() {
    return (
        <div className="space-y-3">
            {/* Table header skeleton */}
            <div className="flex items-center gap-4 pb-2">
                <Skeleton className="h-8 w-24 rounded" />
                <Skeleton className="h-8 w-32 rounded" />
                <Skeleton className="h-8 w-20 rounded ml-auto" />
            </div>

            {/* Table rows skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 px-2 py-3 rounded-lg border border-neutral-100 dark:border-neutral-800"
                >
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-7 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded hidden sm:block" />
                    </div>
                    <Skeleton className="h-4 flex-1 max-w-[200px] rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded font-mono" />
                    <Skeleton className="h-8 w-8 rounded" />
                </div>
            ))}
        </div>
    )
}
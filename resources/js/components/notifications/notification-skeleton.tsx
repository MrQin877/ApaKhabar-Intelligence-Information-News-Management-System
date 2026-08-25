import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
 
export function NotificationSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="border border-border bg-card">
                    <CardContent className="p-4">
                        <div className="flex gap-3">
                            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-4 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-3/4" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
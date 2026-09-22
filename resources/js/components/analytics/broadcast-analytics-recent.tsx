import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type RecentItem = {
    id: string
    title: string
    category: string
    audience: string
    sent_at: string
    sent: number
    read: number
    rate: number
}

export function AnalyticsRecent({ recent }: { recent: RecentItem[] }) {
    return (
        <Card className="h-full w-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Pesan Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {recent.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Belum ada pesan dikirim.</p>
                ) : (
                    recent.map(item => (
                        <div key={item.id} className="flex flex-col items-start ">
                            <div className="flex flex-row items-center gap-2">
                                <Badge
                                    variant={item.category === 'darurat' ? 'destructive' : 'outline'}
                                    className="shrink-0 text-xs"
                                >
                                    {item.category.toUpperCase()}
                                </Badge>

                                <p className="text-sm font-medium">{item.title}</p>
                            </div>
                            <p className="text-xs text-muted-foreground pt-1">
                                Dikirim {item.sent_at} ke {item.audience} ·{' '}
                                <span className="text-brand-500">
                                    {item.read} dibuka {item.rate}%
                                </span>
                            </p>
                            
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
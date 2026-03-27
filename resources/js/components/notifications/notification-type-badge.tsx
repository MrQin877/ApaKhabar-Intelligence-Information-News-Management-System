import { Siren, Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NotifType } from '@/types/notification'
 
interface NotificationTypeBadgeProps {
    type: NotifType
    showIcon?: boolean
    size?: 'sm' | 'md'
}
 
export function NotificationTypeBadge({
    type,
    showIcon = true,
    size = 'sm',
}: NotificationTypeBadgeProps) {
    const isDarurat = type === 'darurat'
    return (
        <Badge
            variant="outline"
            className={cn(
                "font-medium gap-1 shrink-0",
                size === 'sm' ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5",
                isDarurat
                    ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                    : "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
            )}
        >
            {showIcon && (
                isDarurat
                    ? <Siren className={size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3"} />
                    : <Megaphone className={size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3"} />
            )}
            {isDarurat ? 'Darurat' : 'Pengumuman'}
        </Badge>
    )
}
import { Siren, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NotifType } from '@/types/notification'
 
interface NotificationIconProps {
    type: NotifType
    size?: 'sm' | 'md' | 'lg'
}
 
export function NotificationIcon({ type, size = 'md' }: NotificationIconProps) {
    const isDarurat = type === 'darurat'
    const sizeMap = {
        sm: { wrapper: "h-7 w-7 rounded-lg",   icon: "h-3.5 w-3.5" },
        md: { wrapper: "h-9 w-9 rounded-xl",   icon: "h-4 w-4"     },
        lg: { wrapper: "h-11 w-11 rounded-xl", icon: "h-5 w-5"     },
    }
    const { wrapper, icon } = sizeMap[size]
 
    return (
        <div className={cn(
            "shrink-0 flex items-center justify-center",
            wrapper,
            isDarurat
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-green-100 dark:bg-green-900/30"
        )}>
            {isDarurat
                ? <Siren className={cn(icon, "text-red-500")} />
                : <Megaphone className={cn(icon, "text-green-600")} />
            }
        </div>
    )
}
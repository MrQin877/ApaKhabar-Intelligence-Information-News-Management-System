import * as React from 'react';
import { cn } from '@/lib/utils';

function Progress({
    className,
    value,
    ...props
}: React.ComponentProps<'div'> & { value?: number }) {
    const indeterminate = value == null;
    const progress = Math.max(0, Math.min(100, value ?? 35));

    return (
        <div
            data-slot="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : progress}
            className={cn(
                'relative h-2 w-full overflow-hidden rounded-full bg-primary/15',
                className,
            )}
            {...props}
        >
            <div
                className={cn(
                    'h-full rounded-full bg-primary transition-[width,transform] duration-300',
                    indeterminate && 'w-1/3 animate-pulse',
                )}
                style={
                    indeterminate
                        ? { transform: 'translateX(100%)' }
                        : { width: `${progress}%` }
                }
            />
        </div>
    );
}

export { Progress };

import type { PublishPlatform } from '@/components/publish-news-dialog';
import { Button } from '@/components/ui/button';
import type { MetaAuthConfig } from '@/lib/meta-auth';

type Props = {
    config: MetaAuthConfig;
    disabled?: boolean;
    onConnected: (platforms: PublishPlatform[]) => void;
};

export function FacebookLoginControl({ disabled }: Props) {
    return (
        <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() =>
                window.open(
                    '/settings/integration',
                    '_blank',
                    'noopener,noreferrer',
                )
            }
        >
            Kelola koneksi Facebook
        </Button>
    );
}

export function InstagramLoginControl({ disabled }: Props) {
    return (
        <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() =>
                window.open(
                    '/settings/integration',
                    '_blank',
                    'noopener,noreferrer',
                )
            }
        >
            Kelola koneksi Instagram
        </Button>
    );
}

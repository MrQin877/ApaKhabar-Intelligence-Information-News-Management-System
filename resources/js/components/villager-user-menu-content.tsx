import { Link } from '@inertiajs/react';
import { UserCircle, Shield, Palette } from 'lucide-react';
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { edit as editAppearance } from '@/routes/appearance';
import type { User } from '@/types';

type Props = {
    user: User;
};

export function VillagerUserMenuContent({ user }: Props) {
    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link href={editProfile()} className="block w-full cursor-pointer">
                        <UserCircle className="mr-2 h-4 w-4" />
                        Profil
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={editSecurity()} className="block w-full cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        Keselamatan
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={editAppearance()} className="block w-full cursor-pointer">
                        <Palette className="mr-2 h-4 w-4" />
                        Penampilan
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
        </>
    );
}
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { User } from 'next-auth';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import type { PartnerBrand } from '@/lib/partners/types';

import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({
  user,
  brand,
}: {
  user: User | undefined;
  brand: PartnerBrand;
}) {
  const router = useRouter();
  const { setOpenMobile, setOpen } = useSidebar();
  const brandName = brand?.displayName ?? 'AeroChat';

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <div className="flex items-center gap-2 px-2 hover:bg-muted rounded-md cursor-pointer">
                {brand?.logoPath && (
                  <img
                    src={brand.logoPath}
                    alt={`${brandName} logo`}
                    className="h-6 w-auto"
                  />
                )}
                <span className="text-lg font-semibold">{brandName}</span>
              </div>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    setOpen(false);
                    // Only end exam if user explicitly wants to start a new chat
                    // Don't automatically end exam on navigation
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}

'use client';

import { useState } from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { ChevronUp } from 'lucide-react';
import type { User } from 'next-auth';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

import { clearAllChats } from '@/app/(chat)/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { guestRegex } from '@/lib/constants';

import { LoaderIcon } from './icons';
import { toast } from './toast';

export function SidebarUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const [showClearDialog, setShowClearDialog] = useState(false);

  const isGuest = guestRegex.test(data?.user?.email ?? '');

  const handleClearAllChats = async () => {
    try {
      await clearAllChats();
      toast({
        type: 'success',
        description: 'All chats have been cleared successfully!',
      });

      // Redirect to home page after clearing
      router.push('/');
    } catch (_error) {
      toast({
        type: 'error',
        description: 'Failed to clear all chats. Please try again.',
      });
    } finally {
      setShowClearDialog(false);
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {status === 'loading' ? (
                <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10 justify-between">
                  <div className="flex flex-row gap-2">
                    <div className="size-6 bg-zinc-500/30 rounded-full animate-pulse" />
                    <span className="bg-zinc-500/30 text-transparent rounded-md animate-pulse">
                      Loading auth status
                    </span>
                  </div>
                  <div className="animate-spin text-zinc-500">
                    <LoaderIcon />
                  </div>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  data-testid="user-nav-button"
                  className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10"
                >
                  <Image
                    src={`https://avatar.vercel.sh/${user.email}`}
                    alt={user.email ?? 'User Avatar'}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <span data-testid="user-email" className="truncate">
                    {isGuest ? 'Guest' : user?.email}
                  </span>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-testid="user-nav-menu"
              side="top"
              className="w-[--radix-popper-anchor-width]"
            >
              <DropdownMenuItem
                data-testid="user-nav-item-theme"
                className="cursor-pointer"
                onSelect={() =>
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                }
              >
                {`Toggle ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
              </DropdownMenuItem>
              {!isGuest && (
                <DropdownMenuItem
                  data-testid="user-nav-item-clear-chats"
                  className="cursor-pointer text-red-500"
                  onSelect={() => setShowClearDialog(true)}
                >
                  Clear all chats
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                <button
                  type="button"
                  className="w-full cursor-pointer"
                  onClick={() => {
                    if (status === 'loading') {
                      toast({
                        type: 'error',
                        description:
                          'Checking authentication status, please try again!',
                      });

                      return;
                    }

                    if (isGuest) {
                      router.push('/login');
                    } else {
                      signOut({
                        redirectTo: '/',
                      });
                    }
                  }}
                >
                  {isGuest ? 'Login to your account' : 'Sign out'}
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chat history and remove all your conversations from our
              servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllChats}>
              Clear all chats
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

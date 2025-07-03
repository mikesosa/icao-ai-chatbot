import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { TeaExamInterface } from '@/components/tea-exam-interface';
import { generateUUID } from '@/lib/utils';

export default async function TeaPage() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  return (
    <TeaExamInterface chatId={id} initialMessages={[]} session={session} />
  );
}

import { cookies } from 'next/headers';

import { TeaExamInterface } from '@/components/tea-exam-interface';
import { generateUUID } from '@/lib/utils';
import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';

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

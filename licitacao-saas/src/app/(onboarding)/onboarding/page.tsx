import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  noStore();

  const session = await auth();
  if (!session?.user) {
    redirect('/login?next=/onboarding');
  }

  return <OnboardingClient />;
}

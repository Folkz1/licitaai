import { unstable_noStore as noStore } from 'next/cache';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  noStore();

  return <OnboardingClient />;
}

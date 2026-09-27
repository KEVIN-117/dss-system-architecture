import { LandingAuthProvider } from '@/components/auth/LandingAuthProvider';
import { TrafficRouter } from '@/components/auth/TrafficRouter';

export default function AuthCallbackPage() {
  return (
    <LandingAuthProvider>
      <TrafficRouter />
    </LandingAuthProvider>
  );
}

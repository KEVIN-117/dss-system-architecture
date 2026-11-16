'use client';

import { LandingLoginRedirect } from '@dss-monorepo/auth';

/**
 * Sign-in lives in the landing. This route stays so the BFF's failed-callback
 * redirect (`/login?error=…`) and old links still reach the shared login.
 */
export default function LoginPage() {
  return (
    <LandingLoginRedirect
      landingUrl={process.env.NEXT_PUBLIC_LANDING_URL}
      source="login-route"
    />
  );
}

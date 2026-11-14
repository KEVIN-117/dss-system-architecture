"use client";

import { MotionConfig } from "motion/react";

/** Respeta la preferencia "reducir movimiento" del sistema en toda la landing. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

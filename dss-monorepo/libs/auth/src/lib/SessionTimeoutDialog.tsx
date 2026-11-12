'use client';

import { useEffect, useRef } from 'react';

export interface SessionTimeoutDialogProps {
  secondsLeft: number;
  reason: 'idle' | 'absolute';
  onContinue: () => void;
  onLogout: () => void;
}

/**
 * Minimal, dependency-free warning shown before the BFF session ends. Portals
 * can replace it through `AuthProvider`'s `renderSessionWarning` prop.
 */
export function SessionTimeoutDialog({
  secondsLeft,
  reason,
  onContinue,
  onLogout,
}: SessionTimeoutDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const isAbsolute = reason === 'absolute';

  return (
    <div style={styles.backdrop}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dss-session-timeout-title"
        aria-describedby="dss-session-timeout-description"
        style={styles.dialog}
      >
        <h2 id="dss-session-timeout-title" style={styles.title}>
          {isAbsolute ? 'Tu sesión está por finalizar' : '¿Sigues ahí?'}
        </h2>
        <p id="dss-session-timeout-description" style={styles.text}>
          {isAbsolute
            ? 'Alcanzaste la duración máxima de la sesión. Guarda tu trabajo; deberás iniciar sesión nuevamente en '
            : 'Por inactividad, tu sesión se cerrará en '}
          <strong aria-live="polite">
            {minutes}:{seconds}
          </strong>
          .
        </p>
        <div style={styles.actions}>
          <button
            type="button"
            ref={isAbsolute ? primaryRef : undefined}
            onClick={onLogout}
            style={styles.secondary}
          >
            Cerrar sesión
          </button>
          {!isAbsolute && (
            <button type="button" ref={primaryRef} onClick={onContinue} style={styles.primary}>
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(15, 23, 42, 0.55)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    padding: 24,
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
    fontFamily: 'inherit',
  },
  title: { margin: '0 0 8px', fontSize: 18, fontWeight: 600 },
  text: { margin: '0 0 20px', fontSize: 14, lineHeight: 1.5 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  primary: {
    border: 0,
    borderRadius: 8,
    padding: '8px 16px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondary: {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '8px 16px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
} as const;

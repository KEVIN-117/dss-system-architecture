'use client';

import { useEffect, useState } from 'react';
import { AuthLanding } from '@dss-monorepo/design-system';
import { useAuth } from '@dss-monorepo/auth';

import { motion, type Variants } from 'motion/react';
import Image from 'next/image';

import { LandingAuthProvider } from '@/components/auth/LandingAuthProvider';

export default function LoginPage() {
  return (
    <LandingAuthProvider>
      <LoginContent />
    </LandingAuthProvider>
  );
}

function LoginContent() {
  const { isAuthenticated, isLoading, error, login, register } = useAuth();
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace('/auth/callback');
    }
  }, [isAuthenticated, isLoading]);

  const callbackUrl = () =>
    new URL('/auth/callback', window.location.origin).toString();

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'tween', stiffness: 300, damping: 24 },
    },
  };

  return (
    <main className="flex min-h-screen bg-dss-navy-950 items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-dss-blue-500/20 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-dss-red-500/20 rounded-full blur-[120px] mix-blend-screen"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[90vw] h-[90vh] bg-foreground/5 backdrop-blur-3xl rounded-[2.5rem] flex overflow-hidden shadow-[0_0_80px_color-mix(in_srgb,var(--dss-navy-950)_80%,transparent)] border border-border/40 z-10"
      >
        <div
          className="hidden lg:block absolute inset-y-0 left-0 w-[50%] z-10 m-5 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}
        >
          <motion.div
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 10, ease: 'easeOut' }}
            className="absolute inset-0 bg-dss-navy-950"
          >
            <Image
              src="/images/login_bg.jpg"
              alt="Abstract Sci-Fi Data Landscape"
              width={1000}
              height={600}
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-linear-to-br from-dss-blue-500/40 via-dss-navy-950/70 to-dss-red-500/40 mix-blend-multiply" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-dss-navy-950" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="absolute bottom-10 left-10 z-20 flex items-center justify-between right-32"
          >
            <div className="flex items-center gap-5 glass-panel p-4 rounded-2xl bg-dss-navy-950/40 backdrop-blur-md border border-border/40">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-foreground/10 flex items-center justify-center p-1.5 border border-border/60">
                <Image
                  src="/images/dsa.png"
                  alt="Escudo UATF"
                  width={50}
                  height={50}
                  className="object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                />
              </div>
              <div>
                <p className="text-foreground font-bold tracking-tight text-lg">
                  UATF DSA
                </p>
                <p className="text-muted-foreground text-sm font-medium">
                  Dirección de Servicios Académicos
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="absolute inset-y-0 right-0 w-full lg:w-[60%] z-0 flex flex-col justify-center px-8 md:px-16 lg:pl-[12%] lg:pr-24">
          <div className="w-full max-w-sm mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="mb-10 text-center"
            >
              <h1 className="text-4xl md:text-[2.75rem] font-extrabold text-transparent bg-clip-text bg-linear-to-r from-foreground to-muted-foreground tracking-tight mb-3 drop-shadow-sm">
                Portal de Servicios Académicos
              </h1>
              <p className="text-muted-foreground text-sm font-medium tracking-wide">
                Inicie sesión para comenzar a utilizar el DSS
              </p>
            </motion.div>
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.4, duration: 0.8 }}
              className="space-y-5"
            >
              <AuthLanding
                title="Dirección de Servicios Académicos"
                description="Inicia sesión con tu cuenta institucional para entrar al portal que corresponde a tu rol."
                onLogin={() => {
                  setIsStarting(true);
                  login(callbackUrl());
                }}
                onRegister={() => {
                  setIsStarting(true);
                  register(callbackUrl());
                }}
                isLoading={isLoading || isStarting}
                error={error}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

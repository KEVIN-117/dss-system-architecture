"use client";
import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center w-full z-30 pt-48",
        className
      )}
    >
      <div className="absolute top-80 flex w-full flex-1 items-center justify-center isolate z-0 pointer-events-none transition-transform duration-1000 ease-out" style={{ transform: isHovered ? 'scale(1.05) translateY(-10px)' : 'scale(1) translateY(0)' }}>
        <motion.div
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0.3, width: isHovered ? "40rem" : "15rem" }}
          transition={{
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="absolute inset-auto right-1/2 h-56 overflow-visible w-120 bg-[conic-gradient(from_70deg_at_center_top,var(--color-dss-blue-500),transparent,transparent)] text-foreground"
        >
          <div className="absolute w-full left-0 bg-background h-40 bottom-0 z-20 mask-[linear-gradient(to_top,white,transparent)]" />
          <div className="absolute w-40 h-full left-0 bg-background bottom-0 z-20 mask-[linear-gradient(to_right,white,transparent)]" />
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0.3, width: isHovered ? "40rem" : "15rem" }}
          transition={{
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="absolute inset-auto left-1/2 h-56 w-120 bg-[conic-gradient(from_290deg_at_center_top,transparent,transparent,var(--color-dss-blue-500))] text-foreground"
        >
          <div className="absolute w-40 h-full right-0 bg-background bottom-0 z-20 mask-[linear-gradient(to_left,white,transparent)]" />
          <div className="absolute w-full right-0 bg-background h-40 bottom-0 z-20 mask-[linear-gradient(to_top,white,transparent)]" />
        </motion.div>

        <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-background blur-2xl"></div>
        <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md"></div>

        <motion.div 
          animate={{ opacity: isHovered ? 0.6 : 0.1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-auto z-50 h-36 w-md -translate-y-1/2 rounded-full bg-dss-blue-500 blur-3xl"
        ></motion.div>

        <motion.div
          initial={false}
          animate={{ width: isHovered ? "20rem" : "6rem", opacity: isHovered ? 0.8 : 0.2 }}
          transition={{
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="absolute inset-auto z-30 h-36 -translate-y-24 rounded-full bg-dss-cyan-400 blur-2xl"
        ></motion.div>

        <motion.div
          initial={false}
          animate={{ width: isHovered ? "40rem" : "10rem", opacity: isHovered ? 1 : 0.2 }}
          transition={{
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="absolute inset-auto z-50 h-0.5 -translate-y-28 bg-dss-cyan-400 shadow-[0_0_20px_var(--dss-cyan-400)]"
        ></motion.div>

        <div className="absolute inset-auto z-40 h-44 w-full -translate-y-50 bg-background"></div>
      </div>

      <div 
        className="relative z-50 flex flex-col items-center px-5 mt-12 cursor-default group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </div>
    </div>
  );
};

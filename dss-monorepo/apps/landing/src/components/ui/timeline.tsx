"use client";

import { useScroll, useTransform, motion, useReducedMotion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";

export interface TimelineEntry {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const Timeline = ({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: TimelineEntry[];
}) => {
  const ref = useRef<HTMLOListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full bg-background font-sans md:px-10" ref={containerRef}>
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 lg:px-10">
        <h2
          id="flujo-title"
          className="max-w-4xl text-3xl font-bold tracking-tight text-foreground md:text-5xl"
        >
          {title}
        </h2>
        <p className="mt-4 max-w-md text-base text-muted-foreground md:text-lg">{description}</p>
      </div>

      <div className="relative mx-auto max-w-7xl pb-20">
      <ol ref={ref}>
        {data.map((item, index) => (
          <li key={item.title} className="flex justify-start pt-10 md:gap-10 md:pt-32">
            <div className="sticky top-32 z-40 flex max-w-xs flex-col items-center self-start md:w-full md:flex-row lg:max-w-sm">
              <div className="absolute left-2 flex h-12 w-12 items-center justify-center rounded-full border border-uatf-accent/40 bg-card text-uatf-accent-text shadow-[0_0_0_6px_var(--background)]">
                {item.icon}
              </div>
              <h3 className="hidden text-xl font-bold text-foreground md:block md:pl-20 md:text-3xl">
                <span className="block text-sm font-semibold text-uatf-sky-text">
                  Etapa {index + 1}
                </span>
                {item.title}
              </h3>
            </div>

            <div className="relative w-full pl-20 pr-5 md:pl-4">
              <h3 className="mb-4 block text-2xl font-bold text-foreground md:hidden">
                <span className="block text-sm font-semibold text-uatf-sky-text">
                  Etapa {index + 1}
                </span>
                {item.title}
              </h3>
              {item.content}
            </div>
          </li>
        ))}
      </ol>
        <div
          aria-hidden="true"
          style={{ height: height + "px" }}
          className="absolute left-8 top-0 w-0.5 overflow-hidden bg-linear-to-b from-transparent via-border to-transparent"
        >
          <motion.div
            style={
              reduceMotion
                ? { height: "100%" }
                : { height: heightTransform, opacity: opacityTransform }
            }
            className="absolute inset-x-0 top-0 w-0.5 rounded-full bg-linear-to-t from-uatf-sky via-uatf-accent to-transparent"
          />
        </div>
      </div>
    </div>
  );
};

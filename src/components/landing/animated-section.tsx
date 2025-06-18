"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  initialClassName?: string;
  animationClassName?: string;
  threshold?: number;
  delay?: string; // Tailwind delay class e.g. "delay-300"
  duration?: string; // Tailwind duration class e.g. "duration-700"
};

export function AnimatedSection({
  children,
  className,
  as: Element = "div",
  initialClassName = "opacity-0 translate-y-5", // Default: fade in from bottom
  animationClassName = "!opacity-100 !translate-y-0", // Default: fully visible, original position
  threshold = 0.1,
  delay = "delay-0",
  duration = "duration-700"
}: AnimatedSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  return (
    <Element
      ref={sectionRef}
      className={cn(
        "transition-all ease-in-out",
        duration,
        delay,
        isVisible ? animationClassName : initialClassName,
        className
      )}
    >
      {children}
    </Element>
  );
}

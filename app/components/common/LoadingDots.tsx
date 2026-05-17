'use client';

import { useEffect, useState } from 'react';

interface LoadingDotsProps {
  active?: boolean;
  className?: string;
  ariaLabel?: string;
  delayMs?: number;
}

export function LoadingDots({
  active = true,
  className,
  ariaLabel = 'Loading',
  delayMs = 0,
}: LoadingDotsProps) {
  const [dots, setDots] = useState('.');
  const [isVisible, setIsVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (!active) {
      setDots('.');
      setIsVisible(delayMs === 0);
      return;
    }

    if (delayMs === 0) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [active, delayMs]);

  useEffect(() => {
    if (!active || !isVisible) return;

    const states = ['.', '..', '...'];
    let index = 0;
    const intervalId = window.setInterval(() => {
      index = (index + 1) % states.length;
      setDots(states[index]);
    }, 300);

    return () => window.clearInterval(intervalId);
  }, [active, isVisible]);

  if (!active || !isVisible) {
    return null;
  }

  return (
    <span className={className} aria-live="polite" aria-label={ariaLabel}>
      {dots}
    </span>
  );
}

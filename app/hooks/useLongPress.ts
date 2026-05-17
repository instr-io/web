import { useRef, useCallback } from 'react';

const LONG_PRESS_DURATION = 500;
const MOVE_THRESHOLD = 10;
const SWIPE_THRESHOLD = 20;
const MAX_OFFSET = 30;

interface TouchActionsCallbacks {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onLongPress?: () => void;
}

interface TouchHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useTouchActions(callbacks: TouchActionsCallbacks): TouchHandlers {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const modeRef = useRef<'idle' | 'swiping' | 'scrolling' | 'longpress'>('idle');
  const firedRef = useRef(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const offsetRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupParent = useCallback(() => {
    const parent = elementRef.current?.parentElement;
    if (parent) {
      parent.classList.remove('swiping-right', 'swiping-left');
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    firedRef.current = false;
    modeRef.current = 'idle';
    elementRef.current = e.currentTarget as HTMLElement;
    offsetRef.current = 0;

    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };

    if (cbRef.current.onLongPress) {
      timerRef.current = setTimeout(() => {
        modeRef.current = 'longpress';
        firedRef.current = true;
        navigator.vibrate?.(50);
        cbRef.current.onLongPress!();
        timerRef.current = null;
      }, LONG_PRESS_DURATION);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current || modeRef.current === 'scrolling' || modeRef.current === 'longpress') return;

    const touch = e.touches[0];
    const dx = touch.clientX - startPos.current.x;
    const dy = touch.clientY - startPos.current.y;

    if (modeRef.current === 'idle') {
      if (Math.abs(dy) > MOVE_THRESHOLD) {
        modeRef.current = 'scrolling';
        clearTimer();
        return;
      }
      if (Math.abs(dx) > MOVE_THRESHOLD) {
        modeRef.current = 'swiping';
        clearTimer();
      }
    }

    if (modeRef.current === 'swiping' && elementRef.current) {
      let offset = dx;
      if (offset > 0 && !cbRef.current.onSwipeRight) offset = 0;
      if (offset < 0 && !cbRef.current.onSwipeLeft) offset = 0;

      offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, offset));
      offsetRef.current = offset;
      elementRef.current.style.transform = offset ? `translateX(${offset}px)` : '';

      const parent = elementRef.current.parentElement;
      if (parent) {
        if (offset > 0) {
          parent.classList.add('swiping-right');
          parent.classList.remove('swiping-left');
        } else if (offset < 0) {
          parent.classList.add('swiping-left');
          parent.classList.remove('swiping-right');
        } else {
          parent.classList.remove('swiping-right', 'swiping-left');
        }
      }
    }
  }, [clearTimer]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (modeRef.current === 'longpress' || firedRef.current) {
      e.preventDefault();
    }

    if (modeRef.current === 'swiping' && elementRef.current) {
      const offset = offsetRef.current;
      if (offset >= SWIPE_THRESHOLD && cbRef.current.onSwipeRight) {
        navigator.vibrate?.(30);
        cbRef.current.onSwipeRight();
      } else if (offset <= -SWIPE_THRESHOLD && cbRef.current.onSwipeLeft) {
        navigator.vibrate?.(30);
        cbRef.current.onSwipeLeft();
      }

      const el = elementRef.current;
      el.style.transition = 'transform 0.2s ease';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 200);
    }

    cleanupParent();
    clearTimer();
    offsetRef.current = 0;
    startPos.current = null;
    modeRef.current = 'idle';
  }, [clearTimer, cleanupParent]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

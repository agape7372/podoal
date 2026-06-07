'use client';

import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  /** Hold duration (ms) before the long-press fires. */
  threshold?: number;
  /** Finger drift (px) that cancels the press — preserves scroll intent. */
  moveTolerance?: number;
}

/**
 * Pointer-event long-press detector.
 *
 * Returns handlers to spread on an element plus `consumeLongPress()`: a one-shot
 * read of "did a long-press just fire?" so the click that follows the pointerup
 * can be suppressed (otherwise a long-press would ALSO trigger the element's
 * onClick). Deliberately does NOT call preventDefault on pointer events, so
 * vertical/horizontal scrolling keeps working — instead a drift past
 * `moveTolerance` cancels the pending press.
 */
export function useLongPress(
  onLongPress: () => void,
  { threshold = 500, moveTolerance = 10 }: UseLongPressOptions = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore secondary mouse buttons; allow touch/pen (button === 0 or -1).
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startRef.current = null;
        firedRef.current = true;
        onLongPress();
      }, threshold);
    },
    [onLongPress, threshold],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > moveTolerance * moveTolerance) cancel();
    },
    [cancel, moveTolerance],
  );

  /** Returns true exactly once if a long-press just fired (then resets). */
  const consumeLongPress = useCallback(() => {
    const fired = firedRef.current;
    firedRef.current = false;
    return fired;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    consumeLongPress,
  };
}

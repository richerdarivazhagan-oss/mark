import { useEffect, RefObject } from 'react';

/**
 * Custom hook that triggers a callback when clicking outside of specified element(s)
 * or when pressing the Escape key.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  handler: (event: MouseEvent | TouchEvent | KeyboardEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const refs = Array.isArray(ref) ? ref : [ref];
      const isOutside = refs.every((r) => {
        const el = r.current;
        return !el || !el.contains(event.target as Node);
      });

      if (isOutside) {
        handler(event);
      }
    };

    const keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler(event);
      }
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    document.addEventListener('keydown', keyListener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
      document.removeEventListener('keydown', keyListener);
    };
  }, [ref, handler, enabled]);
}

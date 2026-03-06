import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that uses IntersectionObserver to detect visibility
 * and only renders video iframes when they are in the viewport.
 * Pauses (unloads) iframes that scroll out of view.
 */
export function useLazyVideo(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}

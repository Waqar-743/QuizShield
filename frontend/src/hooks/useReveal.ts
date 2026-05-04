import { useEffect } from 'react';

/**
 * Adds `.is-visible` to every element with `.reveal` once it enters the viewport.
 * Uses IntersectionObserver — never scroll listeners.
 */
export function useReveal(rootSelector = '[data-reveal-root]') {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const root = document.querySelector(rootSelector) ?? document;
    const targets = root.querySelectorAll('.reveal');

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [rootSelector]);
}

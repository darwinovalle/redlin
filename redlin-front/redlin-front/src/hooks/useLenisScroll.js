import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const useLenisScroll = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return undefined;

    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      lerp: 0.08,
      duration: 1.25,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.2,
      normalizeWheel: true,
      anchors: true,
    });

    const syncScrollTrigger = () => {
      ScrollTrigger.update();
    };

    const update = (time) => {
      lenis.raf(time * 1000);
    };

    lenis.on('scroll', syncScrollTrigger);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(update);
      lenis.off('scroll', syncScrollTrigger);
      lenis.destroy();
      ScrollTrigger.refresh();
    };
  }, [enabled]);
};

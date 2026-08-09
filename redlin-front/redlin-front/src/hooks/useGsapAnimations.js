import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const useGsapAnimations = ({
    rootRef,
    heroRef,
    featuresRef,
    benefitsRef,
    howRef,
    testimonialsRef,
    pricingRef,
    finalCtaRef
}) => {
    useEffect(() => {
        const root = rootRef?.current;
        if (!root) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cleanupFns = [];

        const navbar = root.querySelector('.navbar-landing');
        let ticking = false;

        const syncNavbarColor = () => {
            if (!navbar) {
                ticking = false;
                return;
            }

            gsap.to(navbar, {
                backgroundColor: 'rgb(7, 20, 31)', // navy-deep, solid
                borderBottomColor: window.scrollY > 50 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                duration: 0.35,
                overwrite: 'auto'
            });
            ticking = false;
        };

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(syncNavbarColor);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        cleanupFns.push(() => window.removeEventListener('scroll', handleScroll));

        const revealSection = (ref, selector, options = {}) => {
            if (!ref?.current) return;
            const targets = ref.current.querySelectorAll(selector);
            if (!targets.length) return;

            gsap.fromTo(
                targets,
                {
                    autoAlpha: 0,
                    y: options.y ?? 56,
                    scale: options.scale ?? 1,
                },
                {
                    autoAlpha: 1,
                    y: 0,
                    scale: 1,
                    duration: options.duration ?? 0.95,
                    stagger: options.stagger ?? 0.08,
                    ease: options.ease ?? 'power3.out',
                    scrollTrigger: {
                        trigger: ref.current,
                        start: options.start ?? 'top 78%',
                        once: true,
                    }
                }
            );
        };

        const ctx = gsap.context(() => {
            if (prefersReducedMotion) {
                gsap.set([
                    '.hero-subtitle-landing',
                    '.hero-title-landing',
                    '.hero-title-char-landing',
                    '.hero-description-landing',
                    '.hero-cta-landing',
                    '.ui-card-landing',
                    '.floating-element-landing'
                ], { clearProps: 'all' });
                return;
            }

            gsap.set('.hero-subtitle-landing, .hero-description-landing, .hero-cta-landing', {
                autoAlpha: 0,
                y: 28
            });
            gsap.set('.hero-title-char-landing', {
                autoAlpha: 0,
                yPercent: 110,
                rotateX: -80,
                transformOrigin: '50% 100% -16',
            });
            gsap.set('.ui-card-landing', {
                autoAlpha: 0,
                y: 36,
                scale: 0.95,
                rotateX: 10,
                transformOrigin: '50% 100%'
            });
            gsap.set('.floating-element-landing', { autoAlpha: 0, scale: 0.88 });

            const introTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
            introTl
                .fromTo('.navbar-landing', { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0)
                .to('.floating-element-landing', { autoAlpha: 1, scale: 1, duration: 1.1, stagger: 0.1, ease: 'power2.out' }, 0.1)
                .to('.hero-subtitle-landing', { autoAlpha: 1, y: 0, duration: 0.55 }, 0.28)
                .to(
                    '.hero-title-char-landing',
                    {
                        autoAlpha: 1,
                        yPercent: 0,
                        rotateX: 0,
                        duration: 0.82,
                        ease: 'power4.out',
                        stagger: 0.018,
                    },
                    0.34
                )
                .to('.hero-description-landing', { autoAlpha: 1, y: 0, duration: 0.65 }, 0.5)
                .to('.hero-cta-landing', { autoAlpha: 1, y: 0, duration: 0.55 }, 0.66)
                .to(
                    '.ui-card-landing',
                    {
                        autoAlpha: 1,
                        y: 0,
                        scale: 1,
                        rotateX: 0,
                        duration: 0.9,
                        stagger: 0.12,
                        ease: 'back.out(1.3)'
                    },
                    0.34
                );

            gsap.to('.hero-bg-landing', {
                yPercent: 16,
                scale: 1.06,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });

            gsap.to('.mesh-grid-landing', {
                yPercent: 24,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });

            gsap.to('.hero-content-landing', {
                yPercent: 14,
                autoAlpha: 0.16,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });

            gsap.to('.neural-network-landing', {
                yPercent: -12,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });

            gsap.utils.toArray('.floating-element-landing').forEach((element, index) => {
                gsap.to(element, {
                    y: index % 2 === 0 ? -18 : 16,
                    x: index % 2 === 0 ? 12 : -10,
                    duration: 7 + index,
                    repeat: -1,
                    yoyo: true,
                    ease: 'sine.inOut',
                });
            });

            gsap.utils.toArray('.ui-card-landing').forEach((element, index) => {
                gsap.to(element, {
                    y: -9,
                    duration: 3.4 + index,
                    repeat: -1,
                    yoyo: true,
                    ease: 'sine.inOut',
                    delay: 0.2 * index,
                });
            });

            revealSection(featuresRef, '.section-title-landing, .feature-card-landing', { y: 60, stagger: 0.11 });
            revealSection(benefitsRef, '.benefits-title-landing, .benefits-description-landing, .stat-item-landing', { y: 56, stagger: 0.08 });
            revealSection(howRef, '.section-title-landing, .timeline-item-landing', { y: 72, stagger: 0.14 });
            revealSection(testimonialsRef, '.section-title-landing, .testimonial-card-landing', { y: 62, stagger: 0.1 });
            revealSection(pricingRef, '.section-title-landing, .pricing-card-landing', { y: 74, stagger: 0.12, duration: 1.05 });
            revealSection(finalCtaRef, '.final-cta-title-landing, .final-cta-description-landing, .email-form-landing', { y: 58, stagger: 0.1 });

            gsap.fromTo(
                '.data-bar-landing',
                { scaleY: 0, transformOrigin: '50% 100%' },
                {
                    scaleY: 1,
                    duration: 1.15,
                    stagger: 0.08,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: benefitsRef.current,
                        start: 'top 75%',
                        once: true,
                    }
                }
            );

            gsap.utils.toArray('.magnetic-target-landing').forEach((element) => {
                const xTo = gsap.quickTo(element, 'x', { duration: 0.45, ease: 'power3.out' });
                const yTo = gsap.quickTo(element, 'y', { duration: 0.45, ease: 'power3.out' });

                const handleMove = (event) => {
                    const rect = element.getBoundingClientRect();
                    const relativeX = event.clientX - rect.left - rect.width / 2;
                    const relativeY = event.clientY - rect.top - rect.height / 2;
                    xTo(relativeX * 0.14);
                    yTo(relativeY * 0.14);
                };

                const reset = () => {
                    xTo(0);
                    yTo(0);
                };

                element.addEventListener('mousemove', handleMove);
                element.addEventListener('mouseleave', reset);
                cleanupFns.push(() => {
                    element.removeEventListener('mousemove', handleMove);
                    element.removeEventListener('mouseleave', reset);
                });
            });

            ScrollTrigger.refresh();
        }, root);

        return () => {
            cleanupFns.forEach((cleanup) => cleanup());
            ctx.revert();
        };
    }, [rootRef, heroRef, featuresRef, benefitsRef, howRef, testimonialsRef, pricingRef, finalCtaRef]);
};

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const useGsapAnimations = (refs) => {
    useEffect(() => {
        const {
            heroRef,
            featuresRef,
            benefitsRef,
            howRef,
            testimonialsRef,
            pricingRef,
            finalCtaRef
        } = refs;

        // 1. Hero Section Animation
        if (heroRef.current) {
            gsap.fromTo(heroRef.current.querySelector('.hero-content-landing'),
                { opacity: 0, y: 50 },
                { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 }
            );
            gsap.fromTo(heroRef.current.querySelectorAll('.ui-card-landing'),
                { opacity: 0, y: 30, scale: 0.95 },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: 'power2.out',
                    delay: 0.5
                }
            );
        }

        // 2. Section Reveal Animation
        const revealSection = (ref, fromProps = { opacity: 0, y: 50 }) => {
            if (!ref.current) return;
            const elements = ref.current.querySelectorAll('h2, h3, p, .feature-card-landing, .timeline-item-landing, .testimonial-card-landing, .pricing-card-landing, .stat-item-landing, form, .data-bar-landing');
            gsap.fromTo(elements,
                fromProps,
                {
                    opacity: 1,
                    y: 0,
                    x: 0,
                    scale: 1,
                    duration: 1,
                    stagger: 0.1,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: ref.current,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    }
                }
            );
        };

        revealSection(featuresRef);
        revealSection(benefitsRef, { opacity: 0, scale: 0.9 });
        revealSection(howRef, { opacity: 0, x: -50 });
        revealSection(testimonialsRef);
        revealSection(pricingRef);
        revealSection(finalCtaRef);

        // 3. Navbar Scroll Animation
        const navbar = document.querySelector('.navbar-landing');
        const handleScroll = () => {
            if (window.scrollY > 50) {
                gsap.to(navbar, { backgroundColor: 'rgba(26, 42, 58, 0.95)', duration: 0.5 });
            } else {
                gsap.to(navbar, { backgroundColor: 'rgba(26, 42, 58, 0.8)', duration: 0.5 });
            }
        };
        window.addEventListener('scroll', handleScroll);

        // Cleanup
        return () => {
            window.removeEventListener('scroll', handleScroll);
            ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        };

    }, [refs]);
};

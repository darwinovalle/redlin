import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const useHomeAnimations = (refs) => {
    useEffect(() => {
        if (!refs) return;
        
        const {
            mainContentRef,
            welcomeRef,
            learningPathRef,
            progressSectionRef,
            upcomingSectionRef,
            statsCardRef,
            quickAccessRef,
            achievementsRef
        } = refs;

        // Wait a bit to ensure DOM is fully ready
        const timer = setTimeout(() => {
            // Simple fade-in animations without complex positioning
            const sections = [
                welcomeRef,
                learningPathRef, 
                progressSectionRef,
                upcomingSectionRef,
                statsCardRef,
                quickAccessRef,
                achievementsRef
            ];

            sections.forEach((ref, index) => {
                if (ref && ref.current) {
                    // Keep content visible even if animation runtime is interrupted.
                    gsap.fromTo(
                        ref.current,
                        { y: 12, opacity: 0.92 },
                        {
                            y: 0,
                            opacity: 1,
                            duration: 0.5,
                            delay: index * 0.08,
                            ease: 'power2.out',
                        }
                    );
                }
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        };
    }, [refs]);
};

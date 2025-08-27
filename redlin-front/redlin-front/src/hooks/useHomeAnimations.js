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
                    // Set initial state
                    gsap.set(ref.current, { 
                        opacity: 0, 
                        y: 20 
                    });
                    
                    // Animate in with a slight delay between each section
                    gsap.to(ref.current, {
                        opacity: 1,
                        y: 0,
                        duration: 0.6,
                        delay: index * 0.1,
                        ease: "power2.out"
                    });
                }
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        };
    }, [refs]);
};

/**
 * interactions.js
 * GSAP motion design & interactions for the High-End Editorial Split Grid
 */

document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
        console.warn("GSAP or ScrollTrigger not loaded.");
        return;
    }

    gsap.registerPlugin(ScrollTrigger);
    
    // Initialize animations
    initHeroEntrance();
    initScrollReveals();
    init3DTiltEffects();
    initLiveClock();
});

/**
 * Animate elements on initial page load with custom cubic-bezier ease
 */
function initHeroEntrance() {
    // Set initial clip-path and transforms programmatically for clean reveal
    gsap.set(".title-serif", { clipPath: "inset(0 0 100% 0)", y: 35 });
    gsap.set(".title-sans", { clipPath: "inset(0 0 100% 0)", y: 45 });

    const tl = gsap.timeline({
        defaults: {
            ease: "power4.out",
            duration: 1.2
        }
    });

    // Animate left side identity card elements sequentially (staggered)
    tl.fromTo(".hero-meta-badge", 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, delay: 0.2 }
    );

    // Elegant clip-path slide-up reveal for title lines
    tl.to(".title-serif", 
        { clipPath: "inset(0 0 0% 0)", y: 0, duration: 1.4, ease: "cubic-bezier(0.25, 1, 0.5, 1)" },
        "-=0.9"
    );

    tl.to(".title-sans", 
        { clipPath: "inset(0 0 0% 0)", y: 0, duration: 1.4, ease: "cubic-bezier(0.25, 1, 0.5, 1)" },
        "-=1.1"
    );

    tl.fromTo(".hero-description", 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        "-=0.9"
    );

    tl.fromTo(".hero-coordinates", 
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0 },
        "-=0.9"
    );

    tl.fromTo(".btn-premium", 
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1 },
        "-=1.0"
    );

    tl.fromTo(".hero-software-tags", 
        { opacity: 0 },
        { opacity: 1, duration: 1.5 },
        "-=0.8"
    );

    // Stagger animate software pills
    tl.fromTo(".soft-pill", 
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.8 },
        "-=1.2"
    );

    // Animate right side gallery window bezel sliding up with a custom scale reveal
    tl.fromTo(".hero-gallery-frame .bezel-outer", 
        { opacity: 0, y: 40, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 1.6, ease: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        "-=1.8"
    );
}

/**
 * ScrollTrigger-based entry reveals for narrative, stats and visual bezels
 */
function initScrollReveals() {
    // Reveal About Me Portrait Bezel
    gsap.fromTo(".about-portrait-bezel", 
        { opacity: 0, y: 40, scale: 0.98 },
        {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
                trigger: ".about-premium-section",
                start: "top 75%",
                toggleActions: "play none none none"
            }
        }
    );

    // Stagger reveal stats grid rows
    gsap.fromTo(".stat-item", 
        { opacity: 0, y: 15 },
        {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
                trigger: ".about-stats-grid",
                start: "top 80%",
                toggleActions: "play none none none"
            }
        }
    );

    // Reveal narrative title and paragraphs
    const narrativeTL = gsap.timeline({
        scrollTrigger: {
            trigger: ".about-narrative-panel",
            start: "top 70%",
            toggleActions: "play none none none"
        }
    });

    narrativeTL.fromTo(".narrative-eyebrow", 
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.8 }
    )
    .fromTo(".about-narrative-panel h2", 
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" },
        "-=0.6"
    )
    .fromTo(".bio-content p", 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, stagger: 0.15, duration: 0.8 },
        "-=0.6"
    )
    .fromTo(".social-link-premium", 
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.6 },
        "-=0.4"
    );

    // Subtle parallax float for the video bezel on scroll
    gsap.fromTo(".about-video-bezel", 
        { y: 50 },
        {
            y: -30,
            ease: "none",
            scrollTrigger: {
                trigger: ".about-premium-section",
                start: "top bottom",
                end: "bottom top",
                scrub: 1
            }
        }
    );
}

/**
 * 3D Holographic/Tilt hover effect on custom bezels
 */
function init3DTiltEffects() {
    const tiltContainers = document.querySelectorAll(".about-video-bezel, .about-portrait-bezel");

    tiltContainers.forEach(container => {
        const outer = container.querySelector(".bezel-outer");
        if (!outer) return;

        container.addEventListener("mousemove", (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calculate rotation values based on mouse position relative to container center
            const xRot = ((y / rect.height) - 0.5) * -15; // max tilt 15deg
            const yRot = ((x / rect.width) - 0.5) * 15;

            gsap.to(outer, {
                rotateX: xRot,
                rotateY: yRot,
                scale: 1.02,
                duration: 0.5,
                ease: "power2.out",
                transformPerspective: 1000,
                transformOrigin: "center center"
            });
        });

        container.addEventListener("mouseleave", () => {
            // Restore smooth initial position
            gsap.to(outer, {
                rotateX: 0,
                rotateY: 0,
                scale: 1,
                duration: 0.8,
                ease: "power3.out"
            });
        });
    });
}

/**
 * Tick clock for MVD time
 */
function initLiveClock() {
    const clockEl = document.getElementById("live-mvd-clock");
    if (!clockEl) return;
    
    function updateClock() {
        const now = new Date();
        const options = { 
            timeZone: "America/Montevideo", 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        };
        const timeStr = now.toLocaleTimeString("es-UY", options);
        clockEl.innerText = `MVD // ${timeStr} UTC-3`;
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

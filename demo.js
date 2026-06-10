// demo.js
gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {
    // 1. Loader & Init
    const tl = gsap.timeline({
        onComplete: () => {
            document.body.classList.remove("loading");
            initScrollAnimations();
            initCarousel();
            initConstantAnimations();
        }
    });

    tl.to(".loader", { yPercent: -100, duration: 1, delay: 1.2, ease: "power4.inOut" })
      .from(".badge", { y: 20, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.2")
      .from(".hero-title .line", { y: 150, duration: 1.2, stagger: 0.15, ease: "power4.out" }, "-=0.6")
      .from(".hero-subtitle", { opacity: 0, y: 20, duration: 0.8, ease: "power2.out" }, "-=0.8")
      .from(".hero-primary", { y: 100, scale: 0.95, opacity: 0, duration: 1.5, ease: "power3.out" }, "-=1")
      .from(".hero-secondary", { x: -50, y: 50, opacity: 0, duration: 1, ease: "power3.out" }, "-=1.2");

    // 2. Continuous Background Carousel
    function initCarousel() {
        const slides = document.querySelectorAll(".carousel-slide");
        if(slides.length === 0) return;
        let current = 0;
        
        // Initial state
        gsap.set(slides[0], { opacity: 1 });
        
        setInterval(() => {
            let next = (current + 1) % slides.length;
            
            // Ken burns subtle scale
            gsap.fromTo(slides[next], { scale: 1, opacity: 0 }, { scale: 1.05, opacity: 1, duration: 3, ease: "power1.inOut" });
            gsap.to(slides[current], { opacity: 0, duration: 3, ease: "power1.inOut" });
            
            current = next;
        }, 6000); // Crossfade every 6s
    }

    // 3. Constant "Life" floating animations
    function initConstantAnimations() {
        gsap.to(".float-anim", {
            y: "-=15",
            duration: 4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1
        });
        
        gsap.to(".float-anim-delayed", {
            y: "+=12",
            x: "+=5",
            duration: 3.5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 1
        });

        gsap.to(".float-anim-slow", {
            y: "-=8",
            duration: 5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1
        });
    }

    // 4. ScrollTrigger
    function initScrollAnimations() {
        gsap.to(".hero-primary .cms-media", {
            yPercent: 15,
            ease: "none",
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
        });

        ScrollTrigger.create({
            trigger: ".about-media-column",
            start: "top 20%",
            endTrigger: ".about-narrative-column",
            end: "bottom bottom",
            pin: ".about-portrait",
            pinSpacing: false
        });

        const texts = gsap.utils.toArray(".st-text-reveal");
        texts.forEach(text => {
            gsap.to(text, {
                color: "#1e1e24",
                duration: 0.5,
                scrollTrigger: { trigger: text, start: "top 70%", end: "bottom 50%", scrub: true }
            });
        });

        // Add scrolled class to header for glassmorphism
        ScrollTrigger.create({
            start: "top -50",
            onUpdate: (self) => {
                if (self.scroll() > 50) {
                    document.querySelector('.header').classList.add('scrolled');
                } else {
                    document.querySelector('.header').classList.remove('scrolled');
                }
            }
        });

        gsap.from(".stat-box", {
            y: 30, opacity: 0, duration: 0.8, stagger: 0.2, ease: "power3.out",
            scrollTrigger: { trigger: ".stats-grid", start: "top 85%" }
        });
    }

    // Admin Toggle
    const toggleBtn = document.getElementById("toggle-media-btn");
    let mediaRemoved = false;
    let savedMediaNodes = [];

    toggleBtn.addEventListener("click", () => {
        const containers = document.querySelectorAll(".media-container");
        if (!mediaRemoved) {
            containers.forEach(container => {
                const media = container.querySelector(".cms-media");
                if (media) {
                    savedMediaNodes.push({ container, media });
                    gsap.to(media, { opacity: 0, duration: 0.3, onComplete: () => media.remove() });
                }
            });
            toggleBtn.innerText = "Restore Media"; toggleBtn.classList.add("state-empty"); mediaRemoved = true;
        } else {
            savedMediaNodes.forEach(item => {
                gsap.set(item.media, { opacity: 0 });
                item.container.appendChild(item.media);
                gsap.to(item.media, { opacity: 1, duration: 0.5 });
            });
            savedMediaNodes = [];
            toggleBtn.innerText = "Remove All Media"; toggleBtn.classList.remove("state-empty"); mediaRemoved = false;
        }
    });
});

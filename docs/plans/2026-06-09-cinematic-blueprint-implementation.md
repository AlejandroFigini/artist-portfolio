# Cinematic Blueprint Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Overhaul the Hero Cover and About Me sections into a highly interactive Cinematic High-Tech Blueprint UI with custom cursor follower, blueprint grid empty states, software stack icons, and viewport corners.

**Architecture:** We will implement technical layout detailing (focus lines, crosshair viewport markers, blueprint grids) inside the CSS, add interactive scripting in JS for cursor, clock, and progress bar, and embed corresponding markup details in HTML.

**Tech Stack:** HTML5, CSS3 Custom Properties, GSAP (TweenMax + ScrollTrigger).

---

### Task 1: Initialize Custom Cursor & Real-Time Clock Markup in `index.html`

**Files:**
- Modify: `index.html:82-88` (Inject cursor element and clock container)

**Step 1: Write code change**
We will add the custom cursor markup immediately inside the `<body>` tag:
```html
    <!-- Custom Cursor Follower -->
    <div class="custom-cursor" id="custom-cursor">
        <span class="cursor-dot"></span>
        <span class="cursor-label"></span>
    </div>
```
And add the live clock container in the hero metadata badge:
```html
                <div class="hero-overlay">
                    <div class="hero-meta-badge">
                        <span class="meta-label">Est. 2019</span>
                        <span class="meta-separator">//</span>
                        <span class="meta-label" id="live-mvd-clock">MVD // --:--:-- UTC-3</span>
                        <span class="meta-separator">//</span>
                        <span class="meta-label" data-i18n="hero_sub_badge">Visual Art Portfolio</span>
                    </div>
```

**Step 2: Commit**
```bash
git add index.html
git -c user.name="Antigravity" -c user.email="antigravity@gemini.google" commit -m "feat: add cursor and clock markup to index.html"
```

---

### Task 2: Implement Viewport Viewfinder Corners, Reflective Glare, and Blueprint Grid Styles in `style.css`

**Files:**
- Modify: `style.css` (end of file, around line 6400-6500)

**Step 1: Write code change**
Implement style specifications for:
- Viewfinder corners (`+` icons inside `.bezel-inner`) using pseudo-elements.
- Blueprint grid empty-state pattern:
  ```css
  .bezel-inner.empty-state {
      background-image: 
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 20px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
  }
  .bezel-inner.empty-state::after {
      content: '[ VIEWPORT VIEW // OFFLINE ]';
      font-family: 'Fira Code', monospace;
      font-size: 10px;
      color: var(--text-muted);
      letter-spacing: 0.1em;
  }
  ```
- Reflective glare movement layout.
- Custom cursor styles (`.custom-cursor`).

**Step 2: Commit**
```bash
git add style.css
git -c user.name="Antigravity" -c user.email="antigravity@gemini.google" commit -m "style: add blueprint grid, cursor, and viewport corners to style.css"
```

---

### Task 3: Overhaul Software Pills and Add Real-Time Clock Functionality

**Files:**
- Modify: `index.html` (Inject SVG/FontAwesome icons inside `.soft-pill` structures)
- Modify: `interactions.js` (Clock ticks every second)

**Step 1: Write code change**
In `index.html`, add inline icons or specific labels inside the tooling pills:
- `[ Bl. Blender ]`, `[ ZB. ZBrush ]`, `[ My. Maya ]`, `[ Un. Unity ]`, `[ Ae. After Effects ]`, `[ Ps. Photoshop ]`.
In `interactions.js`, add local time ticking logic:
```javascript
function initLiveClock() {
    const clockEl = document.getElementById("live-mvd-clock");
    if (!clockEl) return;
    setInterval(() => {
        const now = new Date();
        const options = { timeZone: "America/Montevideo", hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const timeStr = now.toLocaleTimeString("es-UY", options);
        clockEl.innerText = `MVD // ${timeStr} UTC-3`;
    }, 1000);
}
```

**Step 2: Commit**
```bash
git add index.html interactions.js
git -c user.name="Antigravity" -c user.email="antigravity@gemini.google" commit -m "feat: add software stack icons and live clock tick"
```

---

### Task 4: Develop Interactive Custom Cursor and Slideshow Progress Bar in `interactions.js`

**Files:**
- Modify: `interactions.js` (Mouse follower tracking, bezel hover labeling)
- Modify: `index.html` (Add progress bar markup in Hero slideshow)

**Step 1: Write code change**
In `interactions.js`, initialize GSAP ticker / tween for cursor movement and set active label changes:
- Hover over `.hero-gallery-frame` -> Cursor reads `[ VIEW ]`.
- Hover over `.about-video-bezel` -> Cursor reads `[ PLAY ]`.
- Hover over links/buttons -> Cursor expands and sets blend-mode.
Add slideshow auto-play timeline sync with a visible progress bar (`.slide-progress-bar`).

**Step 2: Commit**
```bash
git add interactions.js index.html
git -c user.name="Antigravity" -c user.email="antigravity@gemini.google" commit -m "feat: implement GSAP custom cursor and slideshow progress tracker"
```

---

### Task 5: Verify Responsive Design, CMS Fallbacks, and Performance metrics

**Files:**
- Test: manual responsiveness check & empty state audit.

**Step 1: Validate**
- Check layout at exactly `768px` viewport and mobile viewports.
- Confirm empty placeholders stay beautiful if media source attributes are cleared.

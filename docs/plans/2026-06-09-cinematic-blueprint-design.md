# Design: Cinematic High-Tech Blueprint Portfolio Overhaul

## 1. Overview
This design documents the transition of the Hero cover (`#inicio`) and About Me (`#presentacion`) sections of Lucía Montaña's portfolio into a high-end, Cinematic High-Tech Blueprint aesthetic. The primary focus is making the media containers (bezels) highly interactive and visually self-sufficient (retaining layout integrity and a technical "empty state" grid if media is absent), and integrating detailed multimedia tooling stack elements.

---

## 2. Core Archetypes & Styling (Vibe & Layout)
* **Vibe Archetype**: Cinematic Viewport / Glassmorphism Grid. Obsidian black backgrounds, hairline borders (`rgba(255,255,255,0.06)`), and tech accents (crosshair viewport overlays, technical coordinates, real-time clock).
* **Layout Archetype**: Editorial Split Grid (Hero) + Staggered Z-Axis Cascade (About Me).
* **Double-Bezel nested containers**:
  * Outer shell with custom cubic-bezier hover tilt and padding.
  * Inner core holding the media or the blueprint grid empty state.
  * Corner crosshairs (`+`) styled dynamically with CSS `::before` and `::after` on `.bezel-inner`.
  * Reflective glare glass effect overlay.

---

## 3. Component Details

### A. Viewport Empty State Blueprint Grid
If no image or video is loaded by the CMS:
* A fine technical graph grid is displayed using a CSS linear gradient:
  ```css
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  ```
* Displays a technical monospace indicator: `[ SLOT_0X // NO_MEDIA_DETECTED ]`.
* Displays central focus markings.

### B. Multimedia Tooling Stack (Pills & Icons)
* Tooling pills in the Hero (`Blender`, `ZBrush`, `Maya`, `Unity`, `After Effects`, `Photoshop`) will display their matching software badges or custom SVG icons.
* Pills are styled like precise technical identifiers: `[ Bl Blender ]`, `[ Ae After Effects ]`, with colored borders matching the software's brand identity on hover.

### C. Live Real-Time Clock & Location Tracker
* Adds a ticking local time indicator in Montevideo: `MVD // HH:MM:SS UTC-3` dynamically updated via Javascript.
* Styled in green/accent terminal monospace.

### D. Interactive Slideshow Timeline Progress
* Slideshow container inside `.hero-gallery-frame` will have a thin progress bar at the bottom representing the transition duration (6s auto-play).
* Add interactive dot indicators `[ 01 ]`, `[ 02 ]`, `[ 03 ]` that allow manual navigation and animate when active.

### E. Custom Cursor Follower (`.custom-cursor`)
* A custom circle with a center dot that scales and updates its text content dynamically.
* Displays `[ VIEW ]` on image containers and `[ PLAY ]` on videos.
* Blends using `mix-blend-mode: difference` for high visibility.

---

## 4. CMS Superadmin Integrity
* All container classes (`.bezel-outer`, `.bezel-inner`) are hardcoded in the HTML structure.
* Media files (`<img>` and `<video>`) remain inside their respective wrappers (`.artist-photo-wrapper`, `.artist-video-wrapper`, `.slideshow-container`).
* The registry keys (`data-cms-key`) are preserved on text, background-images, and video source tags to avoid breaking the `cms.js` integration.

---

## 5. Verification Plan
* Test viewport responsiveness from mobile `375px` to desktop `1920px`.
* Verify empty states by removing the media source using the CMS or browser developer tools.
* Verify performance metrics (ensure FPS does not drop below 60fps on cursor hover and tilt actions).

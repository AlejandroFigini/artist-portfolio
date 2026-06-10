# Graph Report - .  (2026-06-09)

## Corpus Check
- Large corpus: 3624 files · ~6,734,797 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 362 nodes · 646 edges · 36 communities (24 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_CMS & Media Management|CMS & Media Management]]
- [[_COMMUNITY_Admin Panel & UI|Admin Panel & UI]]
- [[_COMMUNITY_Homepage Animations & Starfield|Homepage Animations & Starfield]]
- [[_COMMUNITY_Portfolio Pages & Content Layer|Portfolio Pages & Content Layer]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Gallery Shared Components|Gallery Shared Components]]
- [[_COMMUNITY_CSS Audit Tooling|CSS Audit Tooling]]
- [[_COMMUNITY_Migration Strategy & Stack Config|Migration Strategy & Stack Config]]
- [[_COMMUNITY_Character Art Gallery|Character Art Gallery]]
- [[_COMMUNITY_3D Models Gallery|3D Models Gallery]]
- [[_COMMUNITY_Express Backend & Database|Express Backend & Database]]
- [[_COMMUNITY_Dev Tooling & Skills|Dev Tooling & Skills]]
- [[_COMMUNITY_Animation Gallery|Animation Gallery]]
- [[_COMMUNITY_Database Setup|Database Setup]]
- [[_COMMUNITY_Particle Physics (Meteor)|Particle Physics (Meteor)]]
- [[_COMMUNITY_Content Data Schema|Content Data Schema]]
- [[_COMMUNITY_CSS Cleanup Tooling|CSS Cleanup Tooling]]
- [[_COMMUNITY_Icon Download Scripts|Icon Download Scripts]]
- [[_COMMUNITY_Icon Fetch Scripts|Icon Fetch Scripts]]
- [[_COMMUNITY_2FA Auth Setup|2FA Auth Setup]]
- [[_COMMUNITY_Illustrations Gallery|Illustrations Gallery]]
- [[_COMMUNITY_Illustrations Slideshow|Illustrations Slideshow]]
- [[_COMMUNITY_Characters Page Logic|Characters Page Logic]]
- [[_COMMUNITY_AI & Dev Tools|AI & Dev Tools]]
- [[_COMMUNITY_Admin Section|Admin Section]]
- [[_COMMUNITY_3DS Max Icon|3DS Max Icon]]
- [[_COMMUNITY_Multimedia Section|Multimedia Section]]
- [[_COMMUNITY_Photoshop Icon (Legacy)|Photoshop Icon (Legacy)]]
- [[_COMMUNITY_Photoshop Icon|Photoshop Icon]]

## God Nodes (most connected - your core abstractions)
1. `viewMediaModal()` - 21 edges
2. `load()` - 20 edges
3. `esc()` - 17 edges
4. `index.html — Main Production Portfolio Page` - 17 edges
5. `editMedia()` - 15 edges
6. `fmtBytes()` - 14 edges
7. `toast()` - 13 edges
8. `openRepoPicker()` - 13 edges
9. `openAddIllustration()` - 13 edges
10. `save()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Demo Hero Section (grid + floating media containers)` --semantically_similar_to--> `Hero Section (index.html)`  [INFERRED] [semantically similar]
  demo.html → index.html
- `Demo Superadmin Mock Panel` --semantically_similar_to--> `cms.js (CMS prototype, v3.1)`  [INFERRED] [semantically similar]
  demo.html → index.html
- `Demo Hero Background Carousel` --semantically_similar_to--> `Hero Section (index.html)`  [INFERRED] [semantically similar]
  demo.html → index.html
- `Demo About Section (editorial narrative layout)` --semantically_similar_to--> `About / Presentation Section (premium editorial cascade)`  [INFERRED] [semantically similar]
  demo.html → index.html
- `editMedia()` --calls--> `esc()`  [INFERRED]
  cms.js → admin.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Wave Marquee + CMS Integration + Handoff Sync Issue** — index_wave_marquee, index_cms_keys, index_cms_js, handoff_cms_dom_sync [EXTRACTED 0.95]
- **Hero Section Ported from Demo to Production with GSAP** — demo_hero_section, index_hero_section, demo_gsap, handoff_goals [INFERRED 0.90]
- **Migration Stack Rules: Legacy to Next.js + Framer Motion + Tailwind** — claude_legacy_stack, claude_nextjs_migration, claude_framer_motion_rule, claude_gsap_complex_rule, claude_tailwind_rule [EXTRACTED 0.95]

## Communities (36 total, 12 thin omitted)

### Community 0 - "CMS & Media Management"
Cohesion: 0.08
Nodes (59): $(), addGallerySlots(), applyMedia(), applyStored(), applyValue(), attachEditControls(), basename(), clearEmptySlot() (+51 more)

### Community 1 - "Admin Panel & UI"
Cohesion: 0.12
Nodes (56): appendAudit(), approxDataUrlBytes(), askRestore(), associateUnusedToContainer(), associateUsedToContainer(), autoCleanTrash(), buildModal(), closeOv() (+48 more)

### Community 2 - "Homepage Animations & Starfield"
Cohesion: 0.05
Nodes (23): animate(), animateElement(), applyLightboxMeta(), applySpot(), closeLightbox(), closeVideoLightbox(), GasCloud, handleLightboxClick() (+15 more)

### Community 3 - "Portfolio Pages & Content Layer"
Cohesion: 0.09
Nodes (33): Demo About Section (editorial narrative layout), demo.css stylesheet, Demo Hero Background Carousel, Demo Hero Section (grid + floating media containers), demo.html — Portfolio Design Prototype, demo.js script, Demo Superadmin Mock Panel, SimpleIcons 404 Fix: Exact Vendor Slugs (epicgames, maxon, autodesk) (+25 more)

### Community 4 - "Project Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, cloudinary, cors, dotenv, express, framer-motion, motion, otplib (+12 more)

### Community 5 - "Gallery Shared Components"
Cohesion: 0.20
Nodes (3): apply(), revealTypewriters(), filter()

### Community 6 - "CSS Audit Tooling"
Cohesion: 0.20
Nodes (8): classNames, css, deadClasses, deadIds, files, fs, idNames, noComments

### Community 7 - "Migration Strategy & Stack Config"
Cohesion: 0.31
Nodes (9): Framer Motion for UI Animations Rule, GSAP with useEffect + Cleanup for Complex Animations Rule, gstack Collaborator Tooling, Legacy Vanilla Stack (HTML/CSS/JS + Express + PostgreSQL + Cloudinary + GSAP), Artist Portfolio CLAUDE.md, Migration Plan (docs/migration-react-nextjs.md, 3 sessions), Next.js 15 + Tailwind CSS v4 + TypeScript Migration Target, Tailwind Utility Classes + CSS Variables Blueprint Aesthetic Rule (+1 more)

### Community 8 - "Character Art Gallery"
Cohesion: 0.29
Nodes (8): Alessio, Character Design, Characters, Companion, Creature, Hero, Jaffare, Villain

### Community 10 - "3D Models Gallery"
Cohesion: 0.29
Nodes (8): 3D Models, Creature, Environment set, Foliage pack, Hard-surface prop, Models 3D, Stylized character, Stylized prop

### Community 11 - "Express Backend & Database"
Cohesion: 0.25
Nodes (6): app, cors, express, path, { Pool }, { verify }

### Community 12 - "Dev Tooling & Skills"
Cohesion: 0.25
Nodes (7): computedHash, skillPath, source, sourceType, skills, emil-design-eng, version

### Community 13 - "Animation Gallery"
Cohesion: 0.40
Nodes (6): Animations, Cutscene, Effects test, Motion experiment, Run cycle, Walk cycle

### Community 14 - "Database Setup"
Cohesion: 0.40
Nodes (3): { Client }, fs, path

### Community 16 - "Content Data Schema"
Cohesion: 0.50
Nodes (3): items, _note, version

### Community 21 - "2FA Auth Setup"
Cohesion: 0.50
Nodes (3): { generateSecret }, qrcode, secret

### Community 22 - "Illustrations Gallery"
Cohesion: 0.67
Nodes (4): From sketch to final, Illustrations, Latest additions, The piece of the month

## Knowledge Gaps
- **91 isolated node(s):** `fs`, `css`, `noComments`, `files`, `classNames` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `editMedia()` connect `CMS & Media Management` to `Admin Panel & UI`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `esc()` connect `Admin Panel & UI` to `CMS & Media Management`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `apply()` connect `Gallery Shared Components` to `CMS & Media Management`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `fs`, `css`, `noComments` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CMS & Media Management` be split into smaller, more focused modules?**
  _Cohesion score 0.08312020460358056 - nodes in this community are weakly interconnected._
- **Should `Admin Panel & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.12462189957652753 - nodes in this community are weakly interconnected._
- **Should `Homepage Animations & Starfield` be split into smaller, more focused modules?**
  _Cohesion score 0.05365402405180388 - nodes in this community are weakly interconnected._
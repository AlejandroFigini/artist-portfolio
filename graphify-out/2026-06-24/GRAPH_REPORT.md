# Graph Report - artist-portfolio  (2026-06-21)

## Corpus Check
- 3436 files · ~6,733,687 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 448 nodes · 982 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0715aa5d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_CMS Admin Dashboard|CMS Admin Dashboard]]
- [[_COMMUNITY_About & Characters Showcase|About & Characters Showcase]]
- [[_COMMUNITY_Animations Showcase & Canvas|Animations Showcase & Canvas]]
- [[_COMMUNITY_Content TrashCleanup Actions|Content Trash/Cleanup Actions]]
- [[_COMMUNITY_CMS Edit Engine|CMS Edit Engine]]
- [[_COMMUNITY_CMS Root & Audit Overlay|CMS Root & Audit Overlay]]
- [[_COMMUNITY_Gallery Reveal Hooks|Gallery Reveal Hooks]]
- [[_COMMUNITY_Characters Page|Characters Page]]
- [[_COMMUNITY_Content API & Upload|Content API & Upload]]
- [[_COMMUNITY_CMS PickerText Modals|CMS Picker/Text Modals]]
- [[_COMMUNITY_Auth & Modal Base|Auth & Modal Base]]
- [[_COMMUNITY_Multimedia Gallery Items|Multimedia Gallery Items]]
- [[_COMMUNITY_Site Layout & Settings|Site Layout & Settings]]
- [[_COMMUNITY_Root Providers & Toast|Root Providers & Toast]]
- [[_COMMUNITY_3D Models Page|3D Models Page]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 25 edges
2. `recordAudit()` - 23 edges
3. `emit()` - 19 edges
4. `persistUnused()` - 19 edges
5. `persistUsed()` - 18 edges
6. `fmtBytes()` - 18 edges
7. `saveJSON()` - 17 edges
8. `state` - 16 edges
9. `Behavioral Guidelines` - 12 edges
10. `persistRetired()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `uploadDataUrl()`  [EXTRACTED]
  app/api/upload-test/route.ts → lib/storage.ts
- `seedUsedContent()` --calls--> `emit()`  [EXTRACTED]
  components/cms/engine.ts → lib/cms/store.ts
- `seedUsedContent()` --calls--> `persistUsed()`  [EXTRACTED]
  components/cms/engine.ts → lib/cms/store.ts
- `moveToUnusedSite()` --calls--> `basename()`  [EXTRACTED]
  components/cms/engine.ts → lib/utils.ts
- `persistOverrides()` --calls--> `emit()`  [EXTRACTED]
  components/cms/engine.ts → lib/cms/store.ts

## Import Cycles
- None detected.

## Communities (26 total, 5 thin omitted)

### Community 0 - "CMS Admin Dashboard"
Cohesion: 0.09
Nodes (37): AdminDashboard(), NAV_MAIN, AnyEntry, CardGroups(), CardType, GroupsProps, MediaCard(), MediaCardProps (+29 more)

### Community 1 - "About & Characters Showcase"
Cohesion: 0.18
Nodes (7): DEFAULT_SLIDES, HeroDetail, ensureGSAP(), prefersReducedMotion(), GALLERY_LINKS, LANGS, PORTFOLIO_LINKS

### Community 2 - "Animations Showcase & Canvas"
Cohesion: 0.33
Nodes (3): CircularGallery, CircularGalleryProps, GalleryItem

### Community 3 - "Content Trash/Cleanup Actions"
Cohesion: 0.13
Nodes (44): autoCleanTrash(), batchDeletePermanent(), batchMoveUnusedToTrash(), batchMoveUsedToUnused(), clearAudit(), deletePermanent(), emptyTrash(), POLICY_MS (+36 more)

### Community 4 - "CMS Edit Engine"
Cohesion: 0.06
Nodes (38): ABOUT_SOCIAL_FIELDS, ABOUT_SPEC_FIELDS, ANIM_FIELDS, applyMedia(), applyStored(), applyValue(), attachEditControls(), broadcastCarousel() (+30 more)

### Community 5 - "CMS Root & Audit Overlay"
Cohesion: 0.05
Nodes (56): RenameContainerModal(), metadata, AddIllustrationModal(), FIELD_DEFS, AuditOverlay(), CarouselManager(), Props, slideSrc() (+48 more)

### Community 7 - "Characters Page"
Cohesion: 0.06
Nodes (35): dependencies, class-variance-authority, cloudinary, clsx, gradflow, gsap, lucide-react, next (+27 more)

### Community 8 - "Content API & Upload"
Cohesion: 0.22
Nodes (10): cn(), CvButton(), CvButtonProps, options, Stars(), Button, ButtonProps, buttonVariants (+2 more)

### Community 9 - "CMS Picker/Text Modals"
Cohesion: 0.07
Nodes (28): 10. Usar todas las herramientas disponibles, 11. Performance, 1. Pensar antes de codear, 2. Simplicidad primero, 3. Cambios quirúrgicos, 4. Ejecución orientada a objetivos, 5. Calidad de código y limpieza activa, 6. Tecnologías modernas y escalabilidad (+20 more)

### Community 10 - "Auth & Modal Base"
Cohesion: 0.40
Nodes (3): DEFAULTS, PerfTier, Window

### Community 12 - "Site Layout & Settings"
Cohesion: 0.12
Nodes (14): EXPLORE_LINKS, SOCIAL_LINKS, applyLightboxMeta(), closeLightbox(), closeVideoLightbox(), handleLightboxClick(), LightboxMeta, openLightbox() (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (15): GET(), POST(), POST(), ensureDb(), g, getPool(), MIGRATIONS, needsSsl() (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (8): SOCIALS, SPECS, AnimFn, BuildFn, LoopHandle, revealLoop(), typewriterRevealLoop(), wordRevealLoop()

### Community 19 - "Community 19"
Cohesion: 0.20
Nodes (3): HeroMediaCarousel(), Props, readCarousel()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (3): Slide(), slideStyle(), TEXT_BLOCKS

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (3): Character, CHARACTERS, TOTAL

### Community 23 - "Community 23"
Cohesion: 0.47
Nodes (5): HomeFx(), htmlToLetterSpans(), REVEAL_SELECTOR, typewrite(), useGSAP()

## Knowledge Gaps
- **141 isolated node(s):** `⚠️ Next.js 16 Breaking Changes`, `1. Pensar antes de codear`, `2. Simplicidad primero`, `3. Cambios quirúrgicos`, `4. Ejecución orientada a objetivos` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `state` connect `CMS Root & Audit Overlay` to `CMS Admin Dashboard`, `About & Characters Showcase`, `Content Trash/Cleanup Actions`, `CMS Edit Engine`, `Community 19`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `ensureGSAP()` connect `About & Characters Showcase` to `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `prefersReducedMotion()` connect `About & Characters Showcase` to `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `⚠️ Next.js 16 Breaking Changes`, `1. Pensar antes de codear`, `2. Simplicidad primero` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CMS Admin Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.09438775510204081 - nodes in this community are weakly interconnected._
- **Should `Content Trash/Cleanup Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.1276595744680851 - nodes in this community are weakly interconnected._
- **Should `CMS Edit Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._
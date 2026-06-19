# Graph Report - artist-portfolio  (2026-06-19)

## Corpus Check
- 3447 files · ~6,981,033 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 392 nodes · 891 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f0d13e9`
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

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 25 edges
2. `recordAudit()` - 23 edges
3. `emit()` - 19 edges
4. `persistUnused()` - 19 edges
5. `fmtBytes()` - 18 edges
6. `persistUsed()` - 18 edges
7. `saveJSON()` - 17 edges
8. `state` - 16 edges
9. `persistRetired()` - 12 edges
10. `persistTrash()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `UploadModal()` --calls--> `fmtBytes()`  [EXTRACTED]
  components/cms/UploadModal.tsx → lib/utils.ts
- `moveToUnusedSite()` --calls--> `basename()`  [EXTRACTED]
  components/cms/engine.ts → lib/utils.ts
- `persistOverrides()` --calls--> `emit()`  [EXTRACTED]
  components/cms/engine.ts → lib/cms/store.ts
- `persistOverrides()` --calls--> `persistOverridesLocal()`  [EXTRACTED]
  components/cms/engine.ts → lib/cms/store.ts
- `Stars()` --calls--> `cn()`  [EXTRACTED]
  components/ui/button-8.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (17 total, 4 thin omitted)

### Community 0 - "CMS Admin Dashboard"
Cohesion: 0.07
Nodes (49): AdminDashboard(), NAV_MAIN, AnyEntry, CardGroups(), CardType, GroupsProps, MediaCard(), MediaCardProps (+41 more)

### Community 1 - "About & Characters Showcase"
Cohesion: 0.05
Nodes (23): SOCIALS, SPECS, CardFields, Character, CHARACTERS, TOTAL, HeroDetail, Props (+15 more)

### Community 2 - "Animations Showcase & Canvas"
Cohesion: 0.33
Nodes (3): CircularGallery, CircularGalleryProps, GalleryItem

### Community 3 - "Content Trash/Cleanup Actions"
Cohesion: 0.14
Nodes (40): autoCleanTrash(), batchDeletePermanent(), batchMoveUnusedToTrash(), batchMoveUsedToUnused(), clearAudit(), deletePermanent(), emptyTrash(), POLICY_MS (+32 more)

### Community 4 - "CMS Edit Engine"
Cohesion: 0.06
Nodes (38): ABOUT_SOCIAL_FIELDS, ABOUT_SPEC_FIELDS, ANIM_FIELDS, applyMedia(), applyStored(), applyValue(), attachEditControls(), broadcastCarousel() (+30 more)

### Community 5 - "CMS Root & Audit Overlay"
Cohesion: 0.06
Nodes (46): metadata, AddIllustrationModal(), FIELD_DEFS, AuditOverlay(), CarouselManager(), Props, slideSrc(), CmsRoot() (+38 more)

### Community 7 - "Characters Page"
Cohesion: 0.05
Nodes (38): dependencies, class-variance-authority, cloudinary, clsx, cors, dotenv, express, gradflow (+30 more)

### Community 8 - "Content API & Upload"
Cohesion: 0.22
Nodes (10): cn(), CvButton(), CvButtonProps, options, Stars(), Button, ButtonProps, buttonVariants (+2 more)

### Community 9 - "CMS Picker/Text Modals"
Cohesion: 0.25
Nodes (6): app, cors, express, path, { Pool }, { verify }

### Community 10 - "Auth & Modal Base"
Cohesion: 0.40
Nodes (3): DEFAULTS, PerfTier, Window

### Community 12 - "Site Layout & Settings"
Cohesion: 0.12
Nodes (14): EXPLORE_LINKS, SOCIAL_LINKS, applyLightboxMeta(), closeLightbox(), closeVideoLightbox(), handleLightboxClick(), LightboxMeta, openLightbox() (+6 more)

## Knowledge Gaps
- **119 isolated node(s):** `version`, `configurations`, `Props`, `ContentPickerProps`, `RepoEntry` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `state` connect `CMS Root & Audit Overlay` to `CMS Admin Dashboard`, `About & Characters Showcase`, `Content Trash/Cleanup Actions`, `CMS Edit Engine`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `useToast()` connect `CMS Root & Audit Overlay` to `CMS Admin Dashboard`, `CMS Edit Engine`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `version`, `configurations`, `Props` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CMS Admin Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.07219662058371736 - nodes in this community are weakly interconnected._
- **Should `About & Characters Showcase` be split into smaller, more focused modules?**
  _Cohesion score 0.052600818234950324 - nodes in this community are weakly interconnected._
- **Should `Content Trash/Cleanup Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `CMS Edit Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06448979591836734 - nodes in this community are weakly interconnected._
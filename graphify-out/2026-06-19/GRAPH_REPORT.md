# Graph Report - .  (2026-06-13)

## Corpus Check
- Corpus is ~707 words - fits in a single context window. You may not need a graph.

## Summary
- 387 nodes · 924 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Animations Page|Animations Page]]
- [[_COMMUNITY_Add Illustration & Media Utils|Add Illustration & Media Utils]]
- [[_COMMUNITY_3D Models Page|3D Models Page]]
- [[_COMMUNITY_Lightbox System|Lightbox System]]
- [[_COMMUNITY_Carousel Manager|Carousel Manager]]
- [[_COMMUNITY_Multimedia Page|Multimedia Page]]

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 25 edges
2. `recordAudit()` - 23 edges
3. `emit()` - 19 edges
4. `persistUnused()` - 19 edges
5. `persistUsed()` - 18 edges
6. `fmtBytes()` - 18 edges
7. `saveJSON()` - 17 edges
8. `state` - 14 edges
9. `persistRetired()` - 12 edges
10. `persistTrash()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AdminDashboard()` --calls--> `useCmsStore()`  [EXTRACTED]
  components/admin/AdminDashboard.tsx → lib/cms/store.ts
- `autoCleanTrash()` --calls--> `loadJSON()`  [EXTRACTED]
  components/admin/actions.ts → lib/cms/store.ts
- `AssociateContainerModal()` --calls--> `kindOf()`  [EXTRACTED]
  components/admin/modals.tsx → lib/cms/store.ts
- `AddIllustrationModal()` --calls--> `fmtBytes()`  [EXTRACTED]
  components/cms/AddIllustrationModal.tsx → lib/utils.ts
- `UploadModal()` --calls--> `fmtBytes()`  [EXTRACTED]
  components/cms/UploadModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "CMS Admin Dashboard"
Cohesion: 0.08
Nodes (46): AdminDashboard(), NAV_MAIN, AnyEntry, CardGroups(), CardType, GroupsProps, MediaCard(), MediaCardProps (+38 more)

### Community 1 - "About & Characters Showcase"
Cohesion: 0.07
Nodes (19): AboutSection(), SOCIALS, SPECS, useAboutReveals(), CHARACTERS, TOTAL, HomeFx(), htmlToLetterSpans() (+11 more)

### Community 2 - "Animations Showcase & Canvas"
Cohesion: 0.06
Nodes (21): AnimationsShowcase(), DECOR_LABELS, SOFTWARE_STACK, useVignetteTeleportation(), VIDEOS, COLORS, PLACEHOLDERS, CUBE_FACES (+13 more)

### Community 3 - "Content Trash/Cleanup Actions"
Cohesion: 0.17
Nodes (35): autoCleanTrash(), batchDeletePermanent(), batchMoveUnusedToTrash(), batchMoveUsedToUnused(), clearAudit(), deletePermanent(), emptyTrash(), POLICY_MS (+27 more)

### Community 4 - "CMS Edit Engine"
Cohesion: 0.08
Nodes (22): ANIM_FIELDS, applyMedia(), applyStored(), applyValue(), attachEditControls(), clearEmptySlot(), FieldDef, fieldSetters (+14 more)

### Community 5 - "CMS Root & Audit Overlay"
Cohesion: 0.21
Nodes (12): AuditOverlay(), CmsRoot(), addGallerySlots(), removeGallerySlots(), renderAddedIllu(), AddedIllu, setAdminFlag(), state (+4 more)

### Community 6 - "Gallery Reveal Hooks"
Cohesion: 0.17
Nodes (11): CharactersGallery(), FILTERS, IllustrationsGallery(), PIECES, SPOTLIGHT, Models3DGallery(), MultimediaGallery(), StaggerOpts (+3 more)

### Community 7 - "Characters Page"
Cohesion: 0.15
Nodes (8): metadata, Character, CHARACTERS, FILTERS, Thumb, TOTAL, GalleryFilterDef, Props

### Community 8 - "Content API & Upload"
Cohesion: 0.18
Nodes (12): computeFields(), persistOverrides(), syncWaveGroups(), FieldValue, Props, UploadModal(), ContentItems, getContent() (+4 more)

### Community 9 - "CMS Picker/Text Modals"
Cohesion: 0.22
Nodes (12): metaByKey, ContentPickerModal(), ContentPickerProps, FILTERS, RepoEntry, RepoPickerModal(), ConfirmMoveModal(), EditInfoModal() (+4 more)

### Community 10 - "Auth & Modal Base"
Cohesion: 0.19
Nodes (10): LoginModal(), Props, useKeyHandler(), login(), CmsModal(), CmsModalProps, ModalAction, ModalApi (+2 more)

### Community 11 - "Multimedia Gallery Items"
Cohesion: 0.23
Nodes (11): openCard(), FILTERS, Item, ITEMS, openCard(), TYPE_META, realMedia(), applyLightboxMeta() (+3 more)

### Community 12 - "Site Layout & Settings"
Cohesion: 0.18
Nodes (5): EXPLORE_LINKS, SOCIAL_LINKS, applyMotionOff(), LANGS, revealTypewriters()

### Community 13 - "Root Providers & Toast"
Cohesion: 0.20
Nodes (6): metadata, ModalProvider(), ToastContext, ToastItem, ToastKind, ToastProvider()

### Community 14 - "Animations Page"
Cohesion: 0.24
Nodes (5): metadata, AnimationsGallery(), CLIPS, FILTERS, useDragScroll()

### Community 15 - "Add Illustration & Media Utils"
Cohesion: 0.24
Nodes (8): AddIllustrationModal(), FIELD_DEFS, seedUsedContent(), createGalleryItem(), persistAdded(), persistMedia(), fileToDataURL(), validateFile()

### Community 16 - "3D Models Page"
Cohesion: 0.20
Nodes (5): ASSETS, FILTERS, Mode, MODES, metadata

### Community 17 - "Lightbox System"
Cohesion: 0.39
Nodes (5): closeLightbox(), closeVideoLightbox(), handleLightboxClick(), LightboxMeta, toggleLightboxInfo()

### Community 18 - "Carousel Manager"
Cohesion: 0.33
Nodes (5): CarouselManager(), Props, slideSrc(), currentSrcOf(), elementsByKey

## Knowledge Gaps
- **98 isolated node(s):** `metadata`, `metadata`, `metadata`, `metadata`, `metadata` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useToast()` connect `CMS Picker/Text Modals` to `CMS Admin Dashboard`, `CMS Root & Audit Overlay`, `Content API & Upload`, `Auth & Modal Base`, `Root Providers & Toast`, `Add Illustration & Media Utils`, `Carousel Manager`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `useReveal()` connect `Gallery Reveal Hooks` to `3D Models Page`, `Multimedia Gallery Items`, `Animations Page`, `Characters Page`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `state` connect `CMS Root & Audit Overlay` to `CMS Admin Dashboard`, `Content Trash/Cleanup Actions`, `CMS Edit Engine`, `Content API & Upload`, `CMS Picker/Text Modals`, `Add Illustration & Media Utils`, `Carousel Manager`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CMS Admin Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.08007013442431327 - nodes in this community are weakly interconnected._
- **Should `About & Characters Showcase` be split into smaller, more focused modules?**
  _Cohesion score 0.06659619450317125 - nodes in this community are weakly interconnected._
- **Should `Animations Showcase & Canvas` be split into smaller, more focused modules?**
  _Cohesion score 0.05609756097560976 - nodes in this community are weakly interconnected._
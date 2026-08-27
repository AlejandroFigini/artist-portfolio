import Nav from '@/components/ui/Nav'
import Footer from '@/components/ui/Footer'
import SettingsPanel from '@/components/ui/SettingsPanel'
import Lightboxes from '@/components/ui/Lightboxes'
import CmsRoot from '@/components/cms/CmsRoot'
import SmoothScroll from '@/components/ui/SmoothScroll'
import ViewportGate from '@/components/ui/ViewportGate'

/* Layout del sitio público (nav + footer + lightboxes + settings + cms).
   /admin queda afuera del grupo: usa su propio layout tipo dashboard. */

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <ViewportGate />
      <CmsRoot />
      <Nav />
      {children}
      <Footer />
      <Lightboxes />
      <SettingsPanel />
    </>
  )
}

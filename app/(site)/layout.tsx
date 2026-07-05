import Nav from '@/components/ui/Nav'
import Footer from '@/components/ui/Footer'
import SettingsPanel from '@/components/ui/SettingsPanel'
import Lightboxes from '@/components/ui/Lightboxes'
import PageLoader from '@/components/ui/PageLoader'
import CmsRoot from '@/components/cms/CmsRoot'

/* Layout del sitio público (nav + footer + lightboxes + settings + cms + loader).
   /admin queda afuera del grupo: usa su propio layout tipo dashboard. */

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageLoader />
      <CmsRoot />
      <Nav />
      {children}
      <Footer />
      <Lightboxes />
      <SettingsPanel />
    </>
  )
}

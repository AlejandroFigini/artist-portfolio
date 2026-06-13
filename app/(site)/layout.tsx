import Nav from '@/components/ui/Nav'
import Footer from '@/components/ui/Footer'
import SettingsPanel from '@/components/ui/SettingsPanel'
import Lightboxes from '@/components/ui/Lightboxes'

/* Layout del sitio público (nav + footer + lightboxes + settings).
   /admin queda afuera del grupo: usa su propio layout tipo dashboard. */

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
      <Lightboxes />
      <SettingsPanel />
    </>
  )
}

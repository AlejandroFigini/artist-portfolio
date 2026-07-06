import type { Metadata } from 'next'
import AdminDashboard from '@/components/admin/AdminDashboard'
import CmsRoot from '@/components/cms/CmsRoot'

export const metadata: Metadata = {
  title: 'Gestión — Lucia Montaña',
  robots: { index: false, follow: false },
}

/* Página de gestión — port de admin.html. El middleware exige la
   cookie de sesión; el dashboard re-verifica el flag del lado cliente. */

export default function AdminPage() {
  return (
    <div className="admin-page">
      <CmsRoot />
      <AdminDashboard />
    </div>
  )
}

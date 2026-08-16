import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useUiText } from '@/lib/cms/store'
import { sendGAEvent } from '@next/third-parties/google'

export function useDownloadCv(cvUrl: string, cvName: string) {
  const toast = useToast()
  const ui = useUiText()
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadCv = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!cvUrl) return

    setIsDownloading(true)
    sendGAEvent('event', 'cv_download')

    try {
      const res = await fetch('/api/cv')
      if (!res.ok) {
        throw new Error(ui('cv_unavailable') || 'CV not available')
      }
      
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = cvName || 'CV.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error downloading CV', 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  return { downloadCv, isDownloading }
}

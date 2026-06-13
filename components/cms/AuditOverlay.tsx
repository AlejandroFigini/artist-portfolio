'use client'

/* Auditoría desde el sitio — port de cms.js openAuditPage():
   overlay de pantalla completa con la tabla de cambios. */

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes, fmtDate } from '@/lib/utils'
import { state, persistAudit, useCmsStore, emit } from '@/lib/cms/store'

export default function AuditOverlay({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  useCmsStore()
  const [show, setShow] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])

  const close = () => { setShow(false); setTimeout(onClose, 250) }
  const rows = state.audit.slice().reverse()

  return (
    <div className={`cms-admin-overlay${show ? ' show' : ''}`}>
      <div className="cms-admin-panel">
        <div className="cms-admin-head">
          <h2><i className="fa-solid fa-clipboard-list"></i> Gestión — Auditoría de cambios</h2>
          <div className="cms-admin-head-actions">
            <button
              type="button" className="cms-btn cms-btn--sm"
              onClick={() => { state.audit = []; persistAudit(); emit(); toast('Registro vaciado') }}
            >
              Vaciar registro
            </button>
            <button type="button" className="cms-btn cms-btn--sm cms-btn--primary" onClick={close}>Cerrar</button>
          </div>
        </div>
        <p className="cms-admin-sub">{state.audit.length} cambio(s) registrado(s). (En producción esto vendrá de la BD vía el backend.)</p>
        <div className="cms-audit-table-wrap">
          <table className="cms-audit-table">
            <thead>
              <tr><th>Fecha</th><th>Usuario</th><th>Sección</th><th>Contenedor</th><th>Qué cambió</th><th>Archivo</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="cms-audit-empty">Todavía no hay cambios registrados.</td></tr>
              )}
              {rows.map((a, i) => (
                <tr key={i}>
                  <td>{fmtDate(a.ts)}</td>
                  <td>{a.user}</td>
                  <td>{a.section}</td>
                  <td>{a.label}</td>
                  <td>{a.summary}</td>
                  <td>{a.file ? `${a.file.name} (${fmtBytes(a.file.size)}, ${a.file.type || '—'})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

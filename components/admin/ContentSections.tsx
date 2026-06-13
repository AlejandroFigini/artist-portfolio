'use client'

/* Secciones de Contenidos del panel — port de admin.js: En uso /
   Sin usar / Repositorio / Basurero, con selección múltiple, lotes,
   vista previa y menús contextuales por estado. */

import { useState } from 'react'
import { useModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { fmtBytes } from '@/lib/utils'
import {
  state, sumSizes, moveUsedToUnused, moveUnusedToTrash, restoreTrashToUnused,
  performRestore, loadJSON, saveJSON, LS,
} from '@/lib/cms/store'
import {
  deletePermanent, emptyTrash, purgeUnused, autoCleanTrash,
  batchMoveUsedToUnused, batchMoveUnusedToTrash, batchDeletePermanent,
} from './actions'
import { MediaCard, CardGroups, type AnyEntry, type MenuAction } from './cards'

export type AdminModal =
  | { kind: 'view'; e: AnyEntry; cardType: 'used' | 'unused' | 'trash' | 'repo'; menu: { label: React.ReactNode; onClick: () => void }[] }
  | { kind: 'rename'; key: string }
  | { kind: 'associate'; item: AnyEntry; isUnused: boolean; idx: number }
  | { kind: 'editInfo'; key: string }

type Sel = { type: string; val: string }

type Ctx = {
  usedArr: AnyEntry[]
  unusedArr: AnyEntry[]
  trashArr: AnyEntry[]
  openModal: (m: AdminModal) => void
}

function useSelection() {
  const [multiSelect, setMultiSelect] = useState(false)
  const [selected, setSelected] = useState<Sel[]>([])
  const isSel = (type: string, val: string) => selected.some((x) => x.type === type && x.val === val)
  const toggle = (type: string, val: string, on: boolean) =>
    setSelected((s) => (on ? [...s, { type, val }] : s.filter((x) => !(x.type === type && x.val === val))))
  const toggleMulti = () => { setMultiSelect((m) => !m); setSelected([]) }
  return { multiSelect, selected, setSelected, isSel, toggle, toggleMulti }
}

function MultiToggleBtn({ multiSelect, onClick }: { multiSelect: boolean; onClick: () => void }) {
  return (
    <button type="button" className="cms-btn cms-btn--sm" style={{ marginLeft: 'auto' }} onClick={onClick}>
      <i className="fa-solid fa-check-square"></i> {multiSelect ? 'Deshabilitar Selección' : 'Selección Múltiple'}
    </button>
  )
}

function BatchBar({ count, actionLabel, danger, onCancel, onAction }: {
  count: number; actionLabel: string; danger?: boolean; onCancel: () => void; onAction: () => void
}) {
  return (
    <div className={`cms-batch-bar${count === 0 ? ' cms-batch-bar-hidden' : ''}`}>
      <div><strong className="batch-count">{count}</strong> elementos seleccionados</div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="cms-btn" onClick={onCancel}>Cancelar Selección</button>
        <button type="button" className="cms-btn cms-btn--primary" style={danger ? { background: '#ef4444', borderColor: '#ef4444' } : undefined} onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// Menús contextuales por estado (compartidos por tarjeta y vista previa)
function useMenus({ openModal }: Pick<Ctx, 'openModal'>) {
  const { confirm } = useModal()

  const usedMenu = (e: AnyEntry): MenuAction[] => [
    { icon: 'fa-link', color: '#a855f7', label: 'Asociar a otro contenedor', onClick: () => openModal({ kind: 'associate', item: e, isUnused: false, idx: -1 }) },
    { icon: 'fa-signature', color: '#3b82f6', label: 'Renombrar contenedor', onClick: () => openModal({ kind: 'rename', key: (e as { key: string }).key }) },
    { icon: 'fa-pen', color: '#22c55e', label: 'Editar información', onClick: () => openModal({ kind: 'editInfo', key: (e as { key: string }).key }) },
    { icon: 'fa-box-archive', color: '#eab308', label: 'Mover a Sin Usar', onClick: () => {
      confirm('Mover a no usados',
        <>Vas a mover <strong>{e.label || (e as { key?: string }).key}</strong> a <strong>contenidos no usados</strong>.
          <div className="cms-confirm-warn"><i className="fa-solid fa-triangle-exclamation"></i> Se quitará del sitio. Podrás restaurarlo desde acá.</div></>,
        () => moveUsedToUnused((e as { key: string }).key))
    } },
  ]

  const unusedMenu = (e: AnyEntry): MenuAction[] => {
    const idx = e._idx ?? -1
    const acts: MenuAction[] = [
      { icon: 'fa-link', color: '#a855f7', label: 'Asociar a contenedor', onClick: () => openModal({ kind: 'associate', item: e, isUnused: true, idx }) },
    ]
    if (e.key) {
      acts.push({ icon: 'fa-signature', color: '#3b82f6', label: 'Renombrar contenedor', onClick: () => openModal({ kind: 'rename', key: e.key! }) })
      acts.push({ icon: 'fa-rotate-left', color: '#22c55e', label: 'Restaurar', onClick: () => {
        const occupied = state.usedContent[e.key!]
        confirm('Restaurar contenido',
          <>Vas a restaurar <strong>{e.label || 'contenido'}</strong>{e.section ? <> en la sección <strong>{e.section}</strong></> : null}.
            {occupied ? (
              <div className="cms-confirm-warn"><i className="fa-solid fa-triangle-exclamation"></i> El contenido actual de esa ubicación (<strong>{occupied.name || occupied.label}</strong>) se moverá a <strong>no usados</strong>.</div>
            ) : (
              <div className="cms-confirm-warn"><i className="fa-solid fa-circle-info"></i> Volverá a mostrarse en el sitio.</div>
            )}</>,
          () => performRestore(idx))
      } })
    }
    acts.push({ icon: 'fa-trash', color: 'danger', label: 'Mover a basurero', onClick: () => moveUnusedToTrash(idx) })
    return acts
  }

  const trashMenu = (e: AnyEntry): MenuAction[] => [
    { icon: 'fa-folder-closed', color: '#eab308', label: 'Mover a sin usar', onClick: () => restoreTrashToUnused(e._idx ?? -1) },
    { icon: 'fa-skull', color: 'danger', label: 'Borrar permanentemente', onClick: () => {
      confirm('Eliminar permanentemente', '¿Eliminar permanentemente de Cloudinary? Esta acción no se puede deshacer.', () => { deletePermanent(e._idx ?? -1) })
    } },
  ]

  return { usedMenu, unusedMenu, trashMenu }
}

const toViewMenu = (acts: MenuAction[]) =>
  acts.map((a) => ({
    label: <><i className={`fa-solid ${a.icon}`} style={{ color: a.color === 'danger' ? '#ef4444' : a.color, marginRight: 6 }}></i> {a.label}</>,
    onClick: a.onClick,
  }))

export function SectionUsado({ usedArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const { usedMenu } = useMenus({ openModal })
  const count = sel.selected.length

  return (
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-check" style={{ color: '#22c55e' }}></i> Contenido en Uso</h2>
        <MultiToggleBtn multiSelect={sel.multiSelect} onClick={sel.toggleMulti} />
      </div>
      {sel.multiSelect && (
        <BatchBar
          count={count} actionLabel="Mover a Sin Usar"
          onCancel={sel.toggleMulti}
          onAction={() => {
            if (!count) return
            confirm('Mover múltiples a no usados', `¿Mover ${count} elementos a sin usar?`, () => {
              batchMoveUsedToUnused(sel.selected.map((x) => x.val))
              sel.toggleMulti()
            })
          }}
        />
      )}
      <p className="cms-admin-sub" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span>Todo lo que el sitio muestra ahora, agrupado por sección.</span>
        <span><strong>Cantidad:</strong> {usedArr.length} archivos.</span>
        <span><strong>Tamaño total:</strong> {fmtBytes(sumSizes(usedArr))}</span>
      </p>
      <CardGroups
        arr={usedArr} emptyMsg="Todavía no hay contenido registrado."
        multiSelect={sel.multiSelect}
        onSelectGroup={(items, on) => items.forEach((it) => sel.toggle('used', (it as { key: string }).key, on))}
        renderCard={(e) => (
          <MediaCard
            key={(e as { key: string }).key} e={e} cardType="used" actions={usedMenu(e)}
            multiSelect={sel.multiSelect}
            selected={sel.isSel('used', (e as { key: string }).key)}
            onToggleSelect={(on) => sel.toggle('used', (e as { key: string }).key, on)}
            onView={() => openModal({ kind: 'view', e, cardType: 'used', menu: toViewMenu(usedMenu(e)) })}
          />
        )}
      />
    </div>
  )
}

export function SectionNoUsado({ unusedArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const { unusedMenu } = useMenus({ openModal })
  const count = sel.selected.length

  return (
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      {sel.multiSelect && (
        <BatchBar
          count={count} actionLabel="Mover al Basurero" danger
          onCancel={sel.toggleMulti}
          onAction={() => {
            if (!count) return
            confirm('Mover múltiples al basurero', `¿Mover ${count} elementos al basurero?`, () => {
              batchMoveUnusedToTrash(sel.selected.map((x) => parseInt(x.val, 10)))
              sel.toggleMulti()
            })
          }}
        />
      )}
      <div className="admin-card-head">
        <h2><i className="fa-solid fa-folder-closed"></i> Contenido Sin Usar</h2>
        <MultiToggleBtn multiSelect={sel.multiSelect} onClick={sel.toggleMulti} />
        {unusedArr.length > 0 && (
          <button type="button" className="cms-btn cms-btn--sm cms-btn--primary"
            onClick={() => confirm('Vaciar contenidos sin usar', '¿Vaciar TODOS los contenidos sin usar? Esto los removerá de la lista, pero para borrarlos físicamente deben pasar por el basurero o ser borrados manualmente de Cloudinary.', purgeUnused)}>
            Vaciar todo lo no usado
          </button>
        )}
      </div>
      <p className="cms-admin-sub">
        Versiones reemplazadas o retiradas. Restauralas a su ubicación o envíalas al basurero. Tamaño total: {fmtBytes(sumSizes(unusedArr))}
      </p>
      <CardGroups
        arr={unusedArr} emptyMsg="No hay contenidos sin usar. 👌"
        multiSelect={sel.multiSelect}
        onSelectGroup={(items, on) => items.forEach((it) => sel.toggle('unused', String(it._idx), on))}
        renderCard={(e) => (
          <MediaCard
            key={e._idx} e={e} cardType="unused" actions={unusedMenu(e)}
            tags={e.reason === 'replaced' ? <span className="cms-tag">reemplazado</span> : e.reason === 'retired' ? <span className="cms-tag">retirado</span> : undefined}
            multiSelect={sel.multiSelect}
            selected={sel.isSel('unused', String(e._idx))}
            onToggleSelect={(on) => sel.toggle('unused', String(e._idx), on)}
            onView={() => openModal({ kind: 'view', e, cardType: 'unused', menu: toViewMenu(unusedMenu(e)) })}
          />
        )}
      />
    </div>
  )
}

export function SectionBasurero({ trashArr, openModal }: Ctx) {
  const sel = useSelection()
  const { confirm } = useModal()
  const toast = useToast()
  const { trashMenu } = useMenus({ openModal })
  const [policy, setPolicy] = useState(() => loadJSON<string>(LS.TRASH_POLICY, 'manual'))
  const count = sel.selected.length

  return (
    <div className={`admin-card${sel.multiSelect ? ' cms-multi-mode' : ''}`}>
      {sel.multiSelect && (
        <BatchBar
          count={count} actionLabel="Eliminar Permanentemente" danger
          onCancel={sel.toggleMulti}
          onAction={() => {
            if (!count) return
            confirm('Eliminar permanentemente', `¿Eliminar ${count} elementos permanentemente? Esto no se puede deshacer.`, () => {
              toast('Eliminando archivos de Cloudinary...', 'info')
              batchDeletePermanent(sel.selected.map((x) => parseInt(x.val, 10)))
              sel.toggleMulti()
            })
          }}
        />
      )}
      <div className="admin-card-head" style={{ alignItems: 'center' }}>
        <h2><i className="fa-solid fa-trash-can"></i> Basurero</h2>
        <MultiToggleBtn multiSelect={sel.multiSelect} onClick={sel.toggleMulti} />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Borrado automático:</span>
          <select
            value={policy}
            style={{ padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', border: '1px solid var(--border)' }}
            onChange={(e) => { setPolicy(e.target.value); saveJSON(LS.TRASH_POLICY, e.target.value); autoCleanTrash() }}
          >
            <option value="manual">Manual</option>
            <option value="1d">1 día</option>
            <option value="3d">3 días</option>
            <option value="7d">1 semana</option>
          </select>
          {trashArr.length > 0 && (
            <button type="button" className="cms-btn cms-btn--sm cms-btn--primary"
              onClick={() => confirm('Vaciar basurero', '¿Vaciar TODO el basurero y eliminar permanentemente de Cloudinary?', () => { emptyTrash() })}>
              Vaciar todo
            </button>
          )}
        </div>
      </div>
      <p className="cms-admin-sub">Contenido marcado para eliminar. Tamaño recuperable: {fmtBytes(sumSizes(trashArr))}</p>
      <CardGroups
        arr={trashArr} emptyMsg="El basurero está vacío."
        multiSelect={sel.multiSelect}
        onSelectGroup={(items, on) => items.forEach((it) => sel.toggle('trash', String(it._idx), on))}
        renderCard={(e) => (
          <MediaCard
            key={e._idx} e={e} cardType="trash" actions={trashMenu(e)}
            tags={<span className="cms-tag cms-tag--basurero">En papelera</span>}
            multiSelect={sel.multiSelect}
            selected={sel.isSel('trash', String(e._idx))}
            onToggleSelect={(on) => sel.toggle('trash', String(e._idx), on)}
            onView={() => openModal({ kind: 'view', e, cardType: 'trash', menu: toViewMenu(trashMenu(e)) })}
          />
        )}
      />
    </div>
  )
}

export function SectionRepo({ usedArr, unusedArr, trashArr, openModal }: Ctx) {
  const { usedMenu, unusedMenu } = useMenus({ openModal })
  const [filter, setFilter] = useState(() => loadJSON<string>(LS.REPO_FILTER, 'all'))

  const all: AnyEntry[] = [
    ...usedArr.map((x) => ({ ...x, _state: 'used' as const })),
    ...unusedArr.map((x) => ({ ...x, _state: 'unused' as const })),
    ...trashArr.map((x) => ({ ...x, _state: 'trash' as const })),
  ]
  const filtered = filter === 'all' ? all : all.filter((x) => x._state === filter)

  const stateTag = (s?: string) =>
    s === 'used' ? <span className="cms-tag cms-tag--uso">En Uso</span>
      : s === 'unused' ? <span className="cms-tag cms-tag--nouso">Sin Usar</span>
        : <span className="cms-tag cms-tag--basurero">Basurero</span>

  return (
    <div className="admin-card">
      <div className="admin-card-head" style={{ alignItems: 'center' }}>
        <h2><i className="fa-solid fa-cloud"></i> Repositorio Total</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por:</span>
          <select
            value={filter}
            style={{ padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', border: '1px solid var(--border)' }}
            onChange={(e) => { setFilter(e.target.value); saveJSON(LS.REPO_FILTER, e.target.value) }}
          >
            <option value="all">Todos los contenidos</option>
            <option value="used">Solo en uso</option>
            <option value="unused">Solo sin usar</option>
            <option value="trash">Solo basurero</option>
          </select>
        </div>
      </div>
      <p className="cms-admin-sub">Vista unificada de todo el contenido gestionado en todas sus etapas.</p>
      <div className="cms-mlib-grid">
        {filtered.map((e, i) => {
          const actions = e._state === 'used' ? usedMenu(e).slice(0, 3) : e._state === 'unused' ? unusedMenu(e) : []
          return (
            <MediaCard
              key={i} e={e} cardType="repo" actions={actions}
              tags={stateTag(e._state)}
              onView={() => openModal({ kind: 'view', e, cardType: 'repo', menu: toViewMenu(actions) })}
            />
          )
        })}
      </div>
    </div>
  )
}

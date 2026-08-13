'use client'

/* Input de contraseña con ojo para mostrar/ocultar. Reusable en login, alta y
   edición de usuarios. Soporta uso controlado (value/onChange) y no controlado
   (ref) — reenvía la ref al <input> real y propaga el resto de props.

   Seguridad: el toggle es solo visual (la contraseña ya vive en el value del
   input); el único riesgo es shoulder-surfing, por eso arranca oculta y el botón
   no se enfoca al tabular (tabIndex -1). */

import { forwardRef, useState, type InputHTMLAttributes } from 'react'

const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ style, ...rest }, ref) {
    const [show, setShow] = useState(false)
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        <input
          {...rest}
          ref={ref}
          type={show ? 'text' : 'password'}
          style={{ ...style, width: '100%', paddingRight: '2.5rem' }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          title={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          style={{
            position: 'absolute', right: '0.55rem', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
            display: 'inline-flex', alignItems: 'center', fontSize: '0.9rem',
          }}
        >
          <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
      </div>
    )
  }
)

export default PasswordInput

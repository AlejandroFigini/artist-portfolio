'use client'

/* Command bus del CMS — reemplaza el rol de despachador que tenía
   toast() en cms.js:L457 (llamaba a 13 funciones). Los componentes y
   el engine despachan comandos; CmsRoot renderiza el modal que toca. */

import { createContext } from 'react'

export type Command =
  | { type: 'login' }
  | { type: 'editText'; key: string }
  | { type: 'editMedia'; key: string }
  | { type: 'editInfo'; key: string }
  | { type: 'contentPicker'; key: string }
  | { type: 'repoPicker'; key: string }
  | { type: 'confirmMove'; key: string }
  | { type: 'carouselManager'; key?: string }
  | { type: 'projectsManager' }
  | { type: 'charactersManager' }
  | { type: 'auditPage' }
  | { type: 'export' }

export type Dispatch = (cmd: Command) => void

export const CommandContext = createContext<Dispatch>(() => {})

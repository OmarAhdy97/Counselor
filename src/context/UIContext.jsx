import { createContext, useContext } from 'react'

/** Page-independent actions: open a case, edit it, record a hearing, navigate. Provided by App. */
export const UIContext = createContext(null)
export const useUI = () => useContext(UIContext)

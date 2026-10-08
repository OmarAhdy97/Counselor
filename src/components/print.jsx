import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Prints just one document (a folder, a letter, a report) instead of the whole page.
 * Usage: const [print, PrintArea] = usePrint(); ... <PrintArea>{doc}</PrintArea>
 */
export function usePrint() {
  const [active, setActive] = useState(false)

  const print = useCallback(() => {
    setActive(true)
    document.body.classList.add('printing-report')
    const done = () => {
      document.body.classList.remove('printing-report')
      setActive(false)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }, [])

  const PrintArea = useCallback(
    ({ children }) => (active ? createPortal(<div className="print-report" dir="rtl">{children}</div>, document.body) : null),
    [active]
  )

  return [print, PrintArea]
}

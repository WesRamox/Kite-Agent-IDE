import { useEffect, useState } from 'react'

// Relógio que atualiza a cada `ms` enquanto `active` (para tempos em andamento).
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}

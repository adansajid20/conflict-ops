'use client'
import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 1200, delay = 0) {
  const [count, setCount] = useState(0)
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const timeout = setTimeout(() => {
      const startTime = performance.now()
      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.floor(eased * target))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, delay)
    return () => clearTimeout(timeout)
  }, [target, duration, delay])
  return count
}

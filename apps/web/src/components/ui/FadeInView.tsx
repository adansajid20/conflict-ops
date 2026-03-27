'use client'
import type React from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

export function FadeInView({ children, delay = 0, direction = 'up', className, }: { children: React.ReactNode; delay?: number; direction?: 'up' | 'down' | 'left' | 'none'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const variants = { hidden: { opacity: 0, y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0, x: direction === 'left' ? -20 : 0 }, visible: { opacity: 1, y: 0, x: 0 } }
  return <motion.div ref={ref} initial="hidden" animate={isInView ? 'visible' : 'hidden'} variants={variants} transition={{ duration: 0.4, delay, ease: [0.25,0.46,0.45,0.94] }} className={className}>{children}</motion.div>
}

export function StaggerChildren({ children, staggerDelay = 0.07, className, }: { children: React.ReactNode; staggerDelay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  return <motion.div ref={ref} initial="hidden" animate={isInView ? 'visible' : 'hidden'} variants={{ hidden: {}, visible: { transition: { staggerChildren: staggerDelay } } }} className={className}>{children}</motion.div>
}

export function StaggerItem({ children, className, style, }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <motion.div variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25,0.46,0.45,0.94] } } }} className={className} style={style}>{children}</motion.div>
}

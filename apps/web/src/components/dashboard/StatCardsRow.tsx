'use client'

import type React from 'react'
import { motion } from 'framer-motion'

export function StatCardsRow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {children}
    </motion.div>
  )
}

export function StatCardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
      }}
    >
      {children}
    </motion.div>
  )
}

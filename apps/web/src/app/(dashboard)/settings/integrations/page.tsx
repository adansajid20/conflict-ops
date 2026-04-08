import { motion } from 'framer-motion'
import { IntegrationsManager } from '@/components/settings/IntegrationsManager'
import { Zap } from 'lucide-react'

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    },
  },
}

export default function IntegrationsSettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-3">
          <Zap className="h-8 w-8 text-orange-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">Integrations</h1>
        </div>
        <p className="text-base text-white/60">Connect external services and tools to enhance your workflow</p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto"
      >
        <IntegrationsManager />
      </motion.div>
    </div>
  )
}

import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound } from 'lucide-react'

const KANBAN_COLS = [
  {
    id: 1, cards: [
      { id: 11, h: 80 }, { id: 12, h: 120 }, { id: 13, h: 90 }
    ]
  },
  {
    id: 2, cards: [
      { id: 21, h: 100 }, { id: 22, h: 85 }, { id: 23, h: 130 }
    ]
  },
  {
    id: 3, cards: [
      { id: 31, h: 110 }, { id: 32, h: 95 }, { id: 33, h: 80 }
    ]
  }
]

export default function AuthLayout() {
  const location = useLocation()
  const view = location.pathname.includes('register') ? 'register' : 'login'

  return (
    <div className="flex min-h-dvh bg-background overflow-hidden">
      {/* Left Panel: Anti-Gravity Background -> Jira Project Background */}
      <aside className="relative flex-1 hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#00251A] to-[#004D40] text-emerald-50">

        {/* Kanban Animated Background */}
        <div className="absolute inset-x-0 inset-y-10 pointer-events-none flex justify-center gap-6 opacity-30 select-none overflow-hidden">
          {KANBAN_COLS.map((col, colIdx) => (
            <div key={col.id} className="w-48 h-full flex flex-col gap-4 relative">
              <div className="w-20 h-5 rounded-md bg-white/40 mb-2" />
              <motion.div
                className="flex flex-col gap-4 relative"
                animate={{
                  y: [0, -100, 0]
                }}
                transition={{
                  duration: 20 + colIdx * 5,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {col.cards.map((card, cardIdx) => (
                  <motion.div
                    key={card.id}
                    style={{ height: card.h }}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col gap-2 shadow-lg"
                    animate={{ x: [0, 5, -5, 0] }}
                    transition={{
                      duration: 8 + cardIdx * 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: cardIdx
                    }}
                  >
                    <div className="w-3/4 h-3 rounded bg-white/30" />
                    <div className="w-1/2 h-3 rounded bg-white/20" />
                    <div className="mt-auto flex justify-between items-center">
                      <div className="w-6 h-6 rounded-full bg-teal-400/30" />
                      <div className="w-8 h-3 rounded bg-emerald-400/40" />
                    </div>
                  </motion.div>
                ))}
                {/* Duplicate for infinite effect */}
                {col.cards.map((card, cardIdx) => (
                  <motion.div
                    key={`dup-${card.id}`}
                    style={{ height: card.h }}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col gap-2 shadow-lg"
                    animate={{ x: [0, 5, -5, 0] }}
                    transition={{
                      duration: 8 + cardIdx * 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: cardIdx
                    }}
                  >
                    <div className="w-3/4 h-3 rounded bg-white/30" />
                    <div className="w-1/2 h-3 rounded bg-white/20" />
                    <div className="mt-auto flex justify-between items-center">
                      <div className="w-6 h-6 rounded-full bg-teal-400/30" />
                      <div className="w-8 h-3 rounded bg-emerald-400/40" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 p-10 flex flex-col h-full justify-between backdrop-blur-[2px]">
          <div className="flex items-center gap-3 w-fit p-1 rounded-xl glass-morphic">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-500/20 text-emerald-100 shadow-sm backdrop-blur-md border border-white/10">
              <KeyRound className="size-5" />
            </div>
            <div className="mr-3">
              <p className="text-sm font-semibold tracking-wide shadow-sm">Task Manager</p>
              <p className="text-xs text-emerald-100/70 font-medium">Plan. Build. Ship.</p>
            </div>
          </div>

          <div className="max-w-md mt-auto mb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: "circOut" }}
              >
                {view === 'login' ? (
                  <>
                    <h1 className="text-4xl sm:text-5xl font-bold font-sans tracking-tight mb-4 leading-tight">
                      Welcome back.<br />Let's pick up where you left off.
                    </h1>
                    <p className="text-lg text-emerald-100/70 font-medium mt-6">
                      Sign in to see your projects, track progress, and keep tasks moving.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-4xl sm:text-5xl font-bold font-sans tracking-tight mb-4 leading-tight">
                      Join the future.<br />Start building today.
                    </h1>
                    <p className="text-lg text-emerald-100/70 font-medium mt-6">
                      Create an account to manage your workflow with unprecedented clarity.
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex gap-2.5 z-10 relative">
            <div className={`transition-all duration-700 h-1.5 rounded-full ${view === 'login' ? 'w-24 bg-white/90' : 'w-10 bg-white/20'}`} />
            <div className={`transition-all duration-700 h-1.5 rounded-full ${view === 'register' ? 'w-24 bg-teal-400' : 'w-16 bg-white/40'}`} />
            <div className="h-1.5 w-10 rounded-full bg-white/10" />
          </div>
        </div>
      </aside>

      {/* Right Panel: Form Area */}
      <main className="w-full lg:w-[45%] flex items-center justify-center p-6 bg-white shrink-0 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: view === 'login' ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: view === 'login' ? 30 : -30 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full max-w-md"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

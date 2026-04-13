import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { useSession } from '@/lib/auth-client'
import InteractiveMockDashboard from '@/components/landing/InteractiveMockDashboard'
import { Button } from '@/components/ui/button'
import { FolderKanban, Zap, Layers, Lock, ArrowRight, Github, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  const { data: session, isPending } = useSession()

  const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVars: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden selection:bg-primary/30">
      {/* ── Top Navigation ── */}
      <nav className="fixed top-0 inset-x-0 z-50 px-4 md:px-8 py-4 backdrop-blur-md bg-background/60 border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <img src="/logo.png" alt="We Work IT Logo" className="size-8 object-contain transition-transform group-hover:scale-105 drop-shadow-md" />
            <span className="text-xl font-bold tracking-tight">We Work IT</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#about" className="text-foreground/70 hover:text-foreground transition-colors hover:cursor-pointer">
              About Us
            </a>
            <Link to="/docs" className="text-foreground/70 hover:text-foreground transition-colors">
              Documentation
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {!isPending && (
              session ? (
                <Button asChild className="rounded-full px-6 shadow-lg shadow-primary/25 group">
                  <Link to={(session.user as any).role === 'admin' ? "/admin/dashboard" : "/dashboard"}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" className="hidden sm:flex rounded-full">
                    <Link to="/register">Sign Up</Link>
                  </Button>
                  <Button asChild className="rounded-full px-6 shadow-lg shadow-primary/25">
                    <Link to="/login">Login</Link>
                  </Button>
                </>
              )
            )}
            {isPending && <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 md:px-8 overflow-hidden flex-1 flex flex-col justify-center">
        {/* Abstract Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-pulse duration-[10s]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/30 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            variants={containerVars}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center max-w-4xl mx-auto"
          >
            <motion.div variants={itemVars} className="mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider ring-1 ring-border/50 shadow-sm">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
                </span>
                Introducing Task Manager 2.0
              </span>
            </motion.div>

            <motion.h1 variants={itemVars} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
              Manage Work, <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
                Amplify Productivity.
              </span>
            </motion.h1>

            <motion.p variants={itemVars} className="text-lg md:text-xl text-foreground/60 mb-12 max-w-2xl leading-relaxed">
              We Work IT brings you the ultimate command center for all your projects. Streamline tasks, orchestrate sprints, and visualize dependencies effortlessly. 
            </motion.p>

            <motion.div variants={itemVars} className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
              <Button asChild size="lg" className="rounded-full shadow-xl shadow-primary/20 w-full sm:w-auto text-base px-8 h-12">
                <Link to={session ? ((session.user as any).role === 'admin' ? "/admin/dashboard" : "/dashboard") : "/register"}>
                  Get Started for Free
                  <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full w-full sm:w-auto text-base px-8 h-12 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50">
                <Link to="/docs">
                  Read the Docs
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Dashboard Preview (Interactive) ── */}
      <section className="relative px-4 pb-24 md:pb-32 hidden md:block">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="p-2 md:p-4 rounded-2xl md:rounded-[2rem] bg-gradient-to-b from-foreground/5 to-transparent border border-border/50 shadow-2xl backdrop-blur-sm"
          >
            <div className="rounded-xl overflow-hidden border border-border/40 bg-card rounded-t-xl shadow-inner aspect-[16/9] relative group">
              <InteractiveMockDashboard />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── About Us Section ── */}
      <section id="about" className="py-24 md:py-32 bg-muted/30 border-t border-border/40 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">About <span className="text-primary">We Work IT</span></h2>
              <p className="text-lg text-foreground/70 mb-6 leading-relaxed">
                Born out of the need for an intuitive, fast, and feature-rich task scheduling and project management system. We realized that existing tools were either too minimal or overly complex.
              </p>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                We bridge the gap. Giving teams the visual workflows—Gantt charts, interactive dependency maps, Kanban boards—without the steep learning curve.
              </p>

              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { icon: Zap, title: "Lightning Fast", desc: "Optimized for speed and minimal latency." },
                  { icon: Layers, title: "Powerful UI", desc: "Crafted with the best modern design principles." },
                  { icon: Lock, title: "Secure Data", desc: "Enterprise-level security combined with zero trust." },
                  { icon: Github, title: "Open Source", desc: "Community-driven integrations and transparency." }
                ].map((feature, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="shrink-0 mt-1 size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <feature.icon className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{feature.title}</h4>
                      <p className="text-sm text-foreground/60">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="aspect-square md:aspect-[4/3] bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-3xl border border-border/50 flex flex-col p-8 overflow-hidden relative shadow-xl backdrop-blur-sm">
                <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
                <FolderKanban className="size-20 md:size-32 text-primary/20 absolute -top-8 -right-8 -rotate-12" />
                <div className="mt-auto relative z-10">
                  <h3 className="text-2xl font-bold mb-2">Built for Teams.</h3>
                  <p className="text-foreground/70">Whether you're an indie developer or an agency, we scale with your ambitions.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-background border-t border-border/40 py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="We Work IT Logo" className="size-6 object-contain drop-shadow" />
            <span className="font-semibold">We Work IT</span>
          </div>
          <p className="text-sm text-foreground/50">
            &copy; {new Date().getFullYear()} We Work IT. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

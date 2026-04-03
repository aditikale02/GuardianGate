import { motion } from 'framer-motion';
import { Shield, GraduationCap, UserCheck, ArrowRight, Star, Zap, Lock, Moon, Sun, Heart, Play, Users, Bell, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Brand/Logo';
import hostelHero from '@/assets/hostel-hero.png';
import analyticsIllustration from '@/assets/analytics-illustration.png';
import studentIllustration from '@/assets/student-illustration.png';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '@/hooks/use-dark-mode';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

const roles = [
  { label: 'Student', icon: GraduationCap, desc: 'View attendance & scan QR', color: 'bg-peach', loginPath: '/login/student' },
  { label: 'Admin', icon: Shield, desc: 'Full system management', color: 'bg-blush', loginPath: '/login/admin' },
  { label: 'Warden', icon: UserCheck, desc: 'Monitor & manage hostel', color: 'bg-lavender', loginPath: '/login/warden' },
];

const features = [
  { icon: Zap, title: 'Problem Solving', desc: 'Automated tracking eliminates manual errors and lost records' },
  { icon: Lock, title: 'Security First', desc: 'QR-based gate entry with real-time verification and alerts', highlight: true },
  { icon: Users, title: 'Community Care', desc: 'Know when everyone is safe with instant status updates' },
  { icon: BarChart3, title: 'Smart Analytics', desc: 'Compliance reports and attendance insights at a glance' },
];

const stats = [
  { value: '3', label: 'Semesters', bg: 'bg-blush' },
  { value: '82', label: 'Students Helped', bg: 'bg-card' },
  { value: '28', label: 'Issues Solved', bg: 'bg-card' },
];

const progressBars = [
  { label: 'Attendance Tracking', value: 95, color: 'bg-primary' },
  { label: 'Security Coverage', value: 88, color: 'bg-accent' },
  { label: 'Response Time', value: 92, color: 'bg-primary' },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { isDark, toggle: toggleDark } = useDarkMode();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Logo size="md" />
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About Us</a>
              <a href="#access" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Access Portal</a>
            </div>
            <button
              onClick={toggleDark}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HERO — curved bg shape behind image, split layout  */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Large curved background shape */}
        <div className="absolute top-16 right-0 w-[55%] h-[90%] bg-blush rounded-l-[4rem] -z-10" />
        {/* Small decorative circles */}
        <div className="absolute top-28 left-[45%] h-4 w-4 rounded-full bg-primary/60" />
        <div className="absolute top-24 left-[48%] h-2.5 w-2.5 rounded-full bg-accent/40" />
        <div className="absolute bottom-24 right-16 h-5 w-5 rounded-full bg-primary" />
        <div className="absolute bottom-20 right-24 h-3 w-3 rounded-full bg-accent/50" />
        {/* Sparkle shapes */}
        <div className="absolute top-32 left-[42%] text-primary/40 text-2xl">✦</div>

        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight text-foreground">
              Your Safety is
              <br />
              What Makes Us
              <br />
              <span className="text-primary italic">GuardianGate</span>
            </h1>
            <p className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
              Modern attendance tracking, QR-based gate management, and real-time monitoring — built by students who lived through the chaos.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Button
                size="lg"
                className="rounded-full px-8 shadow-soft"
                onClick={() => document.getElementById('access')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get Started
              </Button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-foreground/20 hover:border-primary transition-colors">
                  <Play className="h-4 w-4 ml-0.5" />
                </span>
                Learn More
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center"
          >
            <div className="relative">
              <div className="rounded-[2.5rem] overflow-hidden bg-peach/40 p-2">
                <img src={hostelHero} alt="GuardianGate Hostel" className="rounded-[2rem] w-full max-w-md object-cover" />
              </div>
              {/* Dot grid decoration */}
              <div className="absolute -bottom-6 -right-6 grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-2.5 w-2.5 rounded-full bg-primary/30" />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ABOUT US — image left, text + stats right          */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="about" className="py-24 px-6 relative">
        {/* Faint watermark text */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 font-display text-[8rem] font-bold text-muted/30 select-none pointer-events-none leading-none hidden md:block">
          About Us
        </div>

        <div className="container mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="relative"
          >
            {/* Curved peach background behind image */}
            <div className="absolute inset-0 bg-peach rounded-[3rem] -rotate-3 scale-105" />
            <div className="relative rounded-[2.5rem] overflow-hidden">
              <img src={studentIllustration} alt="Hostel students" className="w-full object-cover rounded-[2.5rem]" />
            </div>
            {/* Decorative circle */}
            <div className="absolute -bottom-4 -left-4 h-6 w-6 rounded-full bg-primary" />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Welcome To <span className="text-primary">GuardianGate</span>
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Born out of real frustration. As three hostel residents, we lived through the chaos of manual 
              attendance registers, lost visitor logs, and late-night security gaps. Instead of complaining, 
              we built something that actually works — from missed curfew records to the anxiety of not 
              knowing if a friend made it back safely.
            </p>
            <div className="mt-8 flex gap-4">
              {stats.map((s, i) => (
                <div key={i} className={`rounded-2xl ${s.bg} px-6 py-4 text-center shadow-card flex-1`}>
                  <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FEATURES — card grid, one highlighted               */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 relative">
        <div className="absolute top-12 left-1/2 -translate-x-1/2 font-display text-[7rem] font-bold text-muted/20 select-none pointer-events-none leading-none hidden md:block">
          Our Services
        </div>

        <div className="container mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              We Can Help <span className="text-primary">Transform</span> Your Hostel
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
                whileHover={{ y: -8 }}
                className={`rounded-3xl p-7 text-center transition-all cursor-default ${
                  f.highlight
                    ? 'bg-blush shadow-hover ring-1 ring-primary/10'
                    : 'bg-card shadow-card'
                }`}
              >
                <div className={`mx-auto rounded-2xl p-4 w-fit ${f.highlight ? 'bg-primary/15' : 'bg-muted'}`}>
                  <f.icon className={`h-7 w-7 ${f.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                <button className={`mt-5 text-sm font-medium inline-flex items-center gap-1 ${f.highlight ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} transition-colors`}>
                  Learn More <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* EXPERTISE — progress bars + image, alternating      */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="py-24 px-6 relative">
        <div className="absolute top-12 left-1/2 -translate-x-1/2 font-display text-[7rem] font-bold text-muted/20 select-none pointer-events-none leading-none hidden md:block">
          Expertise
        </div>

        <div className="container mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground italic">
              Proving Our <span className="text-primary">Expertise</span>
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              We've tested every feature in real hostel environments. From gate management to 
              emergency alerts, our system has been refined through actual daily use.
            </p>
            <div className="mt-8 space-y-5">
              {progressBars.map((bar) => (
                <div key={bar.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-foreground">{bar.label}</span>
                    <span className="text-muted-foreground">{bar.value}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${bar.value}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${bar.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-8 rounded-full px-8" onClick={() => document.getElementById('access')?.scrollIntoView({ behavior: 'smooth' })}>
              Get Started
            </Button>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="relative flex justify-center"
          >
            <div className="absolute inset-0 bg-blush rounded-[3rem] rotate-2 scale-105" />
            <div className="relative rounded-[2.5rem] overflow-hidden">
              <img src={analyticsIllustration} alt="Analytics dashboard" className="w-full object-cover rounded-[2.5rem]" />
            </div>
            {/* Dots */}
            <div className="absolute -top-4 -right-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-2.5 w-2.5 rounded-full bg-primary/40" />
              ))}
            </div>
            <div className="absolute -bottom-3 right-8 h-5 w-5 rounded-full bg-primary" />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ACCESS PORTAL                                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="access" className="py-24 px-6 bg-muted/50">
        <div className="container mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Access Portal
            </h2>
            <p className="mt-4 text-muted-foreground">Select your role to enter the dashboard</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {roles.map((r, i) => (
              <motion.button
                key={r.label}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
                whileHover={{ y: -8, boxShadow: 'var(--shadow-hover)' }}
                onClick={() => navigate(r.loginPath)}
                className={`rounded-3xl ${r.color} p-8 text-center shadow-card transition-all cursor-pointer group`}
              >
                <div className="mx-auto rounded-2xl bg-card p-4 w-fit shadow-soft group-hover:scale-110 transition-transform">
                  <r.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{r.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Login <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              className="rounded-full px-8"
              onClick={() => navigate('/signup/admin')}
            >
              Admin Sign-Up
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TEAM                                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 rounded-full bg-blush px-4 py-1.5 text-xs font-semibold text-blush-foreground mb-6">
              <Heart className="h-3 w-3" /> Our Team
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Built by Students, for Students
            </h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
            className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {[
              { name: 'Student 1', focus: 'Frontend & Design', bg: 'bg-peach' },
              { name: 'Student 2', focus: 'Backend & APIs', bg: 'bg-blush' },
              { name: 'Student 3', focus: 'Database & Security', bg: 'bg-lavender' },
            ].map((member) => (
              <div key={member.name} className={`rounded-3xl ${member.bg} p-7 shadow-card`}>
                <div className="mx-auto h-16 w-16 rounded-full bg-card flex items-center justify-center shadow-soft mb-4">
                  <span className="font-display text-xl font-bold text-primary">
                    {member.name.split(' ').map(w => w[0]).join('')}
                  </span>
                </div>
                <h4 className="font-display font-semibold text-foreground">{member.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{member.focus}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground">
            © 2026 GuardianGate — Made with <Heart className="inline h-3 w-3 text-primary" /> by three hostel students.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

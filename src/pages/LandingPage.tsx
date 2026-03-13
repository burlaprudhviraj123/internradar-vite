import { Link } from 'react-router-dom';
import { ArrowRight, Smartphone, Brain, BarChart2, Bell, Shield, CheckCircle2, Zap, Database, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const HIGHLIGHTS = [
  { icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-500/10', title: 'Android Reads Notifications', desc: 'WhatsApp, Telegram & Email messages are captured automatically — no manual input.' },
  { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10', title: 'AI Extracts & Validates', desc: 'Groq AI pulls company, role, deadline & link. Fake URLs and duplicates are blocked instantly.' },
  { icon: BarChart2, color: 'text-indigo-500', bg: 'bg-indigo-500/10', title: 'Smart Dashboard', desc: 'Filter by skills, track status, get deadline alerts, and match opportunities to your resume.' },
];

const FLOW = [
  { icon: Smartphone, step: '01', label: 'Notification arrives (WhatsApp / Telegram / Email)' },
  { icon: Brain,      step: '02', label: 'Groq AI extracts company, role, deadline & link' },
  { icon: Shield,     step: '03', label: 'Link validated · duplicates removed · data stored in Firebase' },
  { icon: Bell,       step: '04', label: 'Deadline alert sent · add to Google Calendar' },
  { icon: CheckCircle2, step: '05', label: 'Dashboard shows your full internship pipeline' },
];

export function LandingPage() {
  const { user } = useAuth();
  const cta = user
    ? <Link to="/dashboard" className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:-translate-y-0.5">Open Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link>
    : <Link to="/dashboard" className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:-translate-y-0.5">Try the Demo <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link>;

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <Zap className="w-3.5 h-3.5" /> Hackathon Prototype · InternRadar / Remember Me
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-5 leading-tight">
            Never Miss an<br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">Internship Again.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            InternRadar listens to your WhatsApp, Telegram & Email notifications, uses AI to extract internship details, and organises everything into a smart dashboard — automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {cta}
            <Link to="/analytics" className="inline-flex items-center gap-2 border border-border bg-card px-8 py-4 rounded-xl font-semibold text-lg hover:border-primary/40 hover:bg-muted transition-all">
              View Analytics
            </Link>
          </div>
        </div>
      </section>

      {/* 3 highlights */}
      <section className="container mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="bg-card border rounded-2xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className={`w-11 h-11 ${bg} ${color} rounded-xl flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-muted/30 py-16">
        <div className="container mx-auto px-6 max-w-2xl">
          <h2 className="text-2xl font-black text-center mb-8">How It Works</h2>
          <div className="space-y-3">
            {FLOW.map(({ icon: Icon, step, label }) => (
              <div key={step} className="flex items-center gap-4 bg-card border rounded-xl px-5 py-3.5 hover:border-primary/30 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-primary mr-1">{step}</span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-10 text-center text-white shadow-2xl">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Built for 24-hour Hackathon</h2>
          <p className="text-blue-100 mb-7 max-w-md mx-auto text-sm">Android + Groq AI + Firebase + React. Paste any internship message and watch AI extract it in under 2 seconds.</p>
          {cta}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">InternRadar · Remember Me</span>
        </div>
        <div className="flex items-center justify-center gap-5 mt-2">
          {[['Dashboard', '/dashboard'], ['Analytics', '/analytics'], ['Profile', '/profile']].map(([l, to]) => (
            <Link key={to} to={to} className="hover:text-primary transition-colors">{l}</Link>
          ))}
          <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
            <Globe className="w-3 h-3" /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PasteArea } from '@/components/features/PasteArea';
import { OpportunityCard } from '@/components/features/OpportunityCard';
import { ProfilePage } from '@/components/features/ProfileSection';
import { RecommendedSources } from '@/components/features/RecommendedSources';
import { Navbar } from '@/components/layout/Navbar';
import { LandingPage } from '@/pages/LandingPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { subscribeToOpportunities, updateOpportunityStatus, markUrgencyEmailSent, isConfigured } from '@/lib/firebase';
import { evaluateMatch } from '@/lib/llm';
import { sendUrgencyEmail } from '@/lib/email';
import type { Opportunity } from '@/types';
import { AlertCircle, LogIn, BarChart2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isToday, isThisWeek, isThisMonth, isTomorrow, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

// ─── Section header helper ────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-bold tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

// ─── Protected route wrapper ─────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, sendOtp, verifyOtp, error: authError } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  if (authLoading) return (
    <div className="flex justify-center items-center h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setIsProcessing(true);
    await sendOtp(phoneNumber);
    if (!authError) setStep(2);
    setIsProcessing(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setIsProcessing(true);
    await verifyOtp(otpCode);
    setIsProcessing(false);
  };

  if (!user) return (
    <div className="container mx-auto py-20 px-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-card border rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">📱</div>
        <h2 className="text-2xl font-bold mb-2">Sign in via SMS</h2>
        <p className="text-muted-foreground mb-8 text-sm">Track and manage your internship opportunities securely.</p>
        
        {authError && (
          <div className="mb-6 px-4 py-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{authError}</p>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input
              type="tel"
              placeholder="Phone Number (e.g. +91...)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              required
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors py-3 px-6 rounded-xl font-semibold shadow-sm disabled:opacity-70"
            >
              {isProcessing ? "Sending OTP..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <input
              type="text"
              placeholder="6-digit OTP Code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-center tracking-[0.5em] text-lg"
              required
              disabled={isProcessing}
              maxLength={6}
            />
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors py-3 px-6 rounded-xl font-semibold shadow-sm disabled:opacity-70"
            >
              <LogIn className="w-5 h-5 shrink-0" />
              {isProcessing ? "Verifying..." : "Sign In"}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-muted-foreground hover:text-foreground mt-2"
              disabled={isProcessing}
            >
              Use a different phone number
            </button>
          </form>
        )}
        <div id="recaptcha-container" className="mt-4 flex justify-center"></div>
      </div>
    </div>
  );
  return <>{children}</>;
}

// ─── Main dashboard content ──────────────────────────────────────────────────
function DashboardContent({ opportunities, loading, dbError, evaluating, userProfile }: any) {
  const [filterStatus, setFilterStatus] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [sortBy, setSortBy] = useState('Deadline (Closest)');

  const displayedOpportunities = opportunities
    .filter((opp: Opportunity) => filterStatus === 'All' || opp.status === filterStatus)
    .filter((opp: Opportunity) => {
      if (dateFilter === 'All Time') return true;
      if (!opp.createdAt) return true;
      try {
        const date = opp.createdAt.toDate ? opp.createdAt.toDate() : new Date(opp.createdAt);
        if (dateFilter === 'Today') return isToday(date);
        if (dateFilter === 'This Week') return isThisWeek(date);
        if (dateFilter === 'This Month') return isThisMonth(date);
      } catch { return true; }
      return true;
    })
    .sort((a: Opportunity, b: Opportunity) => {
      if (sortBy === 'Company (A-Z)') return a.companyName.localeCompare(b.companyName);
      if (sortBy === 'Deadline (Closest)') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        const dA = new Date(a.deadline).getTime();
        const dB = new Date(b.deadline).getTime();
        if (isNaN(dA)) return 1;
        if (isNaN(dB)) return -1;
        return dA - dB;
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-muted/20">
      {/* ┌── Page Header ──────────────────────────────────────────────────── */}
      <div className="border-b bg-card px-6 py-5 shadow-sm">
        <div className="container mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your internship pipeline at a glance</p>
          </div>
          {evaluating && (
            <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-semibold animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              Evaluating Matches...
            </span>
          )}
        </div>
      </div>

      {/* ┌── Body: Sidebar + Main ─────────────────────────────────────────── */}
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* Left Sticky Sidebar */}
          <aside className="w-[320px] shrink-0 hidden lg:flex flex-col gap-4 sticky top-[96px]">
            {/* Add Opportunity */}
            <div className="bg-card border rounded-2xl shadow-sm">
              <div className="px-5 pt-5 pb-1">
                <SectionHeader title="Add Opportunity" />
                <p className="text-xs text-muted-foreground mb-4 -mt-1 leading-relaxed">
                  Paste a WhatsApp / Telegram message or drop a job URL — AI extracts everything automatically.
                </p>
              </div>
              <div className="px-5 pb-5">
                <PasteArea existingOpportunities={opportunities} />
              </div>
            </div>

            {/* Discover */}
            <div className="bg-card border rounded-2xl shadow-sm">
              <div className="px-5 pt-4 pb-1">
                <SectionHeader title="Discover Opportunities" />
              </div>
              <div className="pb-3">
                <RecommendedSources userProfile={userProfile} existingOpportunities={opportunities} />
              </div>
            </div>

            {/* Quick nav to Analytics */}
            <Link
              to="/analytics"
              className="group flex items-center justify-between bg-gradient-to-r from-primary/8 to-indigo-500/8 border border-primary/20 rounded-2xl px-5 py-4 hover:border-primary/40 hover:from-primary/15 hover:to-indigo-500/15 transition-all"
            >
              <div>
                <p className="font-semibold text-sm">Analytics Dashboard</p>
                <p className="text-xs text-muted-foreground mt-0.5">Charts, trends &amp; match rate</p>
              </div>
              <BarChart2 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform shrink-0" />
            </Link>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 min-w-0 space-y-4">
            {/* Mobile-only: Add box */}
            <div className="lg:hidden bg-card border rounded-2xl p-5 shadow-sm">
              <SectionHeader title="Add Opportunity" />
              <p className="text-xs text-muted-foreground mb-4 -mt-1">Paste a message or URL to extract with AI.</p>
              <PasteArea existingOpportunities={opportunities} />
            </div>

            {/* Radar Panel */}
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
              {/* Panel header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b bg-muted/30">
                <SectionHeader title="Your Radar" count={displayedOpportunities.length} />

                {/* Clean filter row */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="text-xs border border-border bg-background rounded-lg px-3 py-1.5 font-medium outline-none cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Saved">Saved</option>
                    <option value="Applied">Applied</option>
                    <option value="Interview">Interview</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <select
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="text-xs border border-border bg-background rounded-lg px-3 py-1.5 font-medium outline-none cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <option value="All Time">All Time</option>
                    <option value="Today">Today</option>
                    <option value="This Week">This Week</option>
                    <option value="This Month">This Month</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="text-xs border border-border bg-background rounded-lg px-3 py-1.5 font-medium outline-none cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <option value="Date Added">Date Added</option>
                    <option value="Deadline (Closest)">Deadline ↑</option>
                    <option value="Company (A-Z)">Company A–Z</option>
                  </select>
                </div>
              </div>

              {/* Panel body */}
              <div className="p-5">
                {dbError ? (
                  <div className="flex flex-col items-center text-center py-16 text-destructive">
                    <AlertCircle className="w-10 h-10 mb-3 opacity-70" />
                    <h3 className="font-bold mb-1">Connection Error</h3>
                    <p className="text-sm text-muted-foreground">{dbError}</p>
                  </div>
                ) : loading ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-16 border-2 border-dashed border-border rounded-xl">
                    <div className="text-5xl mb-4">📡</div>
                    <h3 className="font-bold text-lg mb-1">Your radar is empty</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mt-1">
                      Paste a WhatsApp message or job URL in the sidebar to add your first opportunity.
                    </p>
                  </div>
                ) : displayedOpportunities.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-12 border-2 border-dashed border-border rounded-xl">
                    <div className="text-4xl mb-3">🔍</div>
                    <h3 className="font-semibold">No results</h3>
                    <p className="text-sm text-muted-foreground mt-1">Try a different status or date range.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {displayedOpportunities.map((opp: Opportunity) => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        onStatusChange={async (id: string, status: string) => updateOpportunityStatus(id, status)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const { user, userProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user) {
      setLoading(true);
      const unsubscribe = subscribeToOpportunities(
        user.uid,
        async (data) => {
          setDbError(null);
          if (!userProfile) { setOpportunities(data); setLoading(false); return; }
          setEvaluating(true);
          const evaluatedData = await Promise.all(
            data.map(async (opp) => {
              if (opp.matchStatus) return opp;
              const matchResults = await evaluateMatch(opp, userProfile);
              return { ...opp, ...matchResults };
            })
          );
          setOpportunities(evaluatedData);
          setLoading(false);
          setEvaluating(false);
        },
        (error) => { setDbError(error.message); setLoading(false); }
      );
      return () => unsubscribe();
    } else {
      setOpportunities([]);
    }
  }, [user, userProfile]);

  // Urgency email cron
  useEffect(() => {
    if (!user || opportunities.length === 0) return;
    opportunities.forEach(async (opp) => {
      if (opp.urgencyEmailSent) return;
      if (opp.status !== 'Saved' && opp.status !== 'Interview') return;
      if (!opp.deadline || !opp.id) return;
      try {
        const date = parseISO(opp.deadline);
        if (isTomorrow(date)) {
          const success = await sendUrgencyEmail(
            user.email || '', user.displayName || 'Applicant',
            opp.companyName, opp.role, opp.deadline, opp.applicationLink || ''
          );
          if (success) await markUrgencyEmailSent(opp.id);
        }
      } catch { /* silent */ }
    });
  }, [opportunities, user]);

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col">
      {!isConfigured && (
        <div className="bg-destructive/15 border-b border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2 px-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Missing API keys. Copy <code>.env.example</code> to <code>.env</code> and restart.
        </div>
      )}
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={
            <RequireAuth>
              <DashboardContent
                opportunities={opportunities}
                loading={loading}
                dbError={dbError}
                evaluating={evaluating}
                userProfile={userProfile}
              />
            </RequireAuth>
          } />
          <Route path="/analytics" element={
            <RequireAuth>
              <AnalyticsPage opportunities={opportunities} />
            </RequireAuth>
          } />
          <Route path="/profile" element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;

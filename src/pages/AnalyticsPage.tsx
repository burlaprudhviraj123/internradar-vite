import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Target, Clock, CheckCircle2, XCircle, Bookmark, MessagesSquare } from 'lucide-react';
import type { Opportunity } from '@/types';
import { parseISO, format, addDays, isAfter, isBefore } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  Saved: '#6366f1',
  Applied: '#3b82f6',
  Interview: '#10b981',
  Rejected: '#ef4444',
};

interface AnalyticsPageProps {
  opportunities: Opportunity[];
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card border rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
      </div>
    </div>
  );
}

export function AnalyticsPage({ opportunities }: AnalyticsPageProps) {
  // Status breakdown for pie chart
  const statusCounts = opportunities.reduce((acc, opp) => {
    acc[opp.status] = (acc[opp.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Weekly activity: group by week
  const weeklyMap: Record<string, number> = {};
  opportunities.forEach(opp => {
    if (!opp.createdAt) return;
    try {
      const date = opp.createdAt.toDate ? opp.createdAt.toDate() : new Date(opp.createdAt);
      const week = format(date, 'MMM dd');
      weeklyMap[week] = (weeklyMap[week] || 0) + 1;
    } catch { /* skip */ }
  });
  const weeklyData = Object.entries(weeklyMap)
    .slice(-7)
    .map(([date, count]) => ({ date, count }));

  // Match rate
  const eligible = opportunities.filter(o => o.matchStatus === 'Eligible').length;
  const ineligible = opportunities.filter(o => o.matchStatus === 'Ineligible').length;
  const evaluated = eligible + ineligible;
  const eligiblePct = evaluated > 0 ? Math.round((eligible / evaluated) * 100) : 0;

  // Upcoming deadlines in next 14 days
  const now = new Date();
  const upcoming = opportunities
    .filter(opp => {
      if (!opp.deadline) return false;
      try {
        const d = parseISO(opp.deadline);
        return isAfter(d, now) && isBefore(d, addDays(now, 14));
      } catch { return false; }
    })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  const applied = statusCounts['Applied'] || 0;
  const interviews = statusCounts['Interview'] || 0;
  const rejected = statusCounts['Rejected'] || 0;

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black mb-1">Analytics Dashboard</h1>
        <p className="text-muted-foreground">A real-time view of your internship pipeline.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bookmark} label="Total Tracked" value={opportunities.length} color="bg-indigo-500/10 text-indigo-500" />
        <StatCard icon={CheckCircle2} label="Applied" value={applied} color="bg-blue-500/10 text-blue-500" />
        <StatCard icon={MessagesSquare} label="Interviewing" value={interviews} color="bg-green-500/10 text-green-500" />
        <StatCard icon={XCircle} label="Rejected" value={rejected} color="bg-red-500/10 text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart — Status Breakdown */}
        <div className="bg-card border rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Status Breakdown
          </h2>
          {pieData.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">No data yet — add some opportunities!</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar Chart — Weekly Activity */}
        <div className="bg-card border rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Weekly Activity
          </h2>
          {weeklyData.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">No date data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Opportunities" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Match Rate */}
        <div className="bg-card border rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> AI Match Rate
          </h2>
          {evaluated === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Upload your resume to see match results.</div>
          ) : (
            <div className="space-y-5 pt-2">
              <div>
                <div className="flex justify-between text-sm font-medium mb-2">
                  <span className="text-green-600">✅ Eligible</span>
                  <span>{eligible} ({eligiblePct}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${eligiblePct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm font-medium mb-2">
                  <span className="text-red-500">❌ Ineligible</span>
                  <span>{ineligible} ({100 - eligiblePct}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full transition-all duration-500" style={{ width: `${100 - eligiblePct}%` }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{evaluated} of {opportunities.length} opportunities evaluated.</p>
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-card border rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Upcoming Deadlines
            <span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full ml-1">Next 14 days</span>
          </h2>
          {upcoming.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No upcoming deadlines in the next 14 days. 🎉</div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(opp => {
                const daysLeft = Math.ceil((new Date(opp.deadline!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={opp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                    <div>
                      <div className="font-semibold text-sm">{opp.role}</div>
                      <div className="text-xs text-muted-foreground">{opp.companyName}</div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${daysLeft <= 2 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                      {daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow!' : `${daysLeft} days`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

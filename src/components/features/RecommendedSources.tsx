import { useEffect, useState } from 'react';
import { ExternalLink, Sparkles, Plus, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { UserProfile } from '@/types';
import { subscribeToGlobalOpportunities, saveOpportunity } from '@/lib/firebase';
import { evaluateMatch } from '@/lib/llm';
import { useAuth } from '@/contexts/AuthContext';

// Map profile major to domain tags for Firestore filtering
function getTagsFromMajor(major?: string): string[] {
  if (!major) return ['cs', 'tech'];
  const m = major.toLowerCase();
  if (m.includes('civil')) return ['civil', 'engineering'];
  if (m.includes('mechanical') || m.includes('mech')) return ['mechanical', 'engineering'];
  if (m.includes('electrical') || m.includes('eee')) return ['electrical', 'engineering'];
  if (m.includes('design')) return ['design'];
  if (m.includes('mba') || m.includes('management') || m.includes('business')) return ['management', 'business'];
  if (m.includes('computer') || m.includes('cs') || m.includes('it') || m.includes('software') || m.includes('information')) return ['cs', 'tech'];
  return ['cs', 'tech'];
}

interface RecommendedSourcesProps {
  userProfile?: UserProfile | null;
  existingOpportunities?: { companyName: string; role: string }[];
}

export function RecommendedSources({ userProfile, existingOpportunities = [] }: RecommendedSourcesProps) {
  const { user } = useAuth();
  const [liveOpps, setLiveOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hasLiveData, setHasLiveData] = useState(false);
  // Per-card rejection reason: id -> reason string
  const [rejections, setRejections] = useState<Record<string, string>>({});

  const domainTags = getTagsFromMajor(userProfile?.major);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToGlobalOpportunities(
      domainTags,
      (opps) => {
        setLiveOpps(opps);
        setHasLiveData(opps.length > 0);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userProfile?.major]);

  const handleAddToRadar = async (opp: any) => {
    if (!user) return;
    setSavingId(opp.id);
    // Clear any previous rejection for this card
    setRejections(prev => { const n = { ...prev }; delete n[opp.id]; return n; });

    try {
      const oppPayload = {
        companyName: opp.companyName || 'Unknown',
        role: opp.role || 'Unknown Role',
        deadline: opp.deadline || null,
        eligibility: opp.eligibility || [],
        applicationLink: opp.applicationLink || '',
        requiredDocuments: [] as string[],
        userId: user.uid,
        status: 'Saved' as const,
        createdAt: new Date() as any,
      };

      // ✅ Run the same eligibility gate as PasteArea
      if (userProfile) {
        const matchResults = await evaluateMatch(oppPayload, userProfile);
        if (matchResults.matchStatus === 'Ineligible') {
          setRejections(prev => ({ ...prev, [opp.id]: matchResults.matchReasoning }));
          setSavingId(null);
          return; // Block the save
        }
        oppPayload.status = 'Saved';
        (oppPayload as any).matchStatus = matchResults.matchStatus;
        (oppPayload as any).matchReasoning = matchResults.matchReasoning;
      }

      await saveOpportunity(oppPayload);
      setSavedIds(prev => new Set(prev).add(opp.id));
    } catch (e) {
      console.error("Failed to add global opportunity to radar:", e);
    } finally {
      setSavingId(null);
    }
  };

  // Static fallback links when scraper hasn't run yet
  const STATIC_SOURCES = [
    { name: 'Internshala', url: 'https://internshala.com/internships', badge: '🇮🇳' },
    { name: 'Unstop', url: 'https://unstop.com/internships', badge: '⚡' },
    { name: 'Greenhouse Boards', url: 'https://boards.greenhouse.io/figma', badge: '🏢' },
    { name: 'Google Careers', url: 'https://careers.google.com/students/', badge: '🏆' },
    { name: 'LinkedIn Internships', url: 'https://www.linkedin.com/jobs/internship-jobs/', badge: '💼' },
    { name: 'Naukri Campus', url: 'https://campus.naukri.com/', badge: '🇮🇳' },
  ];

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold">Discover Opportunities</h2>
        </div>
        {hasLiveData && (
          <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
            🟢 Live Feed
          </span>
        )}
      </div>

      {userProfile?.major && (
        <p className="text-xs text-muted-foreground mb-3 bg-primary/5 border border-primary/10 rounded-md px-3 py-2">
          Matched to your major: <span className="font-semibold text-primary">{userProfile.major}</span>
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center gap-2 justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading live opportunities...
        </div>
      )}

      {/* Live Firestore data */}
      {!loading && hasLiveData && (
        <div className="flex flex-col gap-2">
          {liveOpps.map((opp) => {
            const alreadySaved = savedIds.has(opp.id) || existingOpportunities.some(
              e => e.companyName?.toLowerCase() === opp.companyName?.toLowerCase() && e.role?.toLowerCase() === opp.role?.toLowerCase()
            );
            return (
              <div key={opp.id} className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2 p-3 rounded-lg border bg-muted/30 hover:bg-primary/5 hover:border-primary/20 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-sm group-hover:text-primary transition-colors leading-tight line-clamp-1">{opp.role}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opp.companyName}</p>
                    {opp.deadline && <p className="text-[11px] text-orange-500 mt-0.5 font-medium">🗓 {opp.deadline}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {opp.applicationLink && (
                      <a href={opp.applicationLink} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-muted transition-colors" title="Open Link">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    )}
                    {user && (
                      <button
                        onClick={() => handleAddToRadar(opp)}
                        disabled={savingId === opp.id || alreadySaved}
                        className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors disabled:opacity-40"
                        title={alreadySaved ? "Already on Radar" : "Add to Radar"}
                      >
                        {savingId === opp.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : alreadySaved
                          ? <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                          : <Plus className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>
                </div>
                {/* Show inline rejection reason if ineligible */}
                {rejections[opp.id] && (
                  <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{rejections[opp.id]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback static source links when scraper hasn't pushed data yet */}
      {!loading && !hasLiveData && (
        <>
          <p className="text-xs text-muted-foreground mb-2 italic">
            🔧 No live data yet — run the Python scraper to populate this feed.
          </p>
          <div className="flex flex-col gap-2">
            {STATIC_SOURCES.map(src => (
              <a key={src.url} href={src.url} target="_blank" rel="noreferrer"
                className="group flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30 hover:bg-primary/5 hover:border-primary/20 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{src.badge}</span>
                  <span className="font-semibold text-sm group-hover:text-primary transition-colors">{src.name}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
              </a>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Copy job text from these boards and paste it in the analyzer above!
          </p>
        </>
      )}
    </div>
  );
}

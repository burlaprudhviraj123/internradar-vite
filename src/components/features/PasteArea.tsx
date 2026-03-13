import { useState, useEffect, useRef } from 'react';
import { extractOpportunity, evaluateMatch } from '@/lib/llm';
import type { Opportunity } from '@/types';
import { Brain, Loader2, Save, X, AlertTriangle, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { saveOpportunity } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

const SCRAPER_API = 'http://localhost:5001';

interface PasteAreaProps {
  onSaved?: () => void;
  existingOpportunities?: Opportunity[];
}

export function PasteArea({ onSaved, existingOpportunities = [] }: PasteAreaProps) {
  const { userProfile } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Analyzing with AI...');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Opportunity | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [urlTrust, setUrlTrust] = useState<{ trust: string; reason: string } | null>(null);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-validate URL 600ms after user stops typing
  useEffect(() => {
    const trimmed = text.trim();
    // Detect with or without https:// (e.g. bit.ly/abc or https://bit.ly/abc)
    let urlToCheck = trimmed;
    if (!/^https?:\/\//i.test(trimmed) && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)/.test(trimmed)) {
      urlToCheck = 'https://' + trimmed;
    }
    let isUrl = false;
    try { new URL(urlToCheck); isUrl = true; } catch {}

    if (!isUrl) {
      setUrlTrust(null);
      return;
    }

    if (validateTimer.current) clearTimeout(validateTimer.current);
    setUrlTrust({ trust: 'checking', reason: 'Checking link...' });

    validateTimer.current = setTimeout(async () => {
      try {
        const urlToValidate = /^https?:\/\//i.test(text.trim()) ? text.trim() : 'https://' + text.trim();
        const res = await fetch(`${SCRAPER_API}/validate?url=${encodeURIComponent(urlToValidate)}`);
        const data = await res.json();
        setUrlTrust(data);
      } catch {
        // API not running — silently skip trust check
        setUrlTrust(null);
      }
    }, 600);

    return () => { if (validateTimer.current) clearTimeout(validateTimer.current); };
  }, [text]);

  const handleAnalyze = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please paste a message or URL first.');
      return;
    }
    
    setLoading(true);
    setError('');
    setRejectionReason('');

    // Detect with or without https://
    let normalizedUrl = trimmed;
    if (!/^https?:\/\//i.test(trimmed) && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      normalizedUrl = 'https://' + trimmed;
    }
    let isUrl = false;
    try { new URL(normalizedUrl); isUrl = true; } catch {}

    let contentToAnalyze = trimmed;

    if (isUrl) {
      setLoadingLabel('Scraping page...');
      try {
        const res = await fetch(`${SCRAPER_API}/scrape?url=${encodeURIComponent(normalizedUrl)}`);
        if (!res.ok) throw new Error('Scraper API error');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        contentToAnalyze = `${data.text}\n\nSource URL: ${normalizedUrl}`;
      } catch (e: any) {
        setError(
          e.message?.includes('fetch') || e.message?.includes('Failed')
            ? '⚠️ Scraper API is not running. Open a new terminal and run: cd scraper && python3 api.py'
            : `Failed to scrape URL: ${e.message}`
        );
        setLoading(false);
        setLoadingLabel('Analyzing with AI...');
        return;
      }
    }

    setLoadingLabel('Analyzing with AI...');

    try {
      const parsedData = await extractOpportunity(contentToAnalyze);
      // Guard: if AI couldn't extract a real company or role, reject it
      const UNKNOWN_VALS = ['unknown', 'not specified', 'unspecified', '', null, undefined];
      const hasCompany = parsedData?.companyName && !UNKNOWN_VALS.includes(String(parsedData.companyName).toLowerCase().trim());
      const hasRole = parsedData?.role && !UNKNOWN_VALS.includes(String(parsedData.role).toLowerCase().trim());

      if (!parsedData || !hasCompany || !hasRole) {
        setError('Could not extract a valid internship opportunity from this content. Try pasting a direct single-job page link or the raw job description text.');
        setLoading(false);
        return;
      }

      // Duplicate check (parsedData is guaranteed non-null here)
      const getWords = (str: any) => String(str ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const calculateSimilarity = (str1: string, str2: string) => {
        const w1 = getWords(str1);
        const w2 = getWords(str2);
        if (w1.length === 0 && w2.length === 0) return 1;
        const intersection = w1.filter(w => w2.some(w2Word => w2Word.includes(w) || w.includes(w2Word)));
        return intersection.length / Math.max(w1.length, w2.length);
      };

      const isDuplicate = existingOpportunities.some(opp => {
        const companySim = calculateSimilarity(opp.companyName, parsedData!.companyName!);
        const roleSim = calculateSimilarity(opp.role, parsedData!.role!);
        return companySim > 0.6 && roleSim > 0.6;
      });

      if (isDuplicate) {
        setError(`You have already saved the ${parsedData!.role} role at ${parsedData!.companyName}.`);
        setLoading(false);
        return;
      }

      setPreview({
        ...parsedData,
        companyName: parsedData!.companyName ?? '',
        role: parsedData!.role ?? '',
        userId: userProfile?.userId || '',
        status: 'Saved',
      });

    } catch (err: any) {
      console.error(err);
      if (err.message === "IRRELEVANT_TEXT") {
        setError('This text does not appear to describe a job or internship opportunity. Please paste a valid posting.');
      } else {
        setError(err.message || 'Error communicating with AI API.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    setRejectionReason('');

    try {
      // 1. If the user has a profile, evaluate the match BEFORE saving
      if (userProfile) {
        const matchResults = await evaluateMatch(preview, userProfile);
        
        if (matchResults.matchStatus === 'Ineligible') {
          // Block saving and show the rejection reasoning
          setRejectionReason(matchResults.matchReasoning);
          setLoading(false);
          return;
        }

        // Include the eligible status when saving
        preview.matchStatus = matchResults.matchStatus;
        preview.matchReasoning = matchResults.matchReasoning;
      }

      // 2. Save only if Eligible (or if no profile exists yet to block them)
      await saveOpportunity({ ...preview, createdAt: new Date() });
      setPreview(null);
      setText('');
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save to database: ${err.message || 'Unknown error. Check console.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!preview ? (
        <>
          <textarea
            className="w-full min-h-[150px] p-4 text-sm bg-muted rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            placeholder="Paste a WhatsApp/Telegram message or paste just a URL to auto-extract from the job page."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
          {/* URL Trust Badge */}
          {urlTrust && (
            <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md border ${
              urlTrust.trust === 'trusted' ? 'bg-green-50 border-green-200 text-green-700' :
              urlTrust.trust === 'suspicious' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
              urlTrust.trust === 'checking' ? 'bg-muted border-border text-muted-foreground' :
              'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              {urlTrust.trust === 'trusted' && <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />}
              {urlTrust.trust === 'suspicious' && <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />}
              {urlTrust.trust === 'unknown' && <ShieldQuestion className="w-4 h-4 shrink-0 mt-0.5" />}
              {urlTrust.trust === 'checking' && <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />}
              <span>{urlTrust.reason}</span>
            </div>
          )}
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <button
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            onClick={handleAnalyze}
            disabled={loading || !text.trim() || urlTrust?.trust === 'suspicious'}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
            {loading ? loadingLabel : urlTrust?.trust === 'suspicious' ? '🚫 Suspicious Link Blocked' : 'Analyze Message'}
          </button>
        </>
      ) : (
        <div className="bg-muted p-4 rounded-md border space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold px-1 text-primary">Preview & Edit Data</h3>
            <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Company / Org</label>
              <input 
                className="w-full border bg-background rounded-sm px-3 py-1.5 text-sm" 
                value={preview.companyName}
                onChange={e => setPreview({ ...preview, companyName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
              <input 
                className="w-full border bg-background rounded-sm px-3 py-1.5 text-sm" 
                value={preview.role}
                onChange={e => setPreview({ ...preview, role: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Deadline</label>
              <input 
                className="w-full border bg-background rounded-sm px-3 py-1.5 text-sm" 
                value={preview.deadline || ''}
                placeholder="YYYY-MM-DD or Unspecified"
                onChange={e => setPreview({ ...preview, deadline: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Required Documents</label>
              <input 
                className="w-full border bg-background rounded-sm px-3 py-1.5 text-sm" 
                value={preview.requiredDocuments?.length ? preview.requiredDocuments.join(', ') : 'Not specified'}
                placeholder="Resume, Cover Letter..."
                onChange={e => setPreview({ 
                  ...preview, 
                  requiredDocuments: e.target.value === 'Not specified' ? [] : e.target.value.split(',').map(s => s.trim()) 
                })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Application Link</label>
              <input 
                className="w-full border bg-background rounded-sm px-3 py-1.5 text-sm" 
                value={preview.applicationLink}
                placeholder="https://"
                onChange={e => setPreview({ ...preview, applicationLink: e.target.value })}
              />
            </div>
          </div>

          {rejectionReason && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md text-sm flex items-start gap-2 mt-4">
               <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
               <div>
                 <p className="font-bold mb-0.5">Application Rejected</p>
                 <p>{rejectionReason}</p>
                 <p className="mt-2 text-xs opacity-80">This opportunity will not be saved to your dashboard because you do not meet the core eligibility requirements.</p>
               </div>
            </div>
          )}

          <button
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-md font-medium transition-colors disabled:opacity-50 mt-4"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {loading ? 'Saving...' : 'Confirm & Save to Dashboard'}
          </button>
        </div>
      )}
    </div>
  );
}

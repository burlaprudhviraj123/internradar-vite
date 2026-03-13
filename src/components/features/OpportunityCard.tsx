import type { Opportunity } from '@/types';
import { Building2, ExternalLink, GraduationCap, Clock, CheckCircle2, XCircle, HelpCircle, FileText, CalendarPlus } from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface OpportunityCardProps {
  opp: Opportunity;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function OpportunityCard({ opp, onStatusChange }: OpportunityCardProps) {
  
  const getDeadlineInfo = (deadline: string | null) => {
    if (!deadline) return { text: 'Unspecified', color: 'text-muted-foreground' };
    
    try {
      const date = parseISO(deadline);
      if (isPast(endOfDay(date))) return { text: 'Expired', color: 'text-destructive font-medium' };
      
      const distance = formatDistanceToNow(date, { addSuffix: true });
      const daysDiff = (date.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      
      if (daysDiff < 3) return { text: distance, color: 'text-orange-500 font-bold' };
      return { text: distance, color: 'text-green-600 font-medium' };
    } catch {
      return { text: deadline, color: 'text-muted-foreground' };
    }
  };

  const deadlineInfo = getDeadlineInfo(opp.deadline);

  const getGoogleCalendarUrl = (opportunity: Opportunity) => {
    if (!opportunity.deadline) return null;
    try {
      const date = parseISO(opportunity.deadline);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      
      const nextDayDate = new Date(date);
      nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
      const nextYear = nextDayDate.getUTCFullYear();
      const nextMonth = String(nextDayDate.getUTCMonth() + 1).padStart(2, '0');
      const nextDay = String(nextDayDate.getUTCDate()).padStart(2, '0');

      const dateString = `${year}${month}${day}/${nextYear}${nextMonth}${nextDay}`;
      const title = encodeURIComponent(`${opportunity.role} - ${opportunity.companyName} Deadline`);
      const details = encodeURIComponent(`Application Link: ${opportunity.applicationLink || 'None'}`);
      
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateString}&details=${details}`;
    } catch {
      return null;
    }
  };

  const calendarUrl = getGoogleCalendarUrl(opp);

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      
      {/* Decorative gradient line */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-1",
        opp.status === 'Applied' ? 'bg-blue-500' : 
        opp.status === 'Interview' ? 'bg-purple-500' :
        opp.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-200'
      )} />

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">
            {opp.role}
          </h3>
          <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">{opp.companyName}</span>
          </div>
        </div>

        <select 
          className="text-xs border rounded-full px-2 py-1 bg-muted font-medium outline-none cursor-pointer focus:ring-2 focus:ring-primary/20"
          value={opp.status}
          onChange={(e) => onStatusChange && opp.id && onStatusChange(opp.id, e.target.value)}
        >
          <option value="Saved">Saved</option>
          <option value="Applied">Applied</option>
          <option value="Interview">Interview</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {opp.matchStatus && (
        <div className={cn(
          "mb-4 px-3 py-2 rounded-md text-sm border flex gap-2 items-start",
          opp.matchStatus === 'Eligible' ? "bg-green-50 border-green-200 text-green-900" :
          opp.matchStatus === 'Ineligible' ? "bg-red-50 border-red-200 text-red-900" :
          "bg-gray-50 border-gray-200 text-gray-700"
        )}>
           {opp.matchStatus === 'Eligible' ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> :
            opp.matchStatus === 'Ineligible' ? <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" /> :
            <HelpCircle className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />}
           <div>
             <span className="font-semibold block mb-0.5">{opp.matchStatus}</span>
             <span className="text-xs opacity-90">{opp.matchReasoning || 'Match pending analysis.'}</span>
           </div>
        </div>
      )}

      <div className="space-y-2 text-sm mt-4">
        
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex flex-col">
            <span className="text-muted-foreground">Deadline</span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={deadlineInfo.color}>{deadlineInfo.text}</span>
              {calendarUrl && !isPast(endOfDay(parseISO(opp.deadline!))) && (
                <a 
                  href={calendarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 font-medium bg-primary/10 px-2 py-0.5 rounded-md"
                >
                  <CalendarPlus className="w-3 h-3" />
                  Add to Calendar
                </a>
              )}
            </div>
          </div>
        </div>

        {opp.eligibility && opp.eligibility.length > 0 && (
          <div className="flex items-start gap-2 pt-1">
            <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-muted-foreground">Eligibility</span>
              <span className="font-medium line-clamp-2">{opp.eligibility.join(', ')}</span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 pt-1">
          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex flex-col">
            <span className="text-muted-foreground">Required Docs</span>
            <span className="font-medium line-clamp-2">
              {opp.requiredDocuments && opp.requiredDocuments.length > 0 
                ? opp.requiredDocuments.join(', ') 
                : 'Not specified'}
            </span>
          </div>
        </div>

      </div>

      {opp.applicationLink && (
        <a 
          href={opp.applicationLink.startsWith('http') ? opp.applicationLink : `https://${opp.applicationLink}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center justify-center gap-2 w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2 rounded-md font-medium transition-colors"
        >
          <span>Apply Now</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

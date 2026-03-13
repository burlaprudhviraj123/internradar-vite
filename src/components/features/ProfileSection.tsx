import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { parseResume } from '@/lib/llm';
import { extractTextFromPDF } from '@/lib/pdf';
import { FileUp, Loader2, UserCircle, UploadCloud } from 'lucide-react';

export function ProfilePage() {
  const { userProfile, saveUserProfile } = useAuth();
  
  const [isEditing, setIsEditing] = useState(!userProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // 1. Extract raw text from PDF
      setStatusText('Reading PDF file...');
      const extractedText = await extractTextFromPDF(file);

      // 2. Parse the resume using LLM
      setStatusText('AI is building your profile...');
      const parsedProfile = await parseResume(extractedText);
      
      if (!parsedProfile) {
        throw new Error("Failed to parse resume into profile format.");
      }

      // 3. Save the structured profile
      setStatusText('Saving profile...');
      await saveUserProfile(parsedProfile);
      
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error processing resume.');
    } finally {
      setLoading(false);
      setStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // If user has a profile and they aren't editing it, show the dashboard
  if (!isEditing && userProfile) {
    return (
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            Your Profile
          </h2>
          <button 
            onClick={() => setIsEditing(true)}
            className="text-sm border px-3 py-1.5 rounded-md hover:bg-muted font-medium transition-colors"
          >
            Update Resume
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-muted/30 p-5 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Personal Details</p>
              <p className="font-semibold text-lg">{userProfile.fullName}</p>
            </div>
            
            <div className="bg-muted/30 p-5 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Education</p>
              <p className="font-medium">{userProfile.major}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Class of {userProfile.graduationYear}
              </p>
            </div>
          </div>
          
          <div className="bg-muted/30 p-5 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Detected Skills</p>
            <div className="flex flex-wrap gap-2">
              {userProfile.skills.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium border border-primary/20">
                  {skill}
                </span>
              ))}
              {userProfile.skills.length === 0 && <span className="text-sm text-muted-foreground">None detected in the uploaded resume.</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto rounded-xl border bg-card text-card-foreground shadow-sm p-8 mt-8">
      <div className="text-center mb-8">
         <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileUp className="w-8 h-8" />
         </div>
         <h2 className="text-2xl font-bold mb-2">Resume Setup</h2>
         <p className="text-muted-foreground max-w-md mx-auto">
           Upload your latest resume (PDF). AI will securely extract your skills, major, and graduation year to auto-evaluate your radar opportunities.
         </p>
      </div>
      
      <label 
        htmlFor="resume-upload"
        className={`block border-2 border-dashed rounded-xl p-12 text-center transition-colors ${loading ? 'bg-muted border-muted-foreground/20' : 'hover:bg-muted/50 border-border cursor-pointer'}`}
      >
        <input 
          id="resume-upload"
          type="file" 
          accept="application/pdf" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
          disabled={loading}
        />
        
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-medium text-lg">{statusText}</p>
            <p className="text-sm text-muted-foreground">This usually takes about 10 seconds.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
             <UploadCloud className="w-10 h-10 text-muted-foreground mb-2" />
             <p className="font-semibold text-lg">Click to Upload PDF</p>
             <p className="text-sm text-muted-foreground mb-4">Maximum file size: 5MB</p>
             <span className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-medium text-sm inline-block">
               Browse Files
             </span>
          </div>
        )}
      </label>

      {error && (
        <div className="mt-4 p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 text-center font-medium">
          {error}
        </div>
      )}

      {userProfile && !loading && (
        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsEditing(false)}
            className="text-sm text-muted-foreground hover:text-foreground font-medium"
          >
            Cancel Update
          </button>
        </div>
      )}
    </div>
  );
}

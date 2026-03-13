export interface Opportunity {
  id?: string;
  userId: string;
  companyName: string;
  role: string;
  deadline: string | null;
  eligibility: string[];
  applicationLink: string;
  requiredDocuments: string[];
  status: 'Saved' | 'Applied' | 'Interview' | 'Rejected';
  createdAt?: any; // any for Firebase Timestamp or string date depending on context
  // Matching Info
  matchStatus?: 'Eligible' | 'Ineligible' | 'Pending';
  matchReasoning?: string;
  // Notifications
  urgencyEmailSent?: boolean;
}

export interface UserProfile {
  id?: string;
  userId: string;
  fullName: string;
  graduationYear: string;
  major: string;
  skills: string[];
  experience: string[];
  rawResumeText?: string;
}

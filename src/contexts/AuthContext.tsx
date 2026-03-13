import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import { auth, db, isConfigured } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types';

declare global {
  interface Window {
    recaptchaVerifier: any;
    grecaptcha: any;
  }
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  sendOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  saveUserProfile: (profile: Omit<UserProfile, 'userId'>) => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const fetchUserProfile = async (uid: string) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error("Failed to fetch user profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchUserProfile(currentUser.uid);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  };

  const sendOtp = async (phoneNumber: string) => {
    if (!isConfigured || !auth) {
      setError("Firebase is not configured.");
      return;
    }
    
    try {
      setError(null);
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`; // Default to India if no code
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
      console.error(err);
      if (window.recaptchaVerifier) {
         window.recaptchaVerifier.render().then((widgetId: any) => {
           window.grecaptcha.reset(widgetId);
         });
      }
    }
  };

  const verifyOtp = async (code: string) => {
    if (!confirmationResult) {
       setError("No OTP request found. Please request a new code.");
       return;
    }
    
    try {
       setError(null);
       const result = await confirmationResult.confirm(code);
       setUser(result.user);
       fetchUserProfile(result.user.uid);
    } catch (err: any) {
       setError("Invalid code. Please try again.");
       console.error(err);
    }
  };

  const logout = async () => {
    if (!isConfigured || !auth) return;
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
    } catch (err: any) {
      console.error("Failed to sign out", err);
    }
  };

  const saveUserProfile = async (profileData: Omit<UserProfile, 'userId'>) => {
    if (!user || !db) throw new Error("User must be logged in to save profile.");
    
    setLoading(true);
    try {
      const fullProfile: UserProfile = {
        ...profileData,
        userId: user.uid
      };
      
      await setDoc(doc(db, 'users', user.uid), fullProfile);
      setUserProfile(fullProfile);
    } catch (err: any) {
      console.error("Error saving user profile:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, sendOtp, verifyOtp, logout, saveUserProfile, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

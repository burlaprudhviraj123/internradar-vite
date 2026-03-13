import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInAnonymously,
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import { auth, db, isConfigured } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types';

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
  const [tempPhone, setTempPhone] = useState<string>('');

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

  // --- MOCK OTP FLOW ---
  const sendOtp = async (phoneNumber: string) => {
    setError(null);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setTempPhone(phoneNumber);
  };

  const verifyOtp = async (code: string) => {
    if (!tempPhone) {
       setError("No phone number found.");
       return;
    }
    
    try {
       setError(null);
       console.log(`Verifying mock OTP: ${code}`);
       // We use Anonymous Auth under the hood so the user gets a real Firebase UID 
       // This ensures all Firestore Rules and Dashboard logic still works flawlessly.
       const result = await signInAnonymously(auth);
       
       // Update display name cleanly
       import('firebase/auth').then(({ updateProfile }) => {
         updateProfile(result.user, { displayName: tempPhone }).catch(() => {});
       });
       
       setUser(result.user);
       fetchUserProfile(result.user.uid);
    } catch (err: any) {
       // If Anonymous auth is disabled in the console, this will throw an operation-not-allowed error
       if (err.code === 'auth/operation-not-allowed') {
         setError("Please go to Firebase Console -> Authentication -> Sign-in methods -> Enable 'Anonymous' provider.");
       } else {
         setError(err.message || "Failed to log in.");
       }
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

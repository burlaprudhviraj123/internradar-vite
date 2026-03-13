import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import { auth, googleProvider, db, isConfigured } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
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

    // Check if we are returning from a redirect flow
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          fetchUserProfile(result.user.uid);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to sign in via redirect.");
        console.error("Redirect error:", err);
        setLoading(false);
      });

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

  const signInWithGoogle = async () => {
    if (!isConfigured || !auth) {
      setError("Firebase is not configured.");
      return;
    }
    
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      // If the browser blocks third-party storage (like Brave, Safari, Chrome Incognito) 
      // the popup fails. We can fall back to a full-page redirect instead.
      const isStoragePartitionError = 
        err.message?.includes('missing initial state') || 
        err.message?.includes('storage-partitioned') ||
        err.code === 'auth/popup-closed-by-user'; // Sometimes it throws this if blocked

      if (isStoragePartitionError) {
        console.log("Popup blocked by browser storage rules. Falling back to redirect...");
        // This will redirect the whole page
        await signInWithRedirect(auth, googleProvider);
      } else {
        setError(err.message || "Failed to sign in with Google.");
        console.error(err);
      }
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
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, logout, saveUserProfile, error }}>
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

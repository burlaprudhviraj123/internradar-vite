import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc,
  doc,
  where,
  limit
} from "firebase/firestore";
import type { Opportunity } from "@/types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigured = !!firebaseConfig.apiKey;

let app;
let db: any = null;
let opportunitiesRef: any = null;
let auth: any = null;
let googleProvider: any = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  opportunitiesRef = collection(db, "opportunities");
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { db, auth, googleProvider, isConfigured };

export async function saveOpportunity(data: Omit<Opportunity, "id" | "userId">) {
  if (!isConfigured) throw new Error("Firebase is not configured. Please set environment variables.");
  if (!auth?.currentUser?.uid) throw new Error("You must be logged in to save opportunities.");

  try {
    // Add a 5 second timeout to prevent infinite hanging if Firebase can't connect
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Firebase connection timed out. Check if your config is correct and if you have created a Firestore Database in the Firebase Console.")), 5000)
    );
    
    // Ensure userId is present
    const opportunityToSave = {
      ...data,
      userId: auth.currentUser.uid
    };

    const savePromise = addDoc(opportunitiesRef, opportunityToSave);
    
    // @ts-ignore
    const docRef: any = await Promise.race([savePromise, timeoutPromise]);
    return docRef.id;
  } catch (error) {
    console.error("Error saving to Firebase: ", error);
    throw error;
  }
}

export function subscribeToOpportunities(
  userId: string,
  callback: (opportunities: Opportunity[]) => void,
  onError?: (err: Error) => void
) {
  if (!isConfigured || !userId) {
    callback([]);
    return () => {};
  }
  
  const q = query(
    opportunitiesRef, 
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  // Add a safety timeout to alert the user if Firebase is completely unreachable
  let initialLoad = true;
  const timeoutId = setTimeout(() => {
    if (initialLoad && onError) {
      onError(new Error("Timeout connecting to your Firebase Project. Make sure Firestore is enabled."));
    }
  }, 6000);

  const unsubscribe = onSnapshot(
    q, 
    (snapshot: any) => {
      initialLoad = false;
      clearTimeout(timeoutId);
      const opps: Opportunity[] = [];
      snapshot.forEach((doc: any) => {
        opps.push({ id: doc.id, ...(doc.data() as object) } as Opportunity);
      });
      callback(opps);
    },
    (error) => {
      initialLoad = false;
      clearTimeout(timeoutId);
      console.error("Firebase listen error: ", error);
      if (onError) onError(error);
    }
  );

  return () => {
    clearTimeout(timeoutId);
    unsubscribe();
  };
}

export async function updateOpportunityStatus(id: string, status: string) {
  if (!isConfigured || !db) return;
  const docRef = doc(db, "opportunities", id);
  try {
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error("Error updating document status: ", error);
  }
}

export async function markUrgencyEmailSent(id: string) {
  if (!isConfigured || !db) return;
  const docRef = doc(db, "opportunities", id);
  try {
    await updateDoc(docRef, { urgencyEmailSent: true });
  } catch (error) {
    console.error("Error setting email sent flag: ", error);
  }
}

export function subscribeToGlobalOpportunities(
  domainTags: string[],
  callback: (opps: any[]) => void,
  onError?: (err: Error) => void
) {
  if (!isConfigured || !db) {
    callback([]);
    return () => {};
  }

  const globalRef = collection(db, "global_opportunities");
  const q = domainTags.length > 0
    ? query(globalRef, where("domainTags", "array-contains-any", domainTags), limit(20))
    : query(globalRef, limit(20));

  const unsubscribe = onSnapshot(
    q,
    (snapshot: any) => {
      const results: any[] = [];
      snapshot.forEach((d: any) => results.push({ id: d.id, ...d.data() }));
      callback(results);
    },
    (error: any) => {
      console.error("Global opportunities listen error:", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

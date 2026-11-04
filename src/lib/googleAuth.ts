import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive.readonly");

let isSigningIn = false;
let cachedAccessToken: string | null = ((): string | null => {
  try {
    return localStorage.getItem("google_access_token");
  } catch {
    return null;
  }
})();

export const getSavedUser = (): User | null => {
  try {
    const raw = localStorage.getItem("google_user_data");
    if (raw) return JSON.parse(raw) as User;
  } catch (e) {
    console.error("Error reading saved user:", e);
  }
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const savedUser = getSavedUser();
  const savedToken = cachedAccessToken || ((): string | null => {
    try {
      return localStorage.getItem("google_access_token");
    } catch {
      return null;
    }
  })();

  if (savedUser && savedToken && onAuthSuccess) {
    cachedAccessToken = savedToken;
    onAuthSuccess(savedUser, savedToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = cachedAccessToken || localStorage.getItem("google_access_token") || "";
      const userData = {
        displayName: user.displayName || "Usuário Google",
        email: user.email || "",
        photoURL: user.photoURL || "",
        uid: user.uid,
      } as any;

      try {
        localStorage.setItem("google_user_data", JSON.stringify(userData));
      } catch (e) {}

      if (token && onAuthSuccess) {
        onAuthSuccess(user, token);
      }
    } else {
      const currentSavedUser = getSavedUser();
      const currentSavedToken = ((): string | null => {
        try {
          return localStorage.getItem("google_access_token");
        } catch {
          return null;
        }
      })();

      if (currentSavedUser && currentSavedToken) {
        cachedAccessToken = currentSavedToken;
        if (onAuthSuccess) onAuthSuccess(currentSavedUser, currentSavedToken);
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Não foi possível obter o token de acesso do Google.");
    }

    cachedAccessToken = credential.accessToken;
    const userData = {
      displayName: result.user.displayName || "Usuário Google",
      email: result.user.email || "",
      photoURL: result.user.photoURL || "",
      uid: result.user.uid,
    };

    try {
      localStorage.setItem("google_access_token", cachedAccessToken);
      localStorage.setItem("google_user_data", JSON.stringify(userData));
    } catch (e) {
      console.error("Failed to save google auth in localStorage:", e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || ((): string | null => {
    try {
      return localStorage.getItem("google_access_token");
    } catch {
      return null;
    }
  })();
};

export const logout = async () => {
  try {
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_user_data");
  } catch (e) {}
  await signOut(auth);
  cachedAccessToken = null;
};

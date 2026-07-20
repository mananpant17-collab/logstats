import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// We rely on standard vite env vars here.
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const isFirebaseConfigured = Boolean(
  apiKey && apiKey.length > 5 && !apiKey.includes('<') && apiKey !== 'dummy' &&
  authDomain && authDomain.length > 5 && !authDomain.includes('<') && authDomain !== 'dummy' &&
  projectId && projectId.length > 5 && !projectId.includes('<') && projectId !== 'dummy'
);

export let app: any;
export let auth: any;
export let db: any;

let cachedAccessToken: string | null = localStorage.getItem('google_access_token');
export const getAccessToken = () => cachedAccessToken;
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('google_access_token', token);
  } else {
    localStorage.removeItem('google_access_token');
  }
};

export const reAuthWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({ prompt: 'select_account consent' });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setAccessToken(credential.accessToken);
  }
};

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// Components
import Home from './pages/Home';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Layout from './components/Layout';

function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(
      auth, 
      (u) => {
        setUser(u);
        if (!u) {
          setAccessToken(null);
          setToken(null);
        }
        setLoading(false);
      },
      (error: any) => {
        console.error("Firebase Auth Error:", error);
        setAuthErrorCode(error.code || "unknown");
        setAuthError(error.message || "Unknown Auth Error");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary text-text-primary p-6">
        <div className="font-serif text-4xl tracking-[10px] mb-8">LOG STATS</div>
        <div className="max-w-md bg-bg-secondary border border-bg-tertiary p-6 rounded-xl text-center space-y-4">
          <h2 className="text-xl text-accent-red tracking-widest uppercase">Setup Required</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Firebase environment variables are missing. Please open the <strong>Settings</strong> menu and add the following keys to your Environment Variables:
          </p>
          <ul className="text-left text-xs font-mono text-text-tertiary space-y-1 bg-bg-primary p-4 rounded border border-bg-tertiary">
            <li>VITE_FIREBASE_API_KEY</li>
            <li>VITE_FIREBASE_AUTH_DOMAIN</li>
            <li>VITE_FIREBASE_PROJECT_ID</li>
            <li>VITE_FIREBASE_STORAGE_BUCKET</li>
            <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
            <li>VITE_FIREBASE_APP_ID</li>
          </ul>
        </div>
      </div>
    );
  }

  const login = async () => {
    try {
      setAuthError(null);
      setAuthErrorCode(null);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.setCustomParameters({
        prompt: 'select_account consent'
      });
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        setToken(credential.accessToken);
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/configuration-not-found') {
        setAuthErrorCode(error.code);
        setAuthError("Authentication is not enabled in your Firebase project.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthErrorCode(error.code);
        setAuthError("This domain is not authorized for Firebase Authentication.");
      } else {
        alert(`Authentication Error: ${error.message}\n\nPlease ensure Firebase Authentication (Google provider) is enabled in your Firebase project console.`);
      }
    }
  };

  if (authErrorCode === 'auth/unauthorized-domain') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary text-text-primary p-6">
        <div className="font-serif text-4xl tracking-[10px] mb-8">LOG STATS</div>
        <div className="max-w-md bg-bg-secondary border border-bg-tertiary p-6 rounded-xl text-center space-y-4">
          <h2 className="text-xl text-accent-red tracking-widest uppercase">Unauthorized Domain</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This domain needs to be authorized in your Firebase project. Please follow these steps:
          </p>
          <ol className="text-left text-xs text-text-tertiary space-y-2 bg-bg-primary p-4 rounded border border-bg-tertiary list-decimal list-inside">
            <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-accent-amber underline">Firebase Console</a></li>
            <li>Select your project <strong>{projectId}</strong></li>
            <li>Click on <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong></li>
            <li>Click <strong>Add domain</strong></li>
            <li>Add the current domain: <code className="bg-bg-secondary px-1 rounded">{window.location.hostname}</code></li>
          </ol>
          <button 
            onClick={() => window.location.reload()}
            className="w-full mt-4 px-4 py-2 bg-bg-tertiary text-text-primary rounded uppercase tracking-widest text-xs hover:bg-bg-tertiary/80 transition-colors"
          >
            I've added the domain, retry
          </button>
        </div>
      </div>
    );
  }

  if (authErrorCode === 'auth/configuration-not-found' || authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary text-text-primary p-6">
        <div className="font-serif text-4xl tracking-[10px] mb-8">LOG STATS</div>
        <div className="max-w-md bg-bg-secondary border border-bg-tertiary p-6 rounded-xl text-center space-y-4">
          <h2 className="text-xl text-accent-red tracking-widest uppercase">Firebase Auth Not Configured</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Firebase Authentication is not enabled for your project. Please follow these steps:
          </p>
          <ol className="text-left text-xs text-text-tertiary space-y-2 bg-bg-primary p-4 rounded border border-bg-tertiary list-decimal list-inside">
            <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-accent-amber underline">Firebase Console</a></li>
            <li>Select your project <strong>{projectId}</strong></li>
            <li>Click on <strong>Authentication</strong> in the left menu</li>
            <li>Click <strong>Get Started</strong></li>
            <li>Go to the <strong>Sign-in method</strong> tab</li>
            <li>Enable the <strong>Google</strong> provider and click Save</li>
          </ol>
          <button 
            onClick={() => window.location.reload()}
            className="w-full mt-4 px-4 py-2 bg-bg-tertiary text-text-primary rounded uppercase tracking-widest text-xs hover:bg-bg-tertiary/80 transition-colors"
          >
            I've enabled it, retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary">
        <div className="font-serif text-2xl tracking-[5px] animate-pulse">LOG STATS</div>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
          <div className="mb-10 text-center">
            <div className="mb-4 font-mono text-[10px] tracking-[0.3em] uppercase text-accent-teal">
              ✦ private daily intelligence
            </div>
            <div className="font-serif text-5xl font-light tracking-[0.22em] text-text-primary sm:text-6xl">
              LOG STATS
            </div>
            <div className="mx-auto mt-5 h-px w-12 bg-accent-amber/70" />
            <p className="mt-6 text-center text-sm leading-7 text-text-secondary">
              A private daily tracker that turns your health, mood, workouts, study, work, and goals into insight over time.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-2">
            {[
              { icon: '✦', label: 'Log', detail: 'capture the day' },
              { icon: '≡', label: 'History', detail: 'see the pattern' },
              { icon: '◈', label: 'Analytics', detail: 'find the signal' },
            ].map(item => (
              <div key={item.label} className="rounded-[10px] border-[0.5px] border-border-subtle bg-bg-secondary px-2 py-3 text-center">
                <div className="font-serif text-xl text-accent-amber">{item.icon}</div>
                <div className="mt-1 font-mono text-[9px] tracking-[0.16em] uppercase text-text-primary">{item.label}</div>
                <div className="mt-1 text-[10px] leading-tight text-text-tertiary">{item.detail}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[10px] border-[0.5px] border-border-subtle bg-bg-secondary p-4">
            <button
              onClick={login}
              className="w-full rounded-[10px] bg-accent-amber px-6 py-3.5 font-sans text-sm font-semibold tracking-[0.22em] text-[#1a0f07] uppercase transition-transform active:scale-[0.98]"
            >
              Sign in with Google
            </button>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-text-tertiary">
              If sign-in does not open, try launching the app in a new browser tab.
            </p>
          </div>

          <div className="mt-8 text-center font-mono text-[9px] tracking-[0.18em] uppercase text-text-tertiary">
            your data · your pace · your perspective
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="history" element={<History />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

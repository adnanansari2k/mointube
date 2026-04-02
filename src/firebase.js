// ─────────────────────────────────────────────────────────────────
//  MoinTube · Firebase — Google Auth (persistent across browser clears)
// ─────────────────────────────────────────────────────────────────

import { initializeApp }             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import { getFirestore,
         doc, getDoc, setDoc,
         updateDoc, deleteDoc,
         collection, getDocs,
         serverTimestamp }            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
import { getAuth,
         GoogleAuthProvider,
         signInWithPopup,
         signInWithRedirect,
         getRedirectResult,
         signOut,
         onAuthStateChanged }         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'

// ── YOUR FIREBASE CONFIG ─────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAPR9O1zteM57Blyy0_jMztyWPbcBh_Ax8",
  authDomain: "mointube.firebaseapp.com",
  projectId: "mointube",
  storageBucket: "mointube.firebasestorage.app",
  messagingSenderId: "362849511303",
  appId: "1:362849511303:web:f4a2fa661f3f9660609522",
  measurementId: "G-RCQXLSTEPN"
};

// ─────────────────────────────────────────────────────────────────

const app      = initializeApp(firebaseConfig)
const db       = getFirestore(app)
export const auth = getAuth(app)
const provider = new GoogleAuthProvider()

// ── Auth helpers ─────────────────────────────────────────────────

/**
 * Returns the current user if already signed in, or null.
 * Resolves quickly — use this on app mount to check existing session.
 */
export function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user) }, reject)
  })
}

/**
 * Sign in with Google popup. Falls back to redirect on mobile/blocked.
 * Returns the signed-in user.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider)
    return result.user
  } catch (err) {
    // Popup blocked (common on mobile) → use redirect flow
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, provider)
      return null  // page will reload after redirect
    }
    throw err
  }
}

/**
 * Call once on mount to handle the redirect result (mobile flow).
 * Returns user if redirect just completed, otherwise null.
 */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth)
    return result?.user || null
  } catch {
    return null
  }
}

export async function fbSignOut() {
  await signOut(auth)
}

// ── Firestore helpers ─────────────────────────────────────────────
function userDoc(uid, ...path) { return doc(db, 'users', uid, ...path) }
function userCol(uid, ...path) { return collection(db, 'users', uid, ...path) }

// ── CHANNELS ─────────────────────────────────────────────────────
export async function fbGetChannels(uid) {
  const snap = await getDocs(userCol(uid, 'channels'))
  return snap.docs.map(d => ({ id: d.id, hiddenFromAll: false, ...d.data() }))
}

export async function fbAddChannel(uid, channel) {
  await setDoc(userDoc(uid, 'channels', channel.id), {
    name:              channel.name || '',
    uploadsPlaylistId: channel.uploadsPlaylistId || '',
    hiddenFromAll:     channel.hiddenFromAll || false,
    newestPublishedAt: channel.newestPublishedAt || null,
    addedAt:           serverTimestamp()
  })
}

export async function fbRemoveChannel(uid, channelId) {
  await deleteDoc(userDoc(uid, 'channels', channelId))
}

export async function fbUpdateChannelName(uid, channelId, name, uploadsPlaylistId, hiddenFromAll = false) {
  await updateDoc(userDoc(uid, 'channels', channelId), { name, uploadsPlaylistId, hiddenFromAll })
}

export async function fbUpdateChannelNewest(uid, channelId, newestPublishedAt) {
  await updateDoc(userDoc(uid, 'channels', channelId), { newestPublishedAt }).catch(() => {})
}

// ── VIDEO CACHE ───────────────────────────────────────────────────
export async function fbGetVideoCache(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'videos'))
  return snap.exists() ? snap.data() : null
}

export async function fbSetVideoCache(uid, videos) {
  await setDoc(userDoc(uid, 'cache', 'videos'), { videos, fetchedAt: Date.now() })
}

// ── CONFIG ────────────────────────────────────────────────────────
export async function fbGetConfig(uid) {
  const snap = await getDoc(userDoc(uid, 'config', 'app'))
  return snap.exists() ? snap.data() : {}
}

export async function fbSetConfig(uid, patch) {
  await setDoc(userDoc(uid, 'config', 'app'), patch, { merge: true })
}

// ── PROGRESS ──────────────────────────────────────────────────────
export async function fbGetProgress(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'progress'))
  return snap.exists() ? (snap.data().map || {}) : {}
}

export async function fbSetProgress(uid, progressMap) {
  await setDoc(userDoc(uid, 'cache', 'progress'), { map: progressMap })
}

// ── HISTORY ───────────────────────────────────────────────────────
export async function fbGetHistory(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'history'))
  return snap.exists() ? (snap.data().map || {}) : {}
}

export async function fbSetHistory(uid, historyMap) {
  await setDoc(userDoc(uid, 'cache', 'history'), { map: historyMap })
}

// ── ANALYTICS ─────────────────────────────────────────────────────
export async function fbGetAnalytics(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'analytics'))
  return snap.exists() ? snap.data() : { videosWatched: 0, videoWatchSec: 0, siteBrowseSec: 0 }
}

export async function fbSetAnalytics(uid, data) {
  await setDoc(userDoc(uid, 'cache', 'analytics'), data)
}

// ── SAVED ─────────────────────────────────────────────────────────
export async function fbGetSaved(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'saved'))
  return snap.exists() ? snap.data() : { watchLater: {}, bookmarks: {} }
}

export async function fbSetSaved(uid, saved) {
  await setDoc(userDoc(uid, 'cache', 'saved'), saved)
}

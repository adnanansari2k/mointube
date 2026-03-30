// ─────────────────────────────────────────────────────────────────
//  MoinTube · Firebase configuration
// ─────────────────────────────────────────────────────────────────

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import { getFirestore,
         doc, getDoc, setDoc,
         updateDoc, deleteDoc,
         collection, getDocs,
         serverTimestamp }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
import { getAuth,
         signInAnonymously,
         onAuthStateChanged }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'

// ── REPLACE WITH YOUR FIREBASE CONFIG ────────────────────────────
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

const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)
const auth = getAuth(app)

export function ensureAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub()
      if (user) { resolve(user.uid); return }
      signInAnonymously(auth).then(r => resolve(r.user.uid)).catch(reject)
    })
  })
}

function userDoc(uid, ...path) { return doc(db, 'users', uid, ...path) }
function userCol(uid, ...path) { return collection(db, 'users', uid, ...path) }

// ── CHANNELS ─────────────────────────────────────────────────────
export async function fbGetChannels(uid) {
  const snap = await getDocs(userCol(uid, 'channels'))
  return snap.docs.map(d => ({ id: d.id, hiddenFromAll: false, ...d.data() }))
}

export async function fbAddChannel(uid, channel) {
  await setDoc(userDoc(uid, 'channels', channel.id), {
    name:               channel.name || '',
    uploadsPlaylistId:  channel.uploadsPlaylistId || '',
    hiddenFromAll:      channel.hiddenFromAll || false,
    newestPublishedAt:  channel.newestPublishedAt || null,
    addedAt:            serverTimestamp()
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
  if (!snap.exists()) return null
  return snap.data()
}

export async function fbSetVideoCache(uid, videos) {
  await setDoc(userDoc(uid, 'cache', 'videos'), { videos, fetchedAt: Date.now() })
}

// ── CONFIG ────────────────────────────────────────────────────────
export async function fbGetConfig(uid) {
  const snap = await getDoc(userDoc(uid, 'config', 'app'))
  if (!snap.exists()) return {}
  return snap.data()
}

export async function fbSetConfig(uid, patch) {
  await setDoc(userDoc(uid, 'config', 'app'), patch, { merge: true })
}

// ── PROGRESS ──────────────────────────────────────────────────────
export async function fbGetProgress(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'progress'))
  if (!snap.exists()) return {}
  return snap.data().map || {}
}

export async function fbSetProgress(uid, progressMap) {
  await setDoc(userDoc(uid, 'cache', 'progress'), { map: progressMap })
}

// ── HISTORY ───────────────────────────────────────────────────────
export async function fbGetHistory(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'history'))
  if (!snap.exists()) return {}
  return snap.data().map || {}
}

export async function fbSetHistory(uid, historyMap) {
  await setDoc(userDoc(uid, 'cache', 'history'), { map: historyMap })
}

// ── ANALYTICS ─────────────────────────────────────────────────────
export async function fbGetAnalytics(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'analytics'))
  if (!snap.exists()) return { videosWatched: 0, videoWatchSec: 0, siteBrowseSec: 0 }
  return snap.data()
}

export async function fbSetAnalytics(uid, data) {
  await setDoc(userDoc(uid, 'cache', 'analytics'), data)
}

// ── SAVED (Watch Later + Bookmarks) ──────────────────────────────
// Stored as a single doc: { watchLater: { [id]: {video, savedAt} }, bookmarks: { [id]: {video, savedAt} } }
export async function fbGetSaved(uid) {
  const snap = await getDoc(userDoc(uid, 'cache', 'saved'))
  if (!snap.exists()) return { watchLater: {}, bookmarks: {} }
  return snap.data()
}

export async function fbSetSaved(uid, saved) {
  await setDoc(userDoc(uid, 'cache', 'saved'), saved)
}

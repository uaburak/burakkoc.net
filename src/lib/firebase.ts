import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore }  from "firebase/firestore";
import { getStorage }    from "firebase/storage";
import { getAuth }       from "firebase/auth";

const firebaseConfig = {
  apiKey:            "AIzaSyDxG-Rh5V2AFWD2JeP43jzpET1nXuER5zs",
  authDomain:        "burakkoc-a15d3.firebaseapp.com",
  projectId:         "burakkoc-a15d3",
  storageBucket:     "burakkoc-a15d3.firebasestorage.app",
  messagingSenderId: "957278625176",
  appId:             "1:957278625176:web:a0f9a7add2c60c40e21fed",
  measurementId:     "G-W6THBWJSSE",
};

// Singleton — safe for Next.js hot-reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);

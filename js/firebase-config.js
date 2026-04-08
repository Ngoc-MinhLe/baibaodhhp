import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCET0_R6120tj389v5C62NhSLrBIk2CbIw",
  authDomain: "qlylaodong-dev.firebaseapp.com",
  projectId: "qlylaodong-dev",
  storageBucket: "qlylaodong-dev.firebasestorage.app",
  messagingSenderId: "789374516793",
  appId: "1:789374516793:web:29fb38ad0913f8b62e17e8",
  measurementId: "G-M2PJEBLMJF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider };
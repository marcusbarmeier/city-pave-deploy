// setup_admin.js
// Run this ONCE to set up your first Admin user.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyADrnYgh1fSTo3IZD7HOEJMyjduzDYIYSs",
    authDomain: "city-pave-estimator.firebaseapp.com",
    projectId: "city-pave-estimator",
    storageBucket: "city-pave-estimator.firebasestorage.app",
    messagingSenderId: "111714884839",
    appId: "1:111714884839:web:2b782a1b7be5be8edc5642"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdmin() {
    try {
        console.log("Signing in...");
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        console.log("Signed in as:", user.uid);

        console.log("Creating Admin Profile...");
        // Create a document in the 'users' collection with the same ID as the Auth UID
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            role: 'admin',
            name: 'Main Admin',
            createdAt: new Date().toISOString()
        });

        console.log("SUCCESS! You are now an Admin.");
        console.log("User ID:", user.uid);
        alert("Success! Your current browser session is now an Admin.");

    } catch (error) {
        console.error("Error creating admin:", error);
        alert("Error: " + error.message);
    }
}

// Run the function
createAdmin();
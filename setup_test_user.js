
// setup_test_user.js
// Run this script in the browser console on index.html or employee.html to create a test user.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { activeConfig } from "./firebase-config.js";

const app = initializeApp(activeConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createTestUser() {
    const email = "test@citypave.ca";
    const password = "Password123!";
    const name = "Test Employee";

    try {
        let user;
        try {
            console.log(`Creating user: ${email}...`);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
        } catch (authError) {
            if (authError.code === 'auth/email-already-in-use') {
                console.log("User already exists in Auth. Fetching existing user...");
                // We need to sign in to get the UID if we aren't signed in, 
                // but for this helper script, we assume we might be logged in or we just want to update the DB.
                // If we are logged in as this user, auth.currentUser works.
                // If not, we can't easily get the UID without signing in. 
                // Let's assume the user is trying to fix their OWN current session or we strictly follow the flow.
                // Actually, simplest is to tell them to Sign In first if they aren't, or just try to sign in here?
                // For simplicity in this specific "fix it" scenario:
                if (auth.currentUser && auth.currentUser.email === email) {
                    user = auth.currentUser;
                } else {
                    // Try to sign in to get the user object
                    const credential = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js")
                        .then(m => m.signInWithEmailAndPassword(auth, email, password));
                    user = credential.user;
                }
            } else {
                throw authError; // Rethrow other errors
            }
        }

        if (user) {
            console.log("Updating profile for UID:", user.uid);
            await updateProfile(user, { displayName: name });

            console.log("Updating Firestore privileges...");
            await setDoc(doc(db, "users", user.uid), {
                name: name,
                email: email,
                role: "super_admin", // <--- UPGRADED PERMISSIONS
                createdAt: new Date().toISOString()
            }, { merge: true });

            console.log("SUCCESS! User permissions updated.");
            alert(`Success! User ${email} is now a Super Admin.\nPlease refresh the page.`);
        }

    } catch (error) {
        console.error("Error setting up test user:", error);
        alert(`Error: ${error.message}`);
    }
}

// Expose to window so it can be called easily
window.createTestUser = createTestUser;

// Auto-run if pasted into console
createTestUser();

// © 2025 City Pave. All Rights Reserved.
// Filename: fix_my_profile.js
// ONE-TIME SCRIPT: Updates the CURRENT user's profile to be Admin + Correct Tenant

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

async function fixMyProfile() {
    const { db, auth } = window.firebaseServices;
    
    // Wait for auth to be ready
    if (!auth || !auth.currentUser) {
        console.log("Waiting for login...");
        setTimeout(fixMyProfile, 500);
        return;
    }

    const user = auth.currentUser;
    console.log("Found User:", user.uid, user.email);

    try {
        // Force-write the correct profile data
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: user.displayName || "Admin User",
            email: user.email,
            role: 'admin',          // CRITICAL: Must be admin to see Operations
            tenantId: 'citypave',   // CRITICAL: Must match the migrated data
            status: 'Active',
            createdAt: new Date().toISOString()
        }, { merge: true });

        alert(`Success! Profile for ${user.email} updated to Admin/CityPave. Refresh the page.`);

    } catch (error) {
        console.error("Profile Fix Failed:", error);
        alert("Failed to update profile: " + error.message);
    }
}

// Run automatically
fixMyProfile();
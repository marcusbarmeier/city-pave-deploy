// © 2025 City Pave. All Rights Reserved.
// Filename: debug_rules.js

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

async function runDiagnostics() {
    console.log("--- STARTING DIAGNOSTICS ---");
    const { db, auth } = window.firebaseServices;

    // 1. Check Auth
    if (!auth.currentUser) {
        console.error("FAIL: Not logged in.");
        alert("Diagnostic Fail: You are not logged in.");
        return;
    }
    const uid = auth.currentUser.uid;
    console.log("Logged in as:", uid);

    // 2. Try to read OWN Profile (This tests the 'users' rule)
    try {
        console.log("Attempting to read user profile...");
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("PASS: User Profile Read Success.");
            console.log("User Data:", userData);
            
            if (userData.tenantId === 'citypave') {
                console.log("PASS: User tenantId is 'citypave'.");
            } else {
                console.error("FAIL: User tenantId is mismatch:", userData.tenantId);
                alert(`Diagnostic Fail: Your profile tenantId is '${userData.tenantId}', expected 'citypave'.`);
                return;
            }
            
            if (userData.role === 'admin') {
                console.log("PASS: User role is 'admin'.");
            } else {
                console.warn("WARN: User role is not admin:", userData.role);
            }

        } else {
            console.error("FAIL: User Profile does not exist!");
            alert("Diagnostic Fail: Your user profile document is missing.");
            return;
        }
    } catch (error) {
        console.error("FAIL: Could not read User Profile.", error);
        alert("Diagnostic Fail: Security Rules are blocking access to your own profile.");
        return;
    }

    alert("Diagnostics Passed! Your profile and rules seem correct. The issue might be browser caching.");
}

runDiagnostics();
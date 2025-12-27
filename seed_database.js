// seed_database.js
// RUN THIS IN THE BROWSER CONSOLE to populate the "Synthetic World"
// This clears/overwrites specific test data to ensure a clean state.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

async function seedWorld() {
    console.log("🌍 STARTING PLANETARY GENESIS (Seeding Data)...");

    // 1. USERS
    console.log("👤 Creating User Roles...");
    const users = [
        { email: "vet@citypave.ca", pass: "Password123!", name: "The Veteran", role: "admin" },
        { email: "rookie@citypave.ca", pass: "Password123!", name: "The Rookie", role: "employee" },
        { email: "mech@citypave.ca", pass: "Password123!", name: "The Mechanic", role: "mechanic" }
    ];

    // Note: We can't delete users easily client-side, so we just try to create/update Firestore.
    // In a real scenario, we'd need Admin SDK to wipe users. For now, we assume they exist or we create them.
    // We will just write to Firestore 'users' collection mainly.

    for (const u of users) {
        // Mock ID for firestore if we can't auth freely
        const uid = u.email.replace(/[^a-zA-Z0-9]/g, '_');
        await setDoc(doc(db, "users", uid), {
            name: u.name,
            email: u.email,
            role: u.role,
            wage: u.role === 'admin' ? 45 : (u.role === 'mechanic' ? 35 : 22),
            createdAt: new Date().toISOString()
        });
        console.log(`   -> Seeded User: ${u.name}`);
    }

    // 2. FLEET (ASSETS)
    console.log("🚛 specific Asset Fleet...");
    const assets = [
        { id: "asset_t101", unitId: "T-101", type: "Truck", status: "Active", name: "Ford F-150" },
        { id: "asset_t102", unitId: "T-102", type: "Truck", status: "Maintenance", name: "Ford F-550 (Dump)" },
        { id: "asset_dump_old", unitId: "T-OLD", type: "Truck", status: "Archived", name: "Old Rusty" },
        { id: "asset_pav_01", unitId: "P-01", type: "Paver", status: "Active", name: "Cat Paver" }
    ];

    for (const a of assets) {
        await setDoc(doc(db, "assets", a.id), a);
        console.log(`   -> Seeded Asset: ${a.unitId}`);
    }

    // 3. JOBS (ESTIMATES)
    console.log("🏗️ Building Job Sites...");
    const jobs = [
        {
            id: "job_active_01",
            status: "Work Starting",
            customerInfo: { name: "City of Winnipeg", address: "Henderson Hwy", siteAddress: "123 Henderson Hwy" },
            grandTotal: 15000,
            durationDays: 5,
            tentativeStartDate: new Date().toISOString()
        },
        {
            id: "job_complete_01",
            status: "Completed",
            customerInfo: { name: "City Park Dept", address: "Assiniboine Park", siteAddress: "55 Pavilion Cres" },
            grandTotal: 5000,
            durationDays: 2,
            tentativeStartDate: new Date(Date.now() - 86400000 * 10).toISOString() // 10 days ago
        },
        {
            id: "job_problem_01",
            status: "In Progress",
            customerInfo: { name: "M Builds", address: "Sketchy Lane", siteAddress: "404 Error Rd" },
            grandTotal: 120000, // Big job
            durationDays: 14,
            tentativeStartDate: new Date(Date.now() - 86400000 * 5).toISOString()
        },
        {
            id: "job_snow_01",
            status: "Scheduled",
            customerInfo: { name: "IKEA North", address: "Sterling Lyon Pkwy", siteAddress: "Sterling Lyon" },
            grandTotal: 50000,
            durationDays: 1, // Ongoing
            tentativeStartDate: new Date().toISOString(),
            snowContract: {
                billingType: "PerPush",
                triggerDepthCm: 3,
                priority: "Critical",
                rates: { perPush: 450, salting: 150 }
            }
        },
        {
            id: "job_snow_02",
            status: "Scheduled",
            customerInfo: { name: "Tim Hortons 55", address: "Portage Ave", siteAddress: "Portage" },
            grandTotal: 12000,
            durationDays: 1,
            tentativeStartDate: new Date().toISOString(),
            snowContract: {
                billingType: "Hourly",
                rates: { clearing: 160 } // $160/hr loader
            }
        },
        // Pending Estimates
        {
            id: "est_pending_01", status: "Pending",
            customerInfo: { name: "Residenial Owner", address: "101 Suburbia Dr", siteAddress: "101 Suburbia Dr" },
            grandTotal: 3500, description: "Driveway Resurface"
        },
        {
            id: "est_pending_02", status: "Pending",
            customerInfo: { name: "Strip Mall Inc", address: "555 Commerce", siteAddress: "555 Commerce" },
            grandTotal: 8500, description: "Parking Lot Seal"
        },
        {
            id: "est_pending_03", status: "Pending",
            customerInfo: { name: "City Works", address: "Main St", siteAddress: "Main St Patching" },
            grandTotal: 45000, description: "City Patching 2024"
        }
    ];

    for (const j of jobs) {
        await setDoc(doc(db, "estimates", j.id), j);
        console.log(`   -> Seeded Job: ${j.customerInfo.name}`);
    }

    // 4. OPERATIONAL ARTIFACTS
    console.log("📋 Generating Paperwork...");

    // Dispatches
    const dispatches = [
        {
            jobId: "job_active_01", // Henderson Hwy
            date: new Date().toISOString().split('T')[0],
            crew: [{ userId: "user_rookie_citypave_ca", assetId: "asset_t101" }],
            status: "Scheduled", siteTime: "07:00", shopTime: "06:30",
            notes: "Get the rookie started here."
        },
        {
            jobId: "job_snow_01", // Snow Job
            date: new Date().toISOString().split('T')[0],
            crew: [{ userId: "user_vet_citypave_ca", assetId: "asset_pav_01" }],
            status: "Scheduled", siteTime: "04:00", shopTime: "03:30",
            notes: "Critical priority."
        },
        {
            jobId: "job_problem_01",
            date: new Date().toISOString().split('T')[0],
            crew: [], status: "Pending", notes: "Needs more crew."
        },
        {
            jobId: "job_complete_01",
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
            crew: [{ userId: "user_rookie_citypave_ca", assetId: "asset_t101" }],
            status: "Completed", notes: "Cleanup done."
        },
        {
            jobId: "job_active_01",
            date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            crew: [], status: "Scheduled", notes: "Next day prep."
        }
    ];

    for (const d of dispatches) {
        await addDoc(collection(db, "dispatch_schedule"), d);
    }
    console.log(`   -> Seeded ${dispatches.length} Dispatches`);

    // Repair Tickets
    await addDoc(collection(db, "repair_tickets"), {
        vehicleId: "T-102",
        issue: "Brakes Squeaking Loudly",
        status: "Open",
        priority: "Urgent",
        reportedBy: "The Rookie",
        reportedAt: new Date().toISOString()
    });

    await addDoc(collection(db, "repair_tickets"), {
        vehicleId: "P-01",
        issue: "Hydraulic Leak",
        status: "Open",
        priority: "Routine",
        reportedBy: "The Mechanic",
        reportedAt: new Date(Date.now() - 86400000 * 2).toISOString()
    });

    console.log("✅ GENESIS COMPLETE. The world is populated.");

    // 5. MONETIZATION (PLANS & TIERS)
    await seedMonetization();

    alert("Synthetic World Created!");
}

async function seedMonetization() {
    console.log("💰 Seeding Monetization Plans...");
    const plans = [
        {
            internal_tier_id: "tier_free",
            display_name: "Free Tier",
            marketing_tagline: "Basic access for small jobs.",
            price_label_override: "Free",
            store_ids: {
                ios: "com.citypave.tier.free",
                android: "cp_tier_free",
                stripe: "price_free_tier"
            },
            modules_unlocked: ["estimator", "safety"],
            feature_bullets: ["Basic Estimator", "Safety Manual", "Read-Only Operations"],
            active: true
        },
        {
            internal_tier_id: "tier_pro",
            display_name: "Pro Crew",
            marketing_tagline: "Power your entire operation.",
            price_label_override: "$49/mo",
            store_ids: {
                ios: "com.citypave.tier.pro",
                android: "cp_tier_pro",
                stripe: "price_pro_monthly"
            },
            modules_unlocked: ["estimator", "operations", "fleet", "employee", "sketch"],
            feature_bullets: ["Unlimited Estimates", "Dispatch & Scheduling", "Fleet Management", "Employee Time Cards"],
            active: true
        },
        {
            internal_tier_id: "tier_enterprise",
            display_name: "Enterprise",
            marketing_tagline: "The ultimate command center.",
            price_label_override: "Contact Sales",
            store_ids: {
                ios: "com.citypave.tier.ent",
                android: "cp_tier_ent",
                stripe: "price_enterprise"
            },
            modules_unlocked: ["all"],
            feature_bullets: ["All Modules API Access", "AI Overlay", "White Label Client Portal", "Priority Support"],
            active: true
        }
    ];

    for (const plan of plans) {
        await setDoc(doc(db, "subscription_plans", plan.internal_tier_id), plan);
        console.log(`   -> Seeded Plan: ${plan.display_name}`);
    }

    // Seed Validation/Config Doc
    await setDoc(doc(db, "sys_admin", "monetization_config"), {
        stripe_publishable_key: "pk_test_12345mock",
        last_updated: new Date().toISOString()
    });
}

window.seedWorld = seedWorld;
window.seedMonetization = seedMonetization;
// seedWorld(); // Uncomment to auto-run

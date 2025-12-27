// © 2025 City Pave. All Rights Reserved.
// Filename: pricing_migration.js
// ONE-TIME SCRIPT: Migrates hardcoded pricing to Firestore

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { pricingOptions } from './pricing.js'; // Import your existing prices

// --- 1. YOUR CONFIG ---
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

// --- 2. DATA PREPARATION ---

// A. Fuel Surcharge & Global Settings
const globalSettings = {
    id: 'global_settings',
    fuel: {
        isActive: true,         // Is the surcharge logic on?
        baselinePrice: 1.50,    // Base rate ($/L) established in contract
        currentPrice: 1.50,     // Current pump price (You edit this in the Wizard)
        threshold: 0.05,        // Cents deviation required to trigger surcharge
        surchargeRate: 1.0      // % increase per threshold step
    },
    taxRate: 0.05,
    updatedAt: new Date().toISOString()
};

// B. Engine Variables (The "Secret Sauce" for Snow & Excavation)
// We move these from hard-coded variables to the database so you can tune them.
const engineVariables = [
    {
        id: 'engine_snow_v1',
        name: 'Snow Clearing Engine',
        mode: 'engine',
        variables: {
            loader_rate: 160,
            skid_steer_rate: 110,
            shovel_crew_rate: 130,
            dump_truck_rate: 125,
            salting_truck_rate: 130,
            loader_performance_sqft: 45000,
            skid_performance_sqft: 12000,
            shovel_performance_sqft: 2000,
            truck_capacity_m3: 17.2,
            min_charge_hours: 4
        }
    },
    {
        id: 'engine_excavation_v1',
        name: 'Excavation Engine',
        mode: 'engine',
        variables: {
            excavator_efficiency: 0.85,
            standard_cycle_time_sec: 25,
            avg_haul_speed_kmh: 40,
            dump_wait_time_min: 10,
            truck_capacity_loose_yds: 18
        }
    }
];

// --- 3. EXECUTION ---

async function runMigration() {
    console.log("Starting Pricing Migration...");
    
    try {
        // Sign in to allow writing to DB
        await signInAnonymously(auth);
        
        // Use a Batch write for safety (all or nothing)
        const batch = writeBatch(db);

        // 1. Add Global Settings
        const settingsRef = doc(db, 'pricing_library', globalSettings.id);
        batch.set(settingsRef, globalSettings);
        console.log("Prepared Global Settings...");

        // 2. Add Engine Variables
        engineVariables.forEach(engine => {
            const ref = doc(db, 'pricing_library', engine.id);
            batch.set(ref, engine);
        });
        console.log("Prepared Engines...");

        // 3. Add Standard Line Items (From pricing.js)
        pricingOptions.forEach(item => {
            if (item.id === 'none') return; // Skip the placeholder
            
            const ref = doc(db, 'pricing_library', item.id);
            
            // Auto-detect if this item consumes fuel (for the surcharge)
            const isEquipment = item.name.toLowerCase().includes('equipment') || 
                                item.name.toLowerCase().includes('truck') || 
                                item.name.toLowerCase().includes('skid') ||
                                item.name.toLowerCase().includes('loader');

            batch.set(ref, {
                ...item,
                consumesFuel: isEquipment, // Auto-tag fuel items
                tenantId: 'citypave',      // Future-proofing for SaaS
                mode: item.variants ? 'variant' : (item.calculation ? 'dynamic' : 'simple'),
                updatedAt: new Date().toISOString()
            });
        });
        console.log(`Prepared ${pricingOptions.length} Line Items...`);

        // 4. Commit to Database
        await batch.commit();
        
        console.log("Migration Complete! Database seeded.");
        alert("Success! Your Pricing Library and Fuel Settings are now in Firestore.");

    } catch (error) {
        console.error("Migration Failed:", error);
        alert("Migration Failed: " + error.message);
    }
}

// Run automatically when loaded
runMigration();
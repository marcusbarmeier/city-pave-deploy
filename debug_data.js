
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, limit, query } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { activeConfig } from './firebase-config.js';

const app = initializeApp(activeConfig);
const db = getFirestore(app);

async function checkData() {
    console.log("Checking Firestore for Dashcam Clips...");
    try {
        const q = query(collection(db, "dashcam_clips"), orderBy("timestamp", "desc"), limit(5));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log("❌ No dashcam clips found in 'dashcam_clips' collection.");
        } else {
            console.log(`✅ Found ${snap.size} clips:`);
            snap.forEach(doc => {
                const d = doc.data();
                console.log(` - ID: ${doc.id}, User: ${d.userId}, Time: ${d.timestamp}, URL: ${d.url}`);
            });
        }
    } catch (e) {
        console.error("Error querying Firestore:", e);
    }
}

checkData();

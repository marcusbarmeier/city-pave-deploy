
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { activeConfig } from "../../firebase-config.js";

const app = initializeApp(activeConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

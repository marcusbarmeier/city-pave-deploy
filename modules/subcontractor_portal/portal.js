/**
 * Subcontractor Portal Logic
 * Should be standalone/separate from main app logic largely.
 */

// State
let currentUser = null; // Mock session

document.addEventListener('DOMContentLoaded', () => {
    initAuthPlaceholder();
    initRegistration();
});

function initAuthPlaceholder() {
    // Check for "session" (simple mock in localStorage for demo)
    const storedUser = localStorage.getItem('cp_sub_user');

    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    } else {
        showOnboarding();
    }

    const loginBtn = document.getElementById('login-btn');
    loginBtn.addEventListener('click', () => {
        if (currentUser) {
            // Logout
            localStorage.removeItem('cp_sub_user');
            window.location.reload();
        } else {
            // Just simulate login for now - scroll to/focus registration
            document.getElementById('view-onboarding').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

function showOnboarding() {
    document.getElementById('view-onboarding').classList.remove('hidden');
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('login-btn').innerText = 'Log In';
}

function showDashboard() {
    document.getElementById('view-onboarding').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('login-btn').innerText = 'Log Out';

    // Update banner
    const bannerTitle = document.querySelector('#view-dashboard h2');
    if (currentUser && currentUser.company) {
        bannerTitle.innerText = `Welcome, ${currentUser.company}`;
    }
}

function initRegistration() {
    const form = document.getElementById('registration-form');

    // File Upload Simulators
    const uploadZones = document.querySelectorAll('.border-dashed');
    uploadZones.forEach(zone => {
        zone.addEventListener('click', () => {
            // Mock file selection
            const originalContent = zone.innerHTML;
            zone.innerHTML = `
                <div class="animate-pulse">
                    <svg class="w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    <p class="text-sm font-bold text-blue-600">Uploaded!</p>
                </div>
             `;
            zone.classList.add('bg-blue-50', 'border-blue-500');
            zone.classList.remove('border-gray-300', 'hover:bg-gray-50');
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = 'Submitting...';
        btn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            const companyName = form.querySelector('input[type="text"]').value;

            // Create Mock User
            const newUser = {
                id: 'sub_' + Date.now(),
                company: companyName,
                verified: false // Requires admin review
            };

            localStorage.setItem('cp_sub_user', JSON.stringify(newUser));
            currentUser = newUser;

            showDashboard();
            btn.innerText = originalText;
            btn.disabled = false;

            window.scrollTo(0, 0);
        }, 1500);
    });
}

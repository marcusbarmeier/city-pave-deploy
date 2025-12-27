import { MarketplaceAgent } from './ai-agent.js';

// Init Agent
const agent = new MarketplaceAgent();

// State
let activeTab = 'active-jobs';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initJobModal();
    renderJobs();
    renderSubcontractors();
    renderAIInsights();
});

// --- Tabs handling ---
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // UI Update
            tabs.forEach(t => {
                t.classList.remove('active-tab', 'border-blue-500', 'text-blue-600');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('active-tab', 'border-blue-500', 'text-blue-600');
            tab.classList.remove('border-transparent', 'text-gray-500');

            // View Switch
            const targetId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`view-${targetId}`).classList.remove('hidden');

            activeTab = targetId;
        });
    });
}

// --- Job Modal ---
function initJobModal() {
    const btn = document.getElementById('post-job-btn');
    const modal = document.getElementById('new-job-modal');
    const submitBtn = document.getElementById('submit-job-btn');

    btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    submitBtn.addEventListener('click', () => {
        // Collect data
        const title = document.getElementById('job-title-input').value;
        const location = document.getElementById('job-location-input').value;
        const budget = document.getElementById('job-budget-input').value;

        if (!title) return alert('Please enter a job title');

        // Mock Post
        const newJob = {
            id: 'job_' + Date.now(),
            title,
            location,
            budget,
            status: 'open',
            bids: 0,
            deadline: new Date(Date.now() + 86400000 * 7),
            date: 'Just now'
        };

        // UI Feedback
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Posting...';

        setTimeout(() => {
            // Append to list (visual only for now)
            addJobCard(newJob, true);
            modal.classList.add('hidden');
            submitBtn.innerText = originalText;

            // Clear form
            document.getElementById('job-title-input').value = '';
            document.getElementById('job-location-input').value = '';
        }, 800);
    });
}

// --- Renderers ---

function renderJobs() {
    const container = document.getElementById('job-list-container');
    container.innerHTML = ''; // Clear loading

    agent.jobs.forEach(job => addJobCard(job));
}

function addJobCard(job, prepend = false) {
    const container = document.getElementById('job-list-container');

    // Check AI Health
    const health = agent.analyzeBiddingHealth(job);
    let statusBadge = '';

    if (health.status === 'critical') {
        statusBadge = `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Action Needed</span>`;
    } else {
        statusBadge = `<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Active</span>`;
    }

    const html = `
        <div class="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start animate-fade-in">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                    <h3 class="font-bold text-gray-900 text-lg">${job.title}</h3>
                    ${statusBadge}
                </div>
                <div class="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span class="flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ${job.location}</span>
                    <span class="flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${job.deadline ? Math.ceil((new Date(job.deadline) - Date.now()) / (1000 * 60 * 60 * 24)) + ' days left' : 'No deadline'}</span>
                </div>
                <div class="flex gap-2">
                    ${(job.requiredSkills || []).map(skill => `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wide">${skill}</span>`).join('')}
                </div>
            </div>
            
            <div class="text-right flex flex-col items-end gap-2">
                <div class="text-2xl font-bold text-gray-900">${job.bids} <span class="text-sm font-normal text-gray-500">Bids</span></div>
                <button class="text-blue-600 font-medium text-sm hover:underline">Manage Job &rarr;</button>
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;

    if (prepend) {
        container.insertBefore(div.firstElementChild, container.firstChild);
    } else {
        container.appendChild(div.firstElementChild);
    }
}

function renderSubcontractors() {
    const container = document.getElementById('subcontractor-grid');
    container.innerHTML = '';

    agent.subcontractors.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4';
        div.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-center gap-4">
                    <img src="${sub.avatar}" class="w-12 h-12 rounded-full bg-gray-100 object-cover">
                    <div>
                        <h3 class="font-bold text-gray-900">${sub.name}</h3>
                        <p class="text-sm text-gray-500 flex items-center gap-1">
                            <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path></svg>
                            ${sub.location}
                        </p>
                    </div>
                </div>
                ${sub.verified ? `<span class="bg-blue-50 text-blue-600 p-1.5 rounded-full" title="Verified Vetting Docs"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></span>` : ''}
            </div>
            
            <div class="border-t border-gray-100 pt-4 mt-auto">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-sm font-medium text-gray-700">Rating</span>
                    <span class="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                        ${sub.rating} <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    </span>
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                     ${(sub.skills || []).map(skill => `<span class="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-1 rounded">${skill}</span>`).join('')}
                </div>
                <button class="w-full border border-gray-300 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 text-sm">View Vetting Docs</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderAIInsights() {
    const container = document.getElementById('ai-feed');
    container.innerHTML = '';

    const insights = agent.getInsights();

    if (insights.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4">No new insights right now.</p>';
        return;
    }

    insights.forEach(insight => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4';

        let iconClass = 'bg-gray-100 text-gray-500';
        if (insight.type === 'match') iconClass = 'bg-purple-100 text-purple-600';
        if (insight.type === 'alert') iconClass = 'bg-amber-100 text-amber-600';

        div.innerHTML = `
            <div class="${iconClass} p-2 rounded-lg shrink-0">
                ${getIcon(insight.icon)}
            </div>
            <div>
                <h4 class="font-bold text-gray-800 text-sm">${insight.title}</h4>
                <p class="text-sm text-gray-600 mt-1">${insight.description}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function getIcon(name) {
    if (name === 'star') return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`;
    if (name === 'warning') return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    return '';
}

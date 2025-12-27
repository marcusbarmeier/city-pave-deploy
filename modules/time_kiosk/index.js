// Time Kiosk Module
// Handles time logs, approvals, and payroll exports.

export async function loadTimeLogs() {
    const { db, collection, query, orderBy, limit, getDocs } = window.firebaseServices;
    const tbody = document.getElementById('time-table-body');
    if (!tbody) return;

    try {
        const q = query(collection(db, "time_logs"), orderBy("startTime", "desc"), limit(50));
        const snapshot = await getDocs(q);
        tbody.innerHTML = snapshot.empty ? '<tr><td colspan="7" class="p-6 text-center text-gray-500">No time logs found.</td></tr>' : '';
        window.timeLogCache = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            window.timeLogCache[doc.id] = data;
            const start = new Date(data.startTime);
            const end = data.endTime ? new Date(data.endTime) : null;
            let duration = "Active Now";
            if (end) {
                const diffMs = end - start;
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                duration = `${hours}h ${mins}m`;
            }

            const isApproved = data.isApproved === true;
            const statusBadge = isApproved
                ? `<span class="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">Approved</span>`
                : (data.status === 'active'
                    ? `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Active</span>`
                    : `<span class="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">Pending</span>`);

            const row = `
                <tr class="bg-white border-b hover:bg-gray-50">
                    <td class="px-6 py-4"><input type="checkbox" class="log-checkbox" value="${doc.id}" ${isApproved ? 'disabled' : ''}></td>
                    <td class="px-6 py-4 font-medium text-gray-900">${data.userName || 'Unknown'}</td>
                    <td class="px-6 py-4">${data.jobName || 'General'}</td>
                    <td class="px-6 py-4">${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="px-6 py-4 font-mono">${duration}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4">
                        ${!isApproved && data.status !== 'active' ? `<button onclick="approveTimeLog('${doc.id}')" class="text-green-600 hover:underline font-bold text-xs">Approve</button>` : ''}
                        ${data.updates && data.updates.length > 0 ? `<button onclick="openShiftUpdatesModal('${doc.id}')" class="ml-2 text-blue-600 hover:underline text-xs">${data.updates.length} Updates</button>` : ''}
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });
    } catch (error) { if (error.code !== 'failed-precondition') console.error("Error loading logs:", error); }
}

export async function approveTimeLog(logId) {
    const { db, doc, updateDoc } = window.firebaseServices;
    try {
        await updateDoc(doc(db, "time_logs", logId), { isApproved: true });
        loadTimeLogs(); // Refresh
    } catch (e) { alert("Error: " + e.message); }
}

export async function bulkApprove() {
    const checkboxes = document.querySelectorAll('.log-checkbox:checked');
    if (checkboxes.length === 0) return alert("Select logs to approve.");
    if (!confirm(`Approve ${checkboxes.length} logs?`)) return;

    const { db, doc, updateDoc } = window.firebaseServices;
    let count = 0;
    for (const cb of checkboxes) {
        try {
            await updateDoc(doc(db, "time_logs", cb.value), { isApproved: true });
            count++;
        } catch (e) { console.error(e); }
    }
    alert(`Approved ${count} logs.`);
    loadTimeLogs();
}

export function toggleAllLogs(source) {
    document.querySelectorAll('.log-checkbox').forEach(cb => {
        if (!cb.disabled) cb.checked = source.checked;
    });
}

export function exportPayrollCSV() {
    if (!window.timeLogCache) return alert("No data to export.");

    let csv = "Log ID,Employee,Job,Date,Start Time,End Time,Duration (Hrs),Status,Approved\n";

    Object.entries(window.timeLogCache).forEach(([id, log]) => {
        const start = new Date(log.startTime);
        const end = log.endTime ? new Date(log.endTime) : null;
        let duration = 0;
        if (end) duration = ((end - start) / 3600000).toFixed(2);

        csv += `"${id}","${log.userName}","${log.jobName}","${start.toLocaleDateString()}","${start.toLocaleTimeString()}","${end ? end.toLocaleTimeString() : ''}","${duration}","${log.status}","${log.isApproved ? 'Yes' : 'No'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

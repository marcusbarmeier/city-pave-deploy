// Inventory & Assets Module
// Handles fleet management and inventory tracking.

let vehicles = [];

export async function loadFleet() {
    const list = document.getElementById('vehicle-list');
    if (!list) return;

    // Mock Data
    vehicles = [
        { id: 'v1', name: 'Ford F-250 (Unit 101)', type: 'Truck', status: 'Active' },
        { id: 'v2', name: 'Bobcat S70', type: 'Skid Steer', status: 'Maintenance' },
        { id: 'v3', name: 'Dump Trailer 12ft', type: 'Trailer', status: 'Active' }
    ];

    list.innerHTML = '';
    vehicles.forEach(v => {
        const icon = v.type === 'Truck' ? '🚛' : (v.type === 'Skid Steer' ? '🚜' : '🛒');
        const statusColor = v.status === 'Active' ? 'text-green-600' : 'text-orange-500';

        const item = `
            <li class="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                <div class="flex items-center gap-3">
                    <span class="text-xl">${icon}</span>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">${v.name}</div>
                        <div class="text-xs text-gray-500">${v.type}</div>
                    </div>
                </div>
                <div class="text-xs font-bold ${statusColor}">${v.status}</div>
            </li>
        `;
        list.innerHTML += item;
    });
}


// modules/excavation_calc/excavation-core.js

/**
 * Calculates excavation metrics based on area, soil props, and equipment.
 * @param {Object} inputs - The input parameters.
 * @returns {Object} Calculated metrics (volumes, loads, cycle times, etc.).
 */
export function calculateExcavationMetrics(inputs) {
    const {
        areaSqFt,
        depthFt,
        swellFactor,
        truckCapacityLooseYd,
        bucketSizeYd,
        excCycleSec,
        efficiencyPercent,
        haulDistKm,
        haulSpeedKmh,
        dumpWaitMin
    } = inputs;

    // --- 1. VOLUMES ---
    const bankVolCuFt = areaSqFt * depthFt;
    const bankVolCuYd = bankVolCuFt / 27;
    const looseVolCuYd = bankVolCuYd * swellFactor;

    // --- 2. LOADS ---
    // Ensure capacity > 0 to avoid Infinity
    const safeTruckCap = truckCapacityLooseYd > 0 ? truckCapacityLooseYd : 1;
    const totalLoads = Math.ceil(looseVolCuYd / safeTruckCap);

    // --- 3. CYCLE TIMES & FLEET ---
    const efficiencyDecimal = (efficiencyPercent || 85) / 100;

    // Excavator Production Rate
    // Buckets per truck = Capacity / Bucket Size
    const bucketsPerTruck = Math.ceil(safeTruckCap / (bucketSizeYd || 1));

    // Load time per truck (mins) = (Buckets * CycleSec) / 60 / Efficiency
    // If cycle sec is 0, assume instantaneous (unrealistic but avoids NaN)
    const loadTimeMin = (bucketsPerTruck * (excCycleSec || 25)) / 60 / efficiencyDecimal;

    // Truck Cycle
    // Travel Time (Round Trip) = (Dist / Speed) * 60 * 2
    const safeSpeed = haulSpeedKmh > 0 ? haulSpeedKmh : 1;
    const travelTimeMin = (haulDistKm / safeSpeed) * 60 * 2;

    const truckCycleMin = loadTimeMin + travelTimeMin + dumpWaitMin;

    // Optimization: How many trucks to keep Exc busy?
    // Trucks Needed = Truck Cycle Time / Load Time
    const trucksNeeded = loadTimeMin > 0 ? truckCycleMin / loadTimeMin : 0;

    // --- 4. DURATION ---
    // Total Duration depends on if we are Truck-Limited or Excavator-Limited.
    // For this calculation, we assume the user provides the "Ideal" fleet (Trucks Needed)
    // or we calculate duration based on the Excavator's max output (Optimization view).

    // Max loads per hour (Excavator constraint) = 60 / LoadTime
    const maxLoadsPerHour = loadTimeMin > 0 ? 60 / loadTimeMin : 0;

    // Total Hours
    const totalHours = maxLoadsPerHour > 0 ? totalLoads / maxLoadsPerHour : 0;

    // --- 5. WARNINGS ---
    const warnings = [];
    if (swellFactor === 1.3 && excCycleSec < 40) {
        warnings.push({ type: 'warning', msg: `${excCycleSec}s is too optimistic for heavy clay. Recommend >40s.` });
    } else if (swellFactor === 1.5 && excCycleSec < 45) {
        warnings.push({ type: 'error', msg: `Rock excavation typically requires >45s cycle times.` });
    }

    return {
        volumes: {
            bankCuYd: bankVolCuYd,
            looseCuYd: looseVolCuYd
        },
        loads: totalLoads,
        cycles: {
            loadTimeMin,
            travelTimeMin,
            truckCycleMin
        },
        optimization: {
            trucksNeeded,
            bucketsPerTruck
        },
        durationHours: totalHours,
        warnings
    };
}

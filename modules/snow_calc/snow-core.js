// © 2025 City Pave. All Rights Reserved.
// Filename: snow-core.js
// Description: Core calculation logic for Snow Services

// *** UPDATED RATES ***
const EQUIPMENT_RATES = {
    loader: 160,                // Updated Loader Rate
    skidSteer: 110,             // Skid Steer Rate (already correct)
    twoPersonShovelCrew: 130,   // Updated 2-Person Shovel Crew Rate (2 * $65)
    dumpTruck: 125,             // Dump Truck Rate (unchanged)
    saltingTruck: 130           // Salting Truck Rate (unchanged)
};
// *** END UPDATED RATES ***

const PERFORMANCE_RATES = {
    loader: 45000,      // Sq Ft per Hour
    skidSteer: 12000,   // Sq Ft per Hour
    shovel: 2000,       // Sq Ft per Hour (per 2-person crew)
};

const SEASONAL_CONSTANTS = {
    eventsPerTrigger: { '5cm': 16, '3cm': 23, '2cm': 30 }, // Estimated events per season
    truckCapacityM3: 17.2, // Truck Capacity
    fourHourMinimumCost: 4 * EQUIPMENT_RATES.loader // Example: Loader minimum
};

// Calculates a single location, applying the 4-hour minimum if needed.
export function calculateSnowServiceCost(inputs) {
    const clearingResult = inputs.clearing.enabled ? calculateClearingCost(inputs, true) : createEmptyResult();
    const haulingResult = inputs.hauling.enabled ? calculateHaulingCost(inputs, clearingResult, true) : createEmptyResult();
    const saltingResult = inputs.salting.enabled ? calculateSaltingCost(inputs, true) : createEmptyResult();

    // Calculate Seasonal Costs based on frequencies
    const clearingSaltingEvents = SEASONAL_CONSTANTS.eventsPerTrigger[inputs.clearingTrigger] || 16;
    const haulingEvents = inputs.haulingInterval > 0 ? inputs.haulingInterval : (inputs.hauling.enabled ? clearingSaltingEvents : 0);

    const clearingSeasonalCost = clearingResult.cost * clearingSaltingEvents;
    const haulingSeasonalCost = haulingResult.cost * haulingEvents;
    const saltingSeasonalCost = saltingResult.cost * clearingSaltingEvents;

    // Sum costs for Per Push and Seasonal
    const perPushPrice = clearingResult.cost + haulingResult.cost + saltingResult.cost;
    const seasonalPrice = clearingSeasonalCost + haulingSeasonalCost + saltingSeasonalCost;

    // Calculate Monthly Price
    const contractDuration = inputs.contractDuration > 0 ? inputs.contractDuration : 5;
    let monthlyPrice = 0;
    if (inputs.includedEventsPerMonth > 0) {
        monthlyPrice = perPushPrice * inputs.includedEventsPerMonth;
    } else {
        monthlyPrice = contractDuration > 0 ? seasonalPrice / contractDuration : 0;
    }

    return {
        clearingResult,
        haulingResult,
        saltingResult,
        totals: {
            perPushPrice: isNaN(perPushPrice) ? 0 : perPushPrice,
            monthlyPrice: isNaN(monthlyPrice) ? 0 : monthlyPrice,
            seasonalPrice: isNaN(seasonalPrice) ? 0 : seasonalPrice
        }
    };
}

// Calculates multiple locations for a routed job
export async function calculateSnowRouteCost(allLocationInputs, getTravelTimeBetween) {
    // 1. Calculate individual results WITHOUT 4-hour minimums
    const individualResultsPromises = allLocationInputs.map(async (inputs) => {
        const clearing = inputs.clearing.enabled ? calculateClearingCost(inputs, false) : createEmptyResult();
        const hauling = inputs.hauling.enabled ? calculateHaulingCost(inputs, clearing, false) : createEmptyResult();
        const salting = inputs.salting.enabled ? calculateSaltingCost(inputs, false) : createEmptyResult();
        clearing.onSiteHours = clearing.onSiteHours || 0;
        hauling.onSiteHours = hauling.onSiteHours || 0;
        salting.onSiteHours = salting.onSiteHours || 0;
        return { id: inputs.id, clearing, hauling, salting };
    });
    const individualResults = await Promise.all(individualResultsPromises);

    // 2. Determine the master fleet needed for the entire route
    const routeFleet = { loaders: 0, skidSteers: 0, shovelCrews: 0, trucks: 0, saltingTrucks: 0 };
    individualResults.forEach(res => {
        routeFleet.loaders = Math.max(routeFleet.loaders, (res.clearing.equipment.numLoaders || 0) + (res.hauling.equipment.numLoaders || 0));
        routeFleet.skidSteers = Math.max(routeFleet.skidSteers, res.clearing.equipment.numSkidSteers || 0);
        routeFleet.shovelCrews = Math.max(routeFleet.shovelCrews, Math.ceil((res.clearing.equipment.numShovelers || 0) / 2));
        routeFleet.trucks = Math.max(routeFleet.trucks, res.hauling.equipment.numTrucks || 0);
        routeFleet.saltingTrucks = Math.max(routeFleet.saltingTrucks, res.salting.equipment.numSaltingTrucks || 0);
    });

    // Calculate the hourly rate for the combined master fleet
    const fleetHourlyRate = (routeFleet.loaders * EQUIPMENT_RATES.loader) +
        (routeFleet.skidSteers * EQUIPMENT_RATES.skidSteer) +
        (routeFleet.shovelCrews * EQUIPMENT_RATES.twoPersonShovelCrew) +
        (routeFleet.trucks * EQUIPMENT_RATES.dumpTruck) +
        (routeFleet.saltingTrucks * EQUIPMENT_RATES.saltingTruck);

    // 3. Calculate total time
    let totalOnSiteHours = 0;
    individualResults.forEach(res => {
        totalOnSiteHours += Math.max(res.clearing.onSiteHours, res.hauling.onSiteHours, res.salting.onSiteHours);
    });

    let interPropertyTravelHours = 0;
    for (let i = 0; i < allLocationInputs.length - 1; i++) {
        const origin = allLocationInputs[i].address;
        const destination = allLocationInputs[i + 1].address;
        if (origin && destination) {
            const travelTime = await getTravelTimeBetween(origin, destination);
            interPropertyTravelHours += (isNaN(travelTime) ? 0.25 : travelTime);
        }
    }

    const finalTravelHour = 1;
    const totalBillableHours = totalOnSiteHours + interPropertyTravelHours + finalTravelHour;
    let totalRouteCost = totalBillableHours * fleetHourlyRate;
    totalRouteCost = isNaN(totalRouteCost) ? 0 : totalRouteCost;

    // 4. Distribute the total route cost back proportionally
    const finalResults = individualResults.map((res, i) => {
        const locationOnSiteHours = Math.max(res.clearing.onSiteHours, res.hauling.onSiteHours, res.salting.onSiteHours);
        const proportion = totalOnSiteHours > 0 ? (locationOnSiteHours / totalOnSiteHours) : 0;
        let proportionalCost = totalRouteCost * proportion;
        proportionalCost = isNaN(proportionalCost) ? 0 : proportionalCost;

        const perPushPrice = proportionalCost;
        const currentInputs = allLocationInputs[i];
        const clearingSaltingEvents = SEASONAL_CONSTANTS.eventsPerTrigger[currentInputs.clearingTrigger] || 16;
        const haulingEvents = currentInputs.haulingInterval > 0 ? currentInputs.haulingInterval : (currentInputs.hauling.enabled ? clearingSaltingEvents : 0);

        let seasonalPrice = 0;
        const nonMinClearingCost = currentInputs.clearing.enabled ? calculateClearingCost(currentInputs, false).cost : 0;
        const nonMinHaulingCost = currentInputs.hauling.enabled ? calculateHaulingCost(currentInputs, createEmptyResult(), false).cost : 0;
        const nonMinSaltingCost = currentInputs.salting.enabled ? calculateSaltingCost(currentInputs, false).cost : 0;
        const nonMinTotal = nonMinClearingCost + nonMinHaulingCost + nonMinSaltingCost;

        if (nonMinTotal > 0) {
            if (currentInputs.clearing.enabled) seasonalPrice += (nonMinClearingCost / nonMinTotal) * perPushPrice * clearingSaltingEvents;
            if (currentInputs.hauling.enabled) seasonalPrice += (nonMinHaulingCost / nonMinTotal) * perPushPrice * haulingEvents;
            if (currentInputs.salting.enabled) seasonalPrice += (nonMinSaltingCost / nonMinTotal) * perPushPrice * clearingSaltingEvents;
        } else if (perPushPrice > 0) {
            let enabledCount = (currentInputs.clearing.enabled ? 1 : 0) + (currentInputs.hauling.enabled ? 1 : 0) + (currentInputs.salting.enabled ? 1 : 0);
            if (enabledCount > 0) {
                if (currentInputs.clearing.enabled) seasonalPrice += (1 / enabledCount) * perPushPrice * clearingSaltingEvents;
                if (currentInputs.hauling.enabled) seasonalPrice += (1 / enabledCount) * perPushPrice * haulingEvents;
                if (currentInputs.salting.enabled) seasonalPrice += (1 / enabledCount) * perPushPrice * clearingSaltingEvents;
            }
        }
        seasonalPrice = isNaN(seasonalPrice) ? 0 : seasonalPrice;

        const contractDuration = currentInputs.contractDuration > 0 ? currentInputs.contractDuration : 5;
        let monthlyPrice = 0;
        if (currentInputs.includedEventsPerMonth > 0) {
            monthlyPrice = perPushPrice * currentInputs.includedEventsPerMonth;
        } else {
            monthlyPrice = contractDuration > 0 ? seasonalPrice / contractDuration : 0;
        }
        monthlyPrice = isNaN(monthlyPrice) ? 0 : monthlyPrice;

        return {
            id: res.id,
            clearingResult: res.clearing,
            haulingResult: res.hauling,
            saltingResult: res.salting,
            totals: {
                perPushPrice: perPushPrice,
                monthlyPrice: monthlyPrice,
                seasonalPrice: seasonalPrice
            }
        };
    });

    return finalResults;
}


// --- Individual Service Calculation Functions ---

function calculateClearingCost(inputs, applyMinimum) {
    const { loaderArea, skidSteerArea, shovelArea } = inputs.clearing;
    const { targetHours } = inputs;
    let onSiteHours = 0, numLoaders = 0, numSkidSteers = 0, numShovelCrews = 0;

    numLoaders = loaderArea > 0 ? 1 : 0;
    numSkidSteers = skidSteerArea > 0 ? 1 : 0;
    numShovelCrews = shovelArea > 0 ? 1 : 0;

    const timeForLoaders = numLoaders > 0 ? loaderArea / (numLoaders * PERFORMANCE_RATES.loader) : 0;
    const timeForSkids = numSkidSteers > 0 ? skidSteerArea / (numSkidSteers * PERFORMANCE_RATES.skidSteer) : 0;
    const timeForShovels = numShovelCrews > 0 ? shovelArea / (numShovelCrews * PERFORMANCE_RATES.shovel) : 0;
    let calculatedHours = Math.max(timeForLoaders, timeForSkids, timeForShovels);
    calculatedHours = isNaN(calculatedHours) ? 0 : calculatedHours;


    if (targetHours > 0 && targetHours < calculatedHours) {
        onSiteHours = targetHours;
        numLoaders = onSiteHours > 0 ? Math.ceil((loaderArea / onSiteHours) / PERFORMANCE_RATES.loader) : 0;
        numSkidSteers = onSiteHours > 0 ? Math.ceil((skidSteerArea / onSiteHours) / PERFORMANCE_RATES.skidSteer) : 0;
        numShovelCrews = onSiteHours > 0 ? Math.ceil((shovelArea / onSiteHours) / PERFORMANCE_RATES.shovel) : 0;
        const recalcTimeLoaders = numLoaders > 0 ? loaderArea / (numLoaders * PERFORMANCE_RATES.loader) : 0;
        const recalcTimeSkids = numSkidSteers > 0 ? skidSteerArea / (numSkidSteers * PERFORMANCE_RATES.skidSteer) : 0;
        const recalcTimeShovels = numShovelCrews > 0 ? shovelArea / (numShovelCrews * PERFORMANCE_RATES.shovel) : 0;
        onSiteHours = Math.max(recalcTimeLoaders, recalcTimeSkids, recalcTimeShovels);
    } else {
        onSiteHours = Math.max(calculatedHours, targetHours);
        if (onSiteHours > 0) {
            numLoaders = Math.ceil((loaderArea / onSiteHours) / PERFORMANCE_RATES.loader);
            numSkidSteers = Math.ceil((skidSteerArea / onSiteHours) / PERFORMANCE_RATES.skidSteer);
            numShovelCrews = Math.ceil((shovelArea / onSiteHours) / PERFORMANCE_RATES.shovel);
        } else { numLoaders = 0; numSkidSteers = 0; numShovelCrews = 0; }
    }

    if (loaderArea > 0 && numLoaders === 0) numLoaders = 1;
    if (skidSteerArea > 0 && numSkidSteers === 0) numSkidSteers = 1;
    if (shovelArea > 0 && numShovelCrews === 0) numShovelCrews = 1;
    if (onSiteHours === 0 && (loaderArea > 0 || skidSteerArea > 0 || shovelArea > 0)) {
        onSiteHours = Math.max(
            numLoaders > 0 ? loaderArea / (numLoaders * PERFORMANCE_RATES.loader) : 0,
            numSkidSteers > 0 ? skidSteerArea / (numSkidSteers * PERFORMANCE_RATES.skidSteer) : 0,
            numShovelCrews > 0 ? shovelArea / (numShovelCrews * PERFORMANCE_RATES.shovel) : 0
        );
    }
    onSiteHours = isNaN(onSiteHours) ? 0 : onSiteHours;


    let cost = (numLoaders * (onSiteHours + 1) * EQUIPMENT_RATES.loader) +
        (numSkidSteers * (onSiteHours + 1) * EQUIPMENT_RATES.skidSteer) +
        (numShovelCrews * (onSiteHours + 1) * EQUIPMENT_RATES.twoPersonShovelCrew);
    cost = isNaN(cost) ? 0 : cost;

    if (applyMinimum && cost > 0 && cost < SEASONAL_CONSTANTS.fourHourMinimumCost) {
        const fleetHourlyRate = (numLoaders * EQUIPMENT_RATES.loader) + (numSkidSteers * EQUIPMENT_RATES.skidSteer) + (numShovelCrews * EQUIPMENT_RATES.twoPersonShovelCrew);
        const minWorkHours = 3;
        onSiteHours = Math.max(onSiteHours, minWorkHours);
        cost = SEASONAL_CONSTANTS.fourHourMinimumCost;
    }
    onSiteHours = isNaN(onSiteHours) ? 0 : onSiteHours;
    numLoaders = isNaN(numLoaders) ? 0 : numLoaders;
    numSkidSteers = isNaN(numSkidSteers) ? 0 : numSkidSteers;
    numShovelCrews = isNaN(numShovelCrews) ? 0 : numShovelCrews;

    return {
        cost: cost,
        onSiteHours: onSiteHours,
        equipment: {
            numLoaders: numLoaders,
            numSkidSteers: numSkidSteers,
            numShovelers: numShovelCrews * 2,
            numTrucks: 0, numSaltingTrucks: 0
        },
        logistics: {}
    };
}

function calculateHaulingCost(inputs, clearingResult, applyMinimum) {
    if (!inputs.hauling.enabled || !inputs.haulingCrew) {
        return createEmptyResult();
    }

    const { haulingCrew, roundTripTime, targetHours, haulingInterval } = inputs;
    const AVERAGE_SEASONAL_SNOWFALL_CM = 115;

    const totalClearedAreaSqFt = inputs.clearing.loaderArea + inputs.clearing.skidSteerArea + inputs.clearing.shovelArea;
    const totalClearedAreaSqM = totalClearedAreaSqFt * 0.092903;
    const haulsPerSeason = haulingInterval > 0 ? haulingInterval : 1;
    const averageDepthPerHaulM = (AVERAGE_SEASONAL_SNOWFALL_CM / 100) / haulsPerSeason;
    let snowVolumePerEventM3 = totalClearedAreaSqM * averageDepthPerHaulM;
    snowVolumePerEventM3 = isNaN(snowVolumePerEventM3) ? 0 : snowVolumePerEventM3;

    if (snowVolumePerEventM3 <= 0 || !roundTripTime || roundTripTime <= 0) {
        return createEmptyResult();
    }

    const truckLoads = Math.ceil(snowVolumePerEventM3 / SEASONAL_CONSTANTS.truckCapacityM3);
    const loadTimeHoursPerTruck = ((haulingCrew.loadTime > 0 ? haulingCrew.loadTime : 10) / 60);

    const initialHaulingLoaders = Math.max(1, haulingCrew.loaders || 0);
    const initialHaulingTrucks = Math.max(1, haulingCrew.trucks || 0);

    const MIN_LOAD_INTERVAL_HOURS = 7.5 / 60; // 7.5 minutes
    const MAX_LOAD_INTERVAL_HOURS = 10 / 60; // 10 minutes

    let finalHaulingTrucks = 0;
    let finalHaulingLoaders = 0;
    let onSiteHours = 0;

    if (targetHours > 0) {
        const loadsPerTruckPossible = Math.floor(targetHours / roundTripTime);
        const neededTrucksForTime = loadsPerTruckPossible > 0 ? Math.ceil(truckLoads / loadsPerTruckPossible) : truckLoads;
        finalHaulingTrucks = Math.max(initialHaulingTrucks, neededTrucksForTime);
    } else {
        const baselineLoaderCount = 1;
        const targetArrivalInterval = Math.min(MAX_LOAD_INTERVAL_HOURS, loadTimeHoursPerTruck / baselineLoaderCount);
        const baselineTrucks = Math.ceil(roundTripTime / targetArrivalInterval);
        finalHaulingTrucks = Math.max(initialHaulingTrucks, baselineTrucks);
    }
    finalHaulingTrucks = Math.max(1, finalHaulingTrucks);

    const actualArrivalInterval = roundTripTime / finalHaulingTrucks;
    if (actualArrivalInterval < MIN_LOAD_INTERVAL_HOURS) {
        const neededLoadersForSpeed = Math.ceil(loadTimeHoursPerTruck / actualArrivalInterval);
        finalHaulingLoaders = Math.max(initialHaulingLoaders, neededLoadersForSpeed);
    } else {
        finalHaulingLoaders = Math.max(initialHaulingLoaders, 1);
    }
    finalHaulingLoaders = Math.max(1, finalHaulingLoaders);

    onSiteHours = (truckLoads / finalHaulingTrucks) * roundTripTime;
    onSiteHours = isNaN(onSiteHours) ? 0 : onSiteHours;

    if (onSiteHours === 0 && truckLoads > 0) onSiteHours = 3;

    let cost = (finalHaulingLoaders * (onSiteHours + 1) * EQUIPMENT_RATES.loader) +
        (finalHaulingTrucks * (onSiteHours + 1) * EQUIPMENT_RATES.dumpTruck);
    cost = isNaN(cost) ? 0 : cost;

    if (applyMinimum && cost > 0 && cost < SEASONAL_CONSTANTS.fourHourMinimumCost) {
        const fleetHourlyRate = (finalHaulingLoaders * EQUIPMENT_RATES.loader) + (finalHaulingTrucks * EQUIPMENT_RATES.dumpTruck);
        const minWorkHours = fleetHourlyRate > 0 ? (SEASONAL_CONSTANTS.fourHourMinimumCost / fleetHourlyRate) - 1 : 3;
        onSiteHours = Math.max(onSiteHours, minWorkHours > 0 ? minWorkHours : 0, 3);
        cost = SEASONAL_CONSTANTS.fourHourMinimumCost;
    }
    onSiteHours = isNaN(onSiteHours) ? 0 : onSiteHours;

    finalHaulingLoaders = isNaN(finalHaulingLoaders) ? 0 : finalHaulingLoaders;
    finalHaulingTrucks = isNaN(finalHaulingTrucks) ? 0 : finalHaulingTrucks;
    let calculatedRoundTripFormatted = roundTripTime;
    calculatedRoundTripFormatted = isNaN(calculatedRoundTripFormatted) ? 0 : calculatedRoundTripFormatted;


    return {
        cost: cost,
        onSiteHours: onSiteHours,
        equipment: {
            numLoaders: finalHaulingLoaders,
            numSkidSteers: 0,
            numShovelers: 0,
            numTrucks: finalHaulingTrucks,
            numSaltingTrucks: 0
        },
        logistics: {
            snowVolumePerEventM3: snowVolumePerEventM3,
            truckLoads: truckLoads,
            truckCapacityM3: SEASONAL_CONSTANTS.truckCapacityM3,
            calculatedRoundTrip: calculatedRoundTripFormatted
        }
    };
}


function calculateSaltingCost(inputs, applyMinimum) {
    const onSiteHours = 1.5;
    let cost = (onSiteHours + 1) * EQUIPMENT_RATES.saltingTruck;

    if (applyMinimum && cost > 0 && cost < SEASONAL_CONSTANTS.fourHourMinimumCost) {
        cost = SEASONAL_CONSTANTS.fourHourMinimumCost;
    }
    cost = isNaN(cost) ? 0 : cost;

    return {
        cost: cost,
        onSiteHours: onSiteHours,
        equipment: { numLoaders: 0, numSkidSteers: 0, numShovelers: 0, numTrucks: 0, numSaltingTrucks: 1 },
        logistics: {}
    };
}


// Helper to return an empty result structure
function createEmptyResult() {
    return {
        cost: 0,
        onSiteHours: 0,
        equipment: { numLoaders: 0, numSkidSteers: 0, numShovelers: 0, numTrucks: 0, numSaltingTrucks: 0 },
        logistics: {}
    };
}

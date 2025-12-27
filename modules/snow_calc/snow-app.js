
// modules/snow_calc/snow-app.js

import { calculateSnowServiceCost, calculateSnowRouteCost } from './snow-core.js';
import { updateCardWithResults, updateSnowContractSummary, getInputsFromCard as getUIInputsFromCard } from './snow-ui.js';

// --- Helper Functions ---

async function getHaulingRoundTripTime() {
    // Fixed time based on user feedback: 0.95 hours (57 mins)
    return 0.95;
}

// Wrapper to get full inputs including calculated/global values
async function getFullInputsFromCard(card) {
    const rawInputs = await getUIInputsFromCard(card);
    const roundTripTime = await getHaulingRoundTripTime();

    // Merge raw inputs with enriched data
    return {
        ...rawInputs,
        roundTripTime: roundTripTime
    };
}

async function getTravelTimeBetweenPoints(originAddress, destinationAddress) {
    if (!originAddress || !destinationAddress || !window.google || !window.google.maps || !window.google.maps.DirectionsService) {
        return 0.25; // Default 15 mins
    }

    const directionsService = new google.maps.DirectionsService();

    return new Promise(resolve => {
        directionsService.route({
            origin: originAddress,
            destination: destinationAddress,
            travelMode: google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === 'OK') {
                const route = result.routes[0];
                let totalDurationSeconds = 0;
                route.legs.forEach(leg => {
                    totalDurationSeconds += leg.duration.value;
                });
                // 10% slow truck factor
                resolve((totalDurationSeconds / 3600) * 1.10);
            } else {
                console.warn(`Directions request failed: ${status}`);
                resolve(0.25);
            }
        });
    });
}

// --- Controller Functions ---

export async function handleAutoCalculateSnowPrice(card, showBanner = true) {
    if (!card) return;

    if (showBanner && window.ui) window.ui.showSuccessBanner("Calculating...", true);

    try {
        const inputs = await getFullInputsFromCard(card);
        const result = calculateSnowServiceCost(inputs);

        updateCardWithResults(card, result);

        // Notify user if possible (UI update handled by updateCardWithResults)
        if (showBanner && window.ui) window.ui.showSuccessBanner("Prices calculated for this location.");

        // Trigger Route Recalculation if "Routed Job" is checked
        const isRouted = document.getElementById('snow-is-routed-job')?.checked;
        if (isRouted) {
            handleRouteChange();
        } else {
            updateSnowContractSummary();
        }

    } catch (error) {
        console.error("Snow Calculation Error:", error);
        if (showBanner && window.ui) window.ui.showErrorBanner(`Calculation Error: ${error.message}`);

        // Show error on card
        const detailsContainer = card.querySelector('.snow-calculation-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = `<h4 class="font-bold mb-2">Calculation Error</h4><p class="text-red-600">${error.message}</p>`;
        }
    }
}

export async function handleRouteChange() {
    const isRouted = document.getElementById('snow-is-routed-job')?.checked;
    const allCards = document.querySelectorAll('.snow-location-card');

    if (allCards.length === 0) {
        updateSnowContractSummary();
        return;
    }

    if (window.ui) window.ui.showSuccessBanner("Recalculating prices...", true);

    try {
        if (isRouted && allCards.length > 1) {
            const allLocationInputs = [];
            for (const card of allCards) {
                const inputs = await getFullInputsFromCard(card);
                allLocationInputs.push(inputs);
            }

            // Core routing calculation
            const routeResults = await calculateSnowRouteCost(allLocationInputs, getTravelTimeBetweenPoints);

            routeResults.forEach(result => {
                const cardToUpdate = document.getElementById(result.id);
                if (cardToUpdate) {
                    updateCardWithResults(cardToUpdate, result);
                }
            });
        } else {
            // Calculate individually
            for (const card of allCards) {
                await handleAutoCalculateSnowPrice(card, false);
            }
        }
        if (window.ui) window.ui.showSuccessBanner("Prices updated.");
    } catch (error) {
        console.error("Route calculation error:", error);
        if (window.ui) window.ui.showErrorBanner(error.message);
    }
}

export function applyAllSnowLocationsToOption(costType) {
    const firstOptionCard = document.querySelector('#pricing-options-container .price-option-card');
    if (!firstOptionCard) {
        return window.ui?.showErrorBanner("Please add a Pricing Option card first.");
    }
    const firstOptionId = firstOptionCard.dataset.optionId;

    const allSnowCards = document.querySelectorAll('.snow-location-card');
    if (allSnowCards.length === 0) {
        return window.ui?.showErrorBanner("No snow locations found to apply.");
    }

    let itemsAddedCount = 0;

    allSnowCards.forEach(card => {
        const title = card.querySelector('.snow-location-title')?.value || 'Unnamed Location';
        const address = card.querySelector('.snow-location-address')?.value || 'No Address';
        const breakdownHtml = card.querySelector('.snow-calculation-details')?.innerHTML || '';

        let price = 0;
        let serviceTerm = '';

        if (costType === 'perPush') {
            price = parseFloat(card.querySelector('.snow-price-per-push')?.value) || 0;
            serviceTerm = 'Per Push Service';
        } else if (costType === 'monthly') {
            price = parseFloat(card.querySelector('.snow-price-monthly')?.value) || 0;
            serviceTerm = 'Monthly Service';
        } else {
            price = parseFloat(card.querySelector('.snow-price-seasonal')?.value) || 0;
            serviceTerm = 'Seasonal Service';
        }

        if (price > 0) {
            const itemData = {
                product: null, // Custom item
                description: `<strong>${title}</strong><br>${address}<br><em>${serviceTerm}</em><br><div class="text-xs mt-1 text-gray-500">${breakdownHtml}</div>`,
                units: 1,
                unitPrice: price,
                color: '#e0f2fe' // Light blue for snow
            };

            if (window.ui && window.ui.addItemToOption) {
                // Assuming a global saveState is available or handled by addItemToOption
                window.ui.addItemToOption(firstOptionId, itemData, true, () => { });
                itemsAddedCount++;
            }
        }
    });

    if (itemsAddedCount > 0) {
        if (window.ui) window.ui.showSuccessBanner(`Added ${itemsAddedCount} snow locations to pricing option.`);
        // We really should save state here. Assuming the caller handles it or addItemToOption does.
        // In original code, it was called directly.
    } else {
        if (window.ui) window.ui.showErrorBanner("No locations had a valid price for the selected term.");
    }
}

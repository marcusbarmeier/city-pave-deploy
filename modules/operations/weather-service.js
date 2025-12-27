// © 2025 City Pave. All Rights Reserved.
// Filename: weather-service.js

export const WeatherService = {
    cache: {},

    /**
     * Fetch 7-day forecast for a location.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<Object>}
     */
    async getForecast(lat, lng) {
        const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        const now = Date.now();

        // Simple cache (1 hour)
        if (this.cache[cacheKey] && (now - this.cache[cacheKey].timestamp < 3600000)) {
            return this.cache[cacheKey].data;
        }

        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,precipitation_sum,precipitation_probability_max&timezone=auto`);
            const data = await response.json();

            this.cache[cacheKey] = {
                timestamp: now,
                data: data
            };
            return data;
        } catch (error) {
            console.error("WeatherService Error:", error);
            return null;
        }
    },

    /**
     * Check if a specific date is expected to be rainy (>50% prob or >1mm rain).
     * @param {string} dateStr - YYYY-MM-DD
     * @param {Object} forecastData - Data returned from getForecast
     */
    isRainy(dateStr, forecastData) {
        if (!forecastData || !forecastData.daily) return false;

        const index = forecastData.daily.time.indexOf(dateStr);
        if (index === -1) return false; // Date out of range

        const precipProb = forecastData.daily.precipitation_probability_max[index];
        const precipSum = forecastData.daily.precipitation_sum[index];
        const code = forecastData.daily.weathercode[index];

        // Codes: 51-67 (Drizzle/Rain), 80-82 (Showers), 95-99 (Thunderstorm)
        const rainyCodes = [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

        const isRainyCode = rainyCodes.includes(code);
        const highProb = precipProb > 50;
        const significantRain = precipSum > 1.0;

        return isRainyCode || highProb || significantRain;
    },

    getWeatherIcon(code) {
        // Simple mapping
        if (code === 0) return '☀️';
        if (code >= 1 && code <= 3) return 'Vk';
        if (code >= 45 && code <= 48) return '🌫️';
        if (code >= 51 && code <= 67) return '🌧️';
        if (code >= 71 && code <= 77) return '❄️';
        if (code >= 80 && code <= 82) return '🌦️';
        if (code >= 95 && code <= 99) return '⛈️';
        return '❓';
    }
};

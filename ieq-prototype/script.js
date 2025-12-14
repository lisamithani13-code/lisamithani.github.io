// Core script for the Find Your Best Spot application.
// Manages user interactions, preference storage, data processing, and navigation across different pages.
console.log("script.js file has been loaded and parsed - top level.");

document.addEventListener('DOMContentLoaded', () => {

    // Section: Debug Helper Function
    // Purpose: Provides a structured way to log data flow at different stages of the application.
    // This function is primarily for development and debugging.
    function debugDataFlow(stage, dataType, data) {
        const timestamp = new Date().toISOString();
        let dataPreview = 'null/undefined';
        let dataDetails = '';

        if (data !== null && data !== undefined) {
            if (Array.isArray(data)) {
                dataPreview = `Array[${data.length}]`;
                if (data.length > 0) {
                    try {
                        dataDetails = JSON.stringify(data.slice(0, (typeof data[0] === 'object' ? 2 : 5)));
                    } catch (e) {
                        dataDetails = "[Error stringifying array preview]";
                    }
                }
            } else if (typeof data === 'object') {
                dataPreview = 'Object';
                try {
                    const keys = Object.keys(data);
                    dataDetails = `Keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`;
                } catch (e) {
                    dataDetails = "[Error stringifying object preview]";
                }
            } else if (typeof data === 'string') {
                dataPreview = 'String';
                dataDetails = data.substring(0, 100) + (data.length > 100 ? '...' : '');
            } else {
                dataPreview = typeof data;
                dataDetails = data.toString();
            }
        }

        console.log(`[${timestamp}][${stage}][${dataType}]: ${dataPreview} - ${dataDetails}`);

        try {
            const debugHistory = JSON.parse(localStorage.getItem('debugHistory') || '[]');
            debugHistory.push({
                timestamp,
                stage,
                dataType,
                dataPreview,
                url: window.location.pathname + window.location.search
            });
            localStorage.setItem('debugHistory', JSON.stringify(debugHistory.slice(-30)));
        } catch (e) {
            console.warn("Could not update debugHistory in localStorage", e);
        }
    }

    // Section: Global Utility Functions
    // Purpose: Provides globally accessible helper functions for navigation and actions.
    function goBack() {
        window.history.back();
    }

    function findAlternatives() {
        // Retrieves final recommendations and current zone ID to filter and redirect.
        const recommendations = JSON.parse(localStorage.getItem('finalRecommendations') || '[]');
        const currentZoneId = new URLSearchParams(window.location.search).get('id');
        const alternatives = recommendations.filter(rec => rec.zoneId !== currentZoneId);
        window.location.href = 'results.html#alternatives'; // Navigates to results page, potentially to an alternatives section.
    }

    function bookSpace() {
        // Retrieves current zone ID and redirects to the booking confirmation page.
        const currentZoneId = new URLSearchParams(window.location.search).get('id');
        if (!currentZoneId) {
            // AI: This alert is a basic error handling. Consider replacing with a custom modal.
            alert('Zone ID not found. Please try again.');
            return;
        }
        window.location.href = `booking-confirmation.html?zone=${encodeURIComponent(currentZoneId)}`;
    }

    // Assign utility functions to the window object to make them globally accessible (e.g., for inline HTML event handlers).
    window.goBack = goBack;
    window.findAlternatives = findAlternatives;
    window.bookSpace = bookSpace;

    // Section: Shared Data and Configurations
    // Purpose: Defines constant thresholds, mappings, and configurations used throughout the application.
    const lightingThresholds = {
        dim: { min: 0, max: 150, ideal: 75 },
        balanced: { min: 151, max: 500, ideal: 325 },
        'well-lit': { min: 501, max: 1000, ideal: 750 },
        'sunny-natural': { min: 1001, max: 10000, ideal: 1500 }
    };
    const noiseWorkTypeThresholds = {
        'focus-work': { min: 0, max: 45, ideal: 40 },
        'relaxed-productivity': { min: 40, max: 50, ideal: 45 },
        'collaborative-work': { min: 45, max: 55, ideal: 50 },
        'break-relaxation': { min: 0, max: 48, ideal: 42 }
    };
    const temperatureThresholds = {
        'stable-comfortable': { min: 23, max: 25, ideal: 24 },
        'consistently-warm': { min: 25.1, max: 30, ideal: 27 },
        'slightly-cool': { min: 18, max: 22.9, ideal: 21 }
    };
    const preferenceDisplayMap = {
        'dim': { text: 'Dim Lighting (0-150 lux)', icon: 'fas fa-moon' },
        'balanced': { text: 'Balanced Lighting (151-500 lux)', icon: 'fas fa-balance-scale' },
        'well-lit': { text: 'Well Lit (501-1000 lux)', icon: 'fas fa-lightbulb' },
        'sunny-natural': { text: 'Sunny & Natural Light (>1000 lux)', icon: 'fas fa-sun' },
        'focus-work': { text: 'Focus Work (Quiet <45dB)', icon: 'fas fa-headphones' },
        'relaxed-productivity': { text: 'Relaxed Productivity (40-50dB)', icon: 'fas fa-coffee' },
        'collaborative-work': { text: 'Collaborative Work (45-55dB)', icon: 'fas fa-users' },
        'break-relaxation': { text: 'Break / Relaxation (<48dB)', icon: 'fas fa-couch' },
        'stable-comfortable': { text: 'Stable & Comfortable (23-25°C)', icon: 'fas fa-thermometer-half' },
        'consistently-warm': { text: 'Consistently Warm (>25°C)', icon: 'fas fa-temperature-high' },
        'slightly-cool': { text: 'Slightly Cool (<23°C)', icon: 'fas fa-temperature-low' },
        'Not specified': { text: 'Not specified', icon: 'fas fa-question-circle' }
    };
    const timePeriodConfig = { // Configuration for weighting time periods in averages.
        'Afternoon': { officeHoursContribution: 0.4 },
        'Early Morning': { officeHoursContribution: 0.1 },
        'Evening': { officeHoursContribution: 0.1 },
        'Morning': { officeHoursContribution: 0.4 },
        'Night': { officeHoursContribution: 0 },
        'Late evening': { officeHoursContribution: 0 }
    };
    const noisePreferenceDescriptors = { // Descriptions for noise preferences.
        'focus-work': { label: "Focus Work / Noise Sensitive", description: "Suits tasks requiring deep concentration, minimal distractions, and sustained attention.", acceptableRangeText: "Below 40-45 dB", examples: "Writing, coding, data analysis" },
        'relaxed-productivity': { label: "Relaxed Productivity", description: "Good for less demanding tasks where some background noise is tolerable.", acceptableRangeText: "40 - 50 dB", examples: "Checking emails, working on spreadsheets" },
        'collaborative-work': { label: "Collaborative Work", description: "Designed for activities involving communication, discussion, and interaction.", acceptableRangeText: "45 - 55 dB", examples: "Meetings, brainstorming sessions" },
        'break-relaxation': { label: "Break / Relaxation", description: "Suitable for areas where employees take breaks, have lunch, or socialize.", acceptableRangeText: "Varies (typically <48dB for quiet breaks)", examples: "Lunch breaks, casual conversations, socialising" }
    };

    // =============================================================================
// ZONE RECOMMENDATION ALGORITHM 
// This is the core logic that determines "Best Match", "2nd Choice", "3rd Choice"
// =============================================================================

// STEP 1: SCORING CONFIGURATION
// Maximum possible score for perfect preference match

    const MAX_SCORE_PER_CRITERION = 100; // Maximum score a zone can get for a single matching criterion.
    const PENALTY_NO_DATA_IF_PREFERRED = -200; // Penalty applied if a preferred criterion has no data.
    const PENALTY_OUT_OF_RANGE_FACTOR = 5; // Factor to calculate penalty for values outside preferred range.

    const UNIFORM_HIGHLIGHT_COORDS = { top: '42%', left: '62%', width: '38%', height: '50%' };

    const zoneCoordinates = { // Coordinates for highlighting zones on a floor plan (Needed AI Assistance for alignment purposes).
        // All original zone coordinates will be overridden by UNIFORM_HIGHLIGHT_COORDS
        "8": UNIFORM_HIGHLIGHT_COORDS,
        "26": UNIFORM_HIGHLIGHT_COORDS,
        "27": UNIFORM_HIGHLIGHT_COORDS,
        "30": UNIFORM_HIGHLIGHT_COORDS,
        "31": UNIFORM_HIGHLIGHT_COORDS,
        "46": UNIFORM_HIGHLIGHT_COORDS,
        "47": UNIFORM_HIGHLIGHT_COORDS,
        "48": UNIFORM_HIGHLIGHT_COORDS,
        "49": UNIFORM_HIGHLIGHT_COORDS,
        "50": UNIFORM_HIGHLIGHT_COORDS,
        "51": UNIFORM_HIGHLIGHT_COORDS,
        "52": UNIFORM_HIGHLIGHT_COORDS,
        "243": UNIFORM_HIGHLIGHT_COORDS,
        "244": UNIFORM_HIGHLIGHT_COORDS,
        "402": UNIFORM_HIGHLIGHT_COORDS,
        "403": UNIFORM_HIGHLIGHT_COORDS,
        "430": UNIFORM_HIGHLIGHT_COORDS,
        "431": UNIFORM_HIGHLIGHT_COORDS,

        // 8,26,27,30,31,46,47,48,49,50,51,52,243,244,402,403,430,431
    };

    //  used as a fallback if a zoneId is not in zoneCoordinates at all.
    const FIXED_HIGHLIGHT_COORDS = { bottom: '1%', left: '70%', width: '70%', height: '38%' };
    
    //  text position - positioned in top-right corner
    const UNIVERSAL_TEXT_POSITION = {
    top: '2%',
    right: '2%', 
    left: 'auto', 
    transform: 'translate(0%, 0%)',
    position: 'absolute',
    background: 'rgba(0, 0, 0, 0.85)',
    color: 'white',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '1.4', 
    zIndex: 1000,
    maxWidth: '320px', 
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.2)',
    textAlign: 'left',
    whiteSpace: 'normal', 
    overflowWrap: 'break-word'
};
    
    const zoneLocations = { // Textual descriptions of zone locations.
        "8": "Level 6, Room: 628 (Top-Right Desks)",
        "26": "Level 6, Room: 628 (Bottom-Right Conference)",
        "27": "Level 6, Room: 628 (Top-Right Workstations)",
        "30": "Level 6, Room: 628 (Open Work Area)",
        "31": "Level 6, Room: 628 (Conference Room)",
        "46": "Level 6, Room: 628 (Kitchenette & Refreshments)",
        "47": "Level 6, Room: 628 (Window Nook A)",
        "48": "Level 6, Room: 628 (Near the Bookshelf)",
        "49": "Level 6, Room: 628 (Communal Table East)",
        "50": "Level 6, Room: 628 (Quiet Corner Booth)",
        "51": "Level 6, Room: 628 (High-Top Counter)",
        "52": "Level 6, Room: 628 (Media Wall Section)",
        "243": "Level 6, Room: 628 (Central Conversation Pit)",
        "244": "Level 6, Room: 628 (Armchair Cluster West)",
        "402": "Level 6, Room: 628 (Near Water Cooler)",
        "403": "Level 6, Room: 628 (Solo Pod Chair)",
        "430": "Level 6, Room: 628 (Outdoor Patio)",
        "431": "Level 6, Room: 628 (Breakroom & Lounge)",
        // 8,26,27,30,31,46,47,48,49,50,51,52,243,244,402,403,430,431
    };

    // Section: Data Processing Functions
    // Purpose: Handles parsing and transformation of CSV data for lighting, noise, and temperature.

    // AI: Used for CSV Error in Samba Lights Data Processing (and Noise)
    // This function is a generic CSV parser used by specific data processors like processLightData.
    // Why is the AI used here: Errors during its execution, or in how it's called, could lead to CSV processing issues.
    function processDataWithDescriptiveTimes(csvString, zoneColumnNameUnused, dataType) {
        try {
            const lines = csvString.trim().split(/\r\n|\n/);
            if (lines.length < 2) {
                console.warn(`[processDataWithDescriptiveTimes] Not enough data in CSV for ${dataType}`);
                return [];
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const zoneIdCsvColumnName = 'Zones'; // Standardized zone column name.
            const zoneColumnIndex = headers.indexOf(zoneIdCsvColumnName);

            if (zoneColumnIndex === -1) {
                console.error(`[processDataWithDescriptiveTimes - ${dataType}] Zone column '${zoneIdCsvColumnName}' not found. Headers: ${headers.join(', ')}`);
                return [];
            }

            const timeColumns = headers.filter((h, index) => index !== zoneColumnIndex && h.trim() !== "");
            const processedData = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== headers.length) {
                    console.warn(`[processDataWithDescriptiveTimes - ${dataType}] Row ${i + 1} has mismatched column count. Skipping.`);
                    continue;
                }

                const zoneName = values[zoneColumnIndex];
                if (!zoneName) {
                    console.warn(`[processDataWithDescriptiveTimes - ${dataType}] Row ${i + 1} has no zone name. Skipping.`);
                    continue;
                }

                const timeSeries = {};
                let weightedSum = 0;
                let totalWeight = 0;

                timeColumns.forEach((timeColumn) => {
                    const actualIndex = headers.indexOf(timeColumn);
                    if (actualIndex === -1) return; // Should not happen if timeColumns is derived from headers

                    const rawValue = values[actualIndex];
                    const numericValue = parseFloat(rawValue);

                    if (rawValue !== undefined && rawValue.trim() !== "" && !isNaN(numericValue)) {
                        timeSeries[timeColumn] = numericValue;
                        const config = timePeriodConfig[timeColumn];
                        if (config && config.officeHoursContribution > 0) {
                            weightedSum += numericValue * config.officeHoursContribution;
                            totalWeight += config.officeHoursContribution;
                        }
                    } else {
                        timeSeries[timeColumn] = null; 
                    }
                });

                const result = { Zones: zoneName, timeSeries: timeSeries };
                if (dataType === 'Light') {
                    result.averageLux = (totalWeight > 0) ? Math.round(weightedSum / totalWeight) : 'N/A';
                }
                processedData.push(result);
            }
            return processedData;
        } catch (error) {
            console.error(`[processDataWithDescriptiveTimes - ${dataType}] Error:`, error);
            return [];
        }
    }

    // AI: CSV Error in Samba Lights Data Processing
    // This function specifically processes light data using the generic parser.
    function processLightData(csvString) {
        try {
            return processDataWithDescriptiveTimes(csvString, 'Zones', 'Light');
        } catch (error) {
            console.error('[processLightData] Error:', error);
            return [];
        }
    }

    // Processes CSV data where each row is a zone and columns are hourly readings.
    function processZoneRowHourlyData(csvString, targetZoneId, dataType) {
        if (!csvString) return [];
        try {
            const lines = csvString.trim().split(/\r\n|\n/);
            if (lines.length < 2) {
                console.warn(`${dataType} CSV (Zone Row Hourly): Not enough data lines.`);
                return [];
            }

            const headers = lines[0].split(',').map(h => h.trim());
            
            const hourHeaders = headers.slice(1);

            if (hourHeaders.length === 0) {
                console.warn(`${dataType} CSV (Zone Row Hourly): No hour columns found.`);
                return [];
            }

            const allProcessedData = [];

            for (let i = 1; i < lines.length; i++) {
                const currentRowValues = lines[i].split(',').map(v => v.trim());
                if (currentRowValues.length !== headers.length) {
                     console.warn(`${dataType} CSV (Zone Row Hourly): Row ${i+1} has mismatched column count. Skipping.`);
                     continue;
                }

                const currentZoneId = currentRowValues[0];
                if (!currentZoneId) {
                    console.warn(`${dataType} CSV (Zone Row Hourly): Row ${i+1} has no zone name. Skipping.`);
                    continue;
                }

                // If targetZoneId is specified, only process that zone. Otherwise, process all.
                if (targetZoneId && currentZoneId !== targetZoneId) {
                    continue;
                }

                const dataValues = currentRowValues.slice(1);
                const timeSeries = {};
                let officeHoursSum = 0;
                let officeHoursCount = 0;

                hourHeaders.forEach((hourStr, index) => {
                    const hour = parseInt(hourStr); // Assuming hourStr is like "0", "1", ..., "23"
                    if (isNaN(hour) || hour < 0 || hour > 23) return; // Skip invalid hour columns

                    const valStr = dataValues[index];
                    if (valStr !== undefined) {
                        const numericValue = parseFloat(valStr);
                        if (valStr.trim() !== "" && !isNaN(numericValue)) {
                            timeSeries[hourStr] = numericValue;
                            if (hour >= 8 && hour <= 18) { // Define office hours (e.g., 8 AM to 6 PM)
                                officeHoursSum += numericValue;
                                officeHoursCount++;
                            }
                        } else {
                            timeSeries[hourStr] = null;
                        }
                    } else {
                        timeSeries[hourStr] = null;
                    }
                });

                const average = officeHoursCount > 0 ? parseFloat((officeHoursSum / officeHoursCount).toFixed(1)) : 'N/A';
                const result = { Zones: currentZoneId, timeSeries: timeSeries };

                if (dataType === 'Temperature') result.averageTemp = average;
                

                allProcessedData.push(result);

                if (targetZoneId && currentZoneId === targetZoneId) {
                    break; 
                }
            }
             if (targetZoneId && !allProcessedData.find(d => d.Zones === targetZoneId)) {
                console.warn(`${dataType} data for Zone '${targetZoneId}' not found (Zone Row Hourly).`);
            }
            return allProcessedData;

        } catch (e) {
            console.error(`Error processing ${dataType} CSV (Zone Row Hourly):`, e);
            return [];
        }
    }

    // Processes CSV data where each column (except the first 'Hour' column) is a zone.
    function processZoneColumnHourlyData(csvString, dataType) {
        if (!csvString) return [];
        try {
            const lines = csvString.trim().split(/\r\n|\n/);
            let headerRowIndex = -1;
            let headers;

            // Find the header row (robustly checking first few lines)
            for (let i = 0; i < Math.min(lines.length, 5); i++) {
                headers = lines[i].split(',').map(h => h.trim());
                if (headers.map(h => h.toLowerCase()).includes('hour') && headers.length > 1) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                console.warn(`${dataType} CSV (Zone Column Hourly): Header row containing 'hour' not found.`);
                return [];
            }
            if (lines.length < headerRowIndex + 2) { // Need at least one data row
                console.warn(`${dataType} CSV (Zone Column Hourly): Not enough data rows after header.`);
                return [];
            }

            headers = lines[headerRowIndex].split(',').map(h => h.trim());
            const hourColumnIndex = headers.findIndex(h => h.toLowerCase() === 'hour');

            if (hourColumnIndex === -1) {
                console.error(`${dataType} CSV (Zone Column Hourly): 'Hour' column missing in identified header.`);
                return [];
            }

            const zoneColumns = headers.filter((h, index) => index !== hourColumnIndex && h.trim() !== '');
            if (zoneColumns.length === 0) {
                console.error(`${dataType} CSV (Zone Column Hourly): No zone columns found in header.`);
                return [];
            }

            const allZoneData = {};
            zoneColumns.forEach(zoneName => {
                allZoneData[zoneName] = { timeSeries: {}, officeHoursSum: 0, officeHoursCount: 0 };
            });

            for (let i = headerRowIndex + 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== headers.length) {
                    console.warn(`${dataType} CSV (Zone Column Hourly): Row ${i+1} has mismatched column count. Skipping.`);
                    continue;
                }

                const hourStr = values[hourColumnIndex];
                const hour = parseInt(hourStr);
                if (isNaN(hour) || hour < 0 || hour > 23) {
                    console.warn(`${dataType} CSV (Zone Column Hourly): Invalid hour '${hourStr}' in row ${i+1}. Skipping.`);
                    continue;
                }

                const isOfficeHour = hour >= 8 && hour <= 18;

                zoneColumns.forEach(zoneName => {
                    const zoneIndexInHeader = headers.indexOf(zoneName);
                    // This check should ideally not be needed if zoneColumns is derived correctly
                    if (zoneIndexInHeader === -1) return;

                    const valStr = values[zoneIndexInHeader];
                    if (valStr !== undefined) {
                        const numericValue = parseFloat(valStr);
                        if (valStr.trim() !== "" && !isNaN(numericValue)) {
                            allZoneData[zoneName].timeSeries[String(hour)] = numericValue;
                            if (isOfficeHour) {
                                allZoneData[zoneName].officeHoursSum += numericValue;
                                allZoneData[zoneName].officeHoursCount++;
                            }
                        } else {
                            allZoneData[zoneName].timeSeries[String(hour)] = null;
                        }
                    } else {
                        allZoneData[zoneName].timeSeries[String(hour)] = null;
                    }
                });
            }

            const processedList = [];
            Object.keys(allZoneData).forEach(zoneName => {
                const data = allZoneData[zoneName];
                const result = { Zones: zoneName, timeSeries: data.timeSeries };
                const average = data.officeHoursCount > 0 ? parseFloat((data.officeHoursSum / data.officeHoursCount).toFixed(1)) : 'N/A';

                if (dataType === 'Noise') result.averageDb = average;
                if (dataType === 'Temperature' && !result.averageTemp) result.averageTemp = average; // averageTemp might be set by other processors
                processedList.push(result);
            });
            return processedList;
        } catch (e) {
            console.error(`Error processing ${dataType} CSV (Zone Column Hourly):`, e);
            return [];
        }
    }

    const processTemperatureData = (csvString) => processZoneRowHourlyData(csvString, null, 'Temperature');
    const processNoiseData = (csvString) => processZoneColumnHourlyData(csvString, 'Noise');

    // Processes a CSV to create a lookup table for "feels like" temperature.
    function processFeelsLikeLookup(csvString) {
        const rows = csvString.trim().split(/\r\n|\n/);
        const data = [];
        if (rows.length <= 1) {
            console.warn("FeelsLike CSV: Not enough data.");
            return data;
        }

        let headerRowIndex = -1; // Find header row more robustly
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            if (rows[i].toLowerCase().includes('ta') && rows[i].toLowerCase().includes('feels like')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            console.error("FeelsLike CSV: Required header columns ('ta', 'Feels Like...') not found.");
            return data;
        }

        const headers = rows[headerRowIndex].split(',').map(header => header.trim().toLowerCase());
        const taIndex = headers.indexOf('ta'); // Ambient temperature column
        const feelsLikeIndex = headers.findIndex(h => h.includes('feels like')); // "Feels like" column

        if (taIndex === -1 || feelsLikeIndex === -1) {
            console.error("FeelsLike CSV: 'ta' or 'Feels Like Temperature (°C)' column not identified correctly in header:", headers);
            return data;
        }

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const values = rows[i].split(',').map(value => value.trim());
            if (values.length < Math.max(taIndex, feelsLikeIndex) + 1) continue; // Ensure row has enough columns

            const ta = parseFloat(values[taIndex]);
            const feelsLike = parseFloat(values[feelsLikeIndex]);
            if (!isNaN(ta) && !isNaN(feelsLike)) {
                data.push({ ta: ta, feelsLike: feelsLike });
            }
        }
        data.sort((a, b) => a.ta - b.ta); // Sort by ambient temperature for efficient lookup
        return data;
    }

    // Looks up the "feels like" temperature based on ambient temperature from pre-processed data.
    function getFeelsLikeTemperature(ambientTemp, feelsLikeLookupData) {
        if (!feelsLikeLookupData || feelsLikeLookupData.length === 0 || isNaN(parseFloat(ambientTemp)) || ambientTemp === 'N/A') {
            return 'N/A';
        }
        const numAmbientTemp = parseFloat(ambientTemp);
        // Find the closest ambient temperature in the lookup table
        let closest = feelsLikeLookupData.reduce((prev, curr) =>
            (Math.abs(curr.ta - numAmbientTemp) < Math.abs(prev.ta - numAmbientTemp) ? curr : prev)
        );
         return parseFloat(closest.feelsLike.toFixed(2));
    }

    // Provides a textual description for a given lux value.
    function getLightDescription(luxValue) {
        if (luxValue === "N/A" || luxValue === undefined || luxValue === null || isNaN(parseFloat(luxValue))) return "Data unavailable";
        const lux = parseFloat(luxValue);
        if (lux < (lightingThresholds.dim.max || 150)) return "Dim";
        if (lux < (lightingThresholds.balanced.max || 500)) return "Balanced";
        if (lux < (lightingThresholds['well-lit'].max || 1000)) return "Well Lit";
        return "Very Bright/Sunny";
    }

    // Provides a textual description for a given decibel value.
    function getNoiseDescription(dbValue) {
        if (dbValue === "N/A" || dbValue === undefined || dbValue === null || isNaN(parseFloat(dbValue))) return "Data unavailable";
        const db = parseFloat(dbValue);
        if (db < (noiseWorkTypeThresholds['focus-work'].max || 45)) return "Quiet";
        if (db < (noiseWorkTypeThresholds['collaborative-work'].max || 55)) return "Moderate";
        return "Potentially Noisy";
    }

    // Provides a textual description for a given temperature value.
    function getTemperatureDescription(tempValue) {
        if (tempValue === "N/A" || tempValue === undefined || tempValue === null || isNaN(parseFloat(tempValue))) return "Data unavailable";
        const temp = parseFloat(tempValue);
        if (temp < (temperatureThresholds['slightly-cool'].max || 22.9)) return "Cool";
        if (temp <= (temperatureThresholds['stable-comfortable'].max || 25)) return "Comfortable";
        return "Warm";
    }

    // Predicts how consistently a zone meets lighting preferences based on descriptive time periods (Morning, Afternoon etc.).
    function predictIdealDuration(timeSeries, minPref, maxPref, currentRelevantTimeConfig) {
        if (!timeSeries || Object.keys(timeSeries).length === 0) return "N/A (No time series data for duration)";

        let suitablePeriods = 0;
        let totalConsideredPeriods = 0;

        // Check if timeSeries uses descriptive keys (e.g., "Morning") or numeric hours
        if (Object.keys(currentRelevantTimeConfig).some(key => typeof currentRelevantTimeConfig[key].officeHoursContribution === 'number')) {
            // Descriptive time periods (e.g., from processDataWithDescriptiveTimes)
            Object.keys(timeSeries).forEach(periodName => {
                const value = timeSeries[periodName];
                const config = currentRelevantTimeConfig[periodName];
                if (config && config.officeHoursContribution > 0 && typeof value === 'number' && !isNaN(value)) {
                    totalConsideredPeriods++;
                    if (value >= minPref && value <= maxPref) {
                        suitablePeriods++;
                    }
                }
            });
        } else {
            // This case might not be hit if predictHourlyDuration is used for hourly data.
            return "N/A (Time series format not directly compatible for this duration prediction type)";
        }


        if (totalConsideredPeriods === 0 && Object.keys(timeSeries).length > 0) return "Data available, but not for primary work hours for duration check";
        if (totalConsideredPeriods === 0) return "N/A (No relevant time series data for duration)";

        const percentage = totalConsideredPeriods > 0 ? (suitablePeriods / totalConsideredPeriods) * 100 : 0;

        if (percentage === 100) return "Consistently throughout main periods";
        if (percentage >= 75) return "Most of the main periods";
        if (percentage >= 50) return "About half of the main periods";
        if (percentage > 0) return "Some of the main periods";
        return "Infrequently during main periods";
    }

    // Predicts how consistently a zone meets preferences based on hourly data.
    function predictHourlyDuration(timeSeries, minPref, maxPref, startHour = 8, endHour = 18, intervalHours = 1) {
        if (!timeSeries || Object.keys(timeSeries).length === 0) return "N/A (No time series data for hourly duration)";

        let suitableHours = 0;
        let consideredHours = 0;

        for (let hour = startHour; hour <= endHour; hour += intervalHours) {
            const hourKey = String(hour); // Ensure hourKey is a string to match timeSeries keys
            consideredHours++;
            if (timeSeries.hasOwnProperty(hourKey) && timeSeries[hourKey] !== null && typeof timeSeries[hourKey] === 'number' && !isNaN(timeSeries[hourKey])) {
                const value = timeSeries[hourKey];
                if (value >= minPref && value <= maxPref) {
                    suitableHours++;
                }
            }
        }

        if (consideredHours === 0) return "N/A (No relevant hourly data for duration)";
        if (suitableHours === consideredHours) return `Consistently from ${startHour}:00-${endHour}:00`;
        if (suitableHours > 0) return `Approximately ${suitableHours * intervalHours} hour(s) between ${startHour}:00-${endHour}:00`;
        return `Not typically within range between ${startHour}:00-${endHour}:00`;
    }


    // This is where the magic happens - calculates scores for ALL zones
    function calculateFinalRecommendations(lightingPref, spaceUsagePref, temperaturePref, allProcessedData, allThresholds, feelsLikeLookupData) {
        // =============================================================================
// STEP 2: INDIVIDUAL CRITERION SCORING FUNCTION
// This calculates how well a zone matches ONE specific preference (light, noise, or temp)
// =============================================================================

        function calculateCriterionScore(actualValue, idealValueUnused, minPref, maxPref, isDataAvailable) {
            if (!isDataAvailable || actualValue === 'N/A' || actualValue === undefined || actualValue === null || isNaN(parseFloat(actualValue))) {
                return PENALTY_NO_DATA_IF_PREFERRED; // Penalize if data is missing for a selected preference.
            }
            const numericActualValue = parseFloat(actualValue);
            if (numericActualValue >= minPref && numericActualValue <= maxPref) {
                return MAX_SCORE_PER_CRITERION; // Max score if within preferred range.
            }
            // Calculate penalty based on deviation from preferred range.
            let diff = numericActualValue < minPref ? minPref - numericActualValue : numericActualValue - maxPref;
            return Math.max(0, MAX_SCORE_PER_CRITERION - (diff * PENALTY_OUT_OF_RANGE_FACTOR));
        }

        // =============================================================================
// STEP 3: COMFORT SCORE NORMALIZATION (0-1 scale)
// Converts raw scores to user-friendly comfort ratings and star ratings
// =============================================================================


        function normalizeComfortScore(originalScore, criteriaMetCount, numSelectedPrefs) {
            if (numSelectedPrefs === 0) { // Handle cases with no preferences selected
                if (originalScore === -Infinity || originalScore < PENALTY_NO_DATA_IF_PREFERRED * 1.5) return 0; // Very low or penalized score
                if (originalScore > 250) return 1.0; // Arbitrary scaling for no-preference scores
                if (originalScore > 150) return 0.8;
                if (originalScore > 50) return 0.6;
                if (originalScore >= 0) return 0.4;
                return 0.2;
            }

            const maxPossibleScore = numSelectedPrefs * MAX_SCORE_PER_CRITERION;
            const minPossiblePenalizedScore = numSelectedPrefs * PENALTY_NO_DATA_IF_PREFERRED;

            if (originalScore === -Infinity) return 0; // No data for any preference
            if (criteriaMetCount === numSelectedPrefs && numSelectedPrefs > 0) return 1.0; // All preferences met

            // If some criteria are met, provide a baseline score plus a bonus for met criteria.
            if (criteriaMetCount > 0) {
                return 0.5 + (criteriaMetCount / numSelectedPrefs) * 0.5;
            }

            // Normalize score if no criteria fully met but some data exists.
            const range = maxPossibleScore - minPossiblePenalizedScore;
            if (range === 0) return 0; // Avoid division by zero
            let normalized = (originalScore - minPossiblePenalizedScore) / range;
            normalized = Math.max(0, Math.min(normalized, 1)); // Clamp between 0 and 1
            return normalized * 0.4; // Scale down if no criteria are perfectly met
        }

        const lightDataFull = allProcessedData.light;
        const noiseDataFull = allProcessedData.noise;
        const temperatureDataFull = allProcessedData.temperature;
        let scoredSpots = [];

        // Create Maps for quick lookup of zone data.
        const lightMap = lightDataFull ? new Map(lightDataFull.map(item => [item.Zones, item])) : new Map();
        const noiseMap = noiseDataFull ? new Map(noiseDataFull.map(item => [item.Zones, item])) : new Map();
        const temperatureMap = temperatureDataFull ? new Map(temperatureDataFull.map(item => [item.Zones, item])) : new Map();

        // Determine target ranges based on user preferences.
        const targetLightRange = lightingPref ? allThresholds.lighting[lightingPref] : null;
        const targetNoiseRange = spaceUsagePref ? allThresholds.noise[spaceUsagePref] : null;
        const targetTemperatureRange = temperaturePref ? allThresholds.temperature[temperaturePref] : null;

        // Get a unique list of all zone names from available data.
        const allZoneNames = [...new Set([
            ...(lightDataFull || []).map(d => d.Zones),
            ...(noiseDataFull || []).map(d => d.Zones),
            ...(temperatureDataFull || []).map(d => d.Zones)
        ])].filter(Boolean); // Filter out any null/empty zone names

        // Handle case where no environmental data is available for any zone.
        if (allZoneNames.length === 0) {
            for (let i = 0; i < 3; i++) { // Create placeholder "No Data" spots.
                scoredSpots.push({
                    zoneId: `Zone ${i + 1} (No Data)`,
                    light: 'N/A', noise: 'N/A', temperature: 'N/A', feelsLikeTemp: 'N/A',
                    originalComfortScore: -Infinity, comfortScore: 0, criteriaMetCount: 0,
                    zoneImage: 'Images/default-room.jpg', durationText: {}, scores: {}, metCriteria: {}, rank: "Info Unavailable"
                });
            }
            return scoredSpots;
        }

        allZoneNames.forEach(zoneName => {
            const zoneLightFull = lightMap.get(zoneName);
            const zoneNoiseFull = noiseMap.get(zoneName);
            const zoneTempFull = temperatureMap.get(zoneName);

            let lightScore = 0, noiseScore = 0, tempScore = 0;
            let criteriaMetCount = 0;
            const durationText = {};
            const metCriteria = {};
            let zoneImage = 'Images/default-room.jpg'; // Default image

            const currentAverageLux = zoneLightFull?.averageLux;
            if (typeof currentAverageLux === 'number' && !isNaN(currentAverageLux)) {
                // Select zone image based on average lux.
                if (currentAverageLux >= (lightingThresholds['sunny-natural']?.min || 1001)) zoneImage = 'Images/sunny-office-space.jpg';
                else if (currentAverageLux >= (lightingThresholds['well-lit']?.min || 501)) zoneImage = 'Images/Well-lit-home-office.webp';
                else if (currentAverageLux >= (lightingThresholds['balanced']?.min || 151)) zoneImage = 'Images/Balanced-light-office-room.webp';
                else if (currentAverageLux >= (lightingThresholds.dim?.min || 0)) zoneImage = 'Images/Dim-lit-room.jpg';
            }

            // Score lighting preference.
            if (targetLightRange) {
                const avgLuxVal = zoneLightFull?.averageLux;
                const isLightDataAvailable = zoneLightFull && typeof avgLuxVal === 'number' && !isNaN(avgLuxVal);
                lightScore = calculateCriterionScore(avgLuxVal, targetLightRange.ideal, targetLightRange.min, targetLightRange.max, isLightDataAvailable);
                metCriteria.light = isLightDataAvailable && avgLuxVal >= targetLightRange.min && avgLuxVal <= targetLightRange.max;
                if (metCriteria.light) criteriaMetCount++;
                durationText.light = predictIdealDuration(zoneLightFull?.timeSeries, targetLightRange.min, targetLightRange.max, timePeriodConfig);
            }

            // Score noise preference.
            if (targetNoiseRange) {
                const avgDbVal = zoneNoiseFull?.averageDb;
                const isNoiseDataAvailable = zoneNoiseFull && typeof avgDbVal === 'number' && !isNaN(avgDbVal);
                noiseScore = calculateCriterionScore(avgDbVal, targetNoiseRange.ideal, targetNoiseRange.min, targetNoiseRange.max, isNoiseDataAvailable);
                metCriteria.noise = isNoiseDataAvailable && avgDbVal >= targetNoiseRange.min && avgDbVal <= targetNoiseRange.max;
                if (metCriteria.noise) criteriaMetCount++;
                durationText.noise = predictHourlyDuration(zoneNoiseFull?.timeSeries, targetNoiseRange.min, targetNoiseRange.max);
            }

            const currentAverageTemp = zoneTempFull?.averageTemp;
            // Score temperature preference.
            if (targetTemperatureRange) {
                const isTempDataAvailable = zoneTempFull && typeof currentAverageTemp === 'number' && !isNaN(currentAverageTemp);
                tempScore = calculateCriterionScore(currentAverageTemp, targetTemperatureRange.ideal, targetTemperatureRange.min, targetTemperatureRange.max, isTempDataAvailable);
                metCriteria.temp = isTempDataAvailable && currentAverageTemp >= targetTemperatureRange.min && currentAverageTemp <= targetTemperatureRange.max;
                if (metCriteria.temp) criteriaMetCount++;
                durationText.temp = predictHourlyDuration(zoneTempFull?.timeSeries, targetTemperatureRange.min, targetTemperatureRange.max);
            }

            let originalTotalScore = 0;
            let numSelectedPreferences = 0;
            if (targetLightRange) { originalTotalScore += lightScore; numSelectedPreferences++; }
            if (targetNoiseRange) { originalTotalScore += noiseScore; numSelectedPreferences++; }
            if (targetTemperatureRange) { originalTotalScore += tempScore; numSelectedPreferences++; }

            scoredSpots.push({
                zoneId: zoneName,
                light: zoneLightFull?.averageLux ?? 'N/A',
                noise: zoneNoiseFull?.averageDb ?? 'N/A',
                temperature: currentAverageTemp ?? 'N/A',
                feelsLikeTemp: getFeelsLikeTemperature(currentAverageTemp, feelsLikeLookupData),
                originalComfortScore: originalTotalScore,
                comfortScore: normalizeComfortScore(originalTotalScore, criteriaMetCount, numSelectedPreferences),
                criteriaMetCount: criteriaMetCount,
                zoneImage: zoneImage,
                durationText: durationText,
                scores: { light: lightScore, noise: noiseScore, temp: tempScore },
                metCriteria: metCriteria,
                targetRangesFromScript: {light: targetLightRange, noise: targetNoiseRange, temp: targetTemperatureRange} // For debugging/details
            });
        });

        // Sort spots by comfort score (descending), then by criteria met (descending).
        scoredSpots.sort((a, b) => {
            if (b.comfortScore !== a.comfortScore) return b.comfortScore - a.comfortScore;
            return b.criteriaMetCount - a.criteriaMetCount;
        });

        let finalTopSpots = scoredSpots.slice(0, 3); // Take top 3 recommendations.

        // Assign ranks to the top spots.
        finalTopSpots.forEach((spot, index) => {
            if (spot.zoneId && !spot.zoneId.includes("(No Data)") && !spot.zoneId.includes("(Unavailable)") && !spot.zoneId.includes("(Fallback)")) {
                if (index === 0) spot.rank = "Best Match";
                else if (index === 1) spot.rank = "2nd Choice";
                else if (index === 2) spot.rank = "3rd Choice";
            } else {
                spot.rank = "Info Unavailable";
            }
        });

        // Ensure there are always 3 spots, adding placeholders if fewer real recommendations exist.
        while (finalTopSpots.length < 3 && finalTopSpots.length < allZoneNames.length) {
            finalTopSpots.push({
                zoneId: `Zone ${finalTopSpots.length + 1} (Fallback)`,
                light: 'N/A', noise: 'N/A', temperature: 'N/A', feelsLikeTemp: 'N/A',
                originalComfortScore: -Infinity, comfortScore: 0, criteriaMetCount: 0,
                zoneImage: 'Images/default-room.jpg', scores: {}, metCriteria: {}, durationText: {}, rank: "Info Unavailable"
            });
        }
        // Final fallback if no zones had any data at all.
        if (allZoneNames.length === 0 && finalTopSpots.length === 0) {
             for(let i=0; i<3; i++) {
                finalTopSpots.push({
                    zoneId: `Zone ${i+1} (Unavailable)`,
                    light: 'N/A', noise: 'N/A', temperature: 'N/A', feelsLikeTemp: 'N/A',
                    originalComfortScore: -Infinity, comfortScore: 0, criteriaMetCount:0,
                    zoneImage: 'Images/default-room.jpg', durationText: {}, scores: {}, metCriteria: {}, rank: "Info Unavailable"
                });
            }
        }
        return finalTopSpots;
    }

    // Section: Quiz Page Interactions
    // Purpose: Manages the user interaction for quiz steps, including preference selection and navigation.
    // AI: Debugging a Broken "Next" Button
    // This function is critical for the quiz progression. Issues here (e.g., elements not found,
    // incorrect event handling, or logic errors in updateNextButtonState) can break the "Next" button.
    function setupQuizInteractions(quizOptionsContainer, nextButton, preferenceType, nextPageUrl) {
        console.log('[setupQuizInteractions] Called with:', { preferenceType, nextPageUrl });

        if (!quizOptionsContainer) {
            console.error("[setupQuizInteractions] CRITICAL: quizOptionsContainer is null.");
            if (nextButton) { nextButton.disabled = true; nextButton.classList.remove('next-btn-active'); }
            return;
        }
        if (!nextButton) {
            console.error("[setupQuizInteractions] CRITICAL: nextButton is null.");
            return;
        }
        if (!preferenceType) {
            console.error("[setupQuizInteractions] CRITICAL: preferenceType is null or empty.");
            if (nextButton) { nextButton.disabled = true; nextButton.classList.remove('next-btn-active'); }
            return;
        }

        const radioButtons = quizOptionsContainer.querySelectorAll(`input[type="radio"][name="${preferenceType}"]`);
        console.log(`[setupQuizInteractions] Radio buttons found for ${preferenceType}:`, radioButtons.length);

        if (radioButtons.length === 0) {
            console.error(`[setupQuizInteractions] No radio buttons found for name="${preferenceType}".`);
            if (nextButton) { nextButton.classList.remove('next-btn-active'); nextButton.disabled = true; }
            return;
        }

        // Updates the state (enabled/disabled, active class) of the "Next" button.
        function updateNextButtonState() {
            const checkedRadioButton = quizOptionsContainer.querySelector(`input[type="radio"][name="${preferenceType}"]:checked`);
            const isOptionSelected = !!checkedRadioButton;
            debugDataFlow('updateNextButtonState', preferenceType, { isOptionSelected: isOptionSelected, disabled: !isOptionSelected });

            if (nextButton) {
                nextButton.disabled = !isOptionSelected;
                nextButton.classList.toggle('next-btn-active', isOptionSelected);
            }
        }

        // Load and apply any stored preference for this quiz step.
        const storedPreference = localStorage.getItem(preferenceType);
        if (storedPreference) {
            let foundAndChecked = false;
            radioButtons.forEach(radio => {
                if (radio.value === storedPreference) {
                    radio.checked = true;
                    foundAndChecked = true;
                    debugDataFlow('setupQuizInteractions', 'load-preference', { type: preferenceType, value: storedPreference });
                }
            });
            if (!foundAndChecked) console.warn(`  - Stored pref "${storedPreference}" for ${preferenceType}" not found among options.`);
        } else {
            debugDataFlow('setupQuizInteractions', 'no-stored-preference', { type: preferenceType });
        }

        // Add event listeners to radio buttons to save preference and update button state.
        radioButtons.forEach((radio) => {
            radio.addEventListener('change', () => {
                console.log(`[setupQuizInteractions] Radio button changed for ${preferenceType}, value: ${radio.value}, checked: ${radio.checked}`);
                if (radio.checked) {
                    localStorage.setItem(preferenceType, radio.value);
                    debugDataFlow('setupQuizInteractions', 'save-preference', { type: preferenceType, value: radio.value });
                }
                updateNextButtonState();
            });
        });

        // Setup "Next" button click handler for navigation.
        if (nextPageUrl && nextButton) {
            nextButton.addEventListener('click', (event) => {
                if (nextButton.disabled) {
                    event.preventDefault(); // Prevent navigation if button is disabled.
                    console.log("Next button clicked, but it's disabled.");
                    return;
                }
                let targetUrl = nextPageUrl;
                // Special case: if it's the last preference step, go to loading page first.
                if (preferenceType === 'temperaturePreference' && nextPageUrl === 'results.html') {
                    targetUrl = 'loading.html';
                }
                console.log('[setupQuizInteractions] Navigating to:', targetUrl);
                window.location.href = targetUrl;
            });
        } else if (!nextButton) {
            console.warn(`[setupQuizInteractions] No nextButton exists for "${preferenceType}" to attach click listener.`);
        } else if (!nextPageUrl) {
            console.warn(`[setupQuizInteractions] No nextPageUrl provided for "${preferenceType}". Next button will not navigate.`);
        }
        updateNextButtonState(); // Initial state update for the "Next" button.
    }

    // Section: Progress Indicator
    // Purpose: Updates the visual progress indicator for multi-step processes (e.g., quiz).
    function updateProgressIndicator(currentStep) {
        const steps = document.querySelectorAll('.progress-indicator .step');
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');
            if (stepNumber < currentStep) {
                step.classList.add('completed');
            } else if (stepNumber === currentStep) {
                step.classList.add('active');
            }
        });

        const stepLines = document.querySelectorAll('.progress-indicator .step-line');
        stepLines.forEach((line, index) => {
            line.classList.remove('filled');
            if ((index + 1) < currentStep) { // Line before the current active step
                line.classList.add('filled');
            }
        });
    }


    // Section: General UI - Sidebar Menu and Header Interactions
    // Purpose: Manages the behavior of the sidebar menu, header, and associated overlays.
    const menuBtn = document.querySelector('.menu-btn'); // General menu button (if exists)
    const sidebarMenu = document.querySelector('.sidebar-menu'); // General sidebar (if exists)
    const closeMenuBtn = document.querySelector('.close-menu-btn'); // General close button for sidebar
    const menuLinks = document.querySelectorAll('.sidebar-menu ul li a');
    const body = document.body;
    let genOverlay = document.querySelector('.overlay');

    // Create overlay dynamically if needed by any menu system
    if (!genOverlay && (menuBtn || closeMenuBtn || document.getElementById('mobileMenuToggle'))) {
        genOverlay = document.createElement('div');
        genOverlay.classList.add('overlay');
        document.body.appendChild(genOverlay);
    }

    function openGenSidebarMenu() {
        if (sidebarMenu) sidebarMenu.classList.add('visible');
        if (genOverlay) genOverlay.classList.add('visible');
        if (body) body.classList.add('menu-active'); // Prevents scrolling while menu is open
    }

    function closeGenSidebarMenu() { // Only closes the general sidebar
        if (sidebarMenu) sidebarMenu.classList.remove('visible');
        // Overlay and body class handled by handleCloseActions to avoid conflicts
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling to overlay if menuBtn is inside it
            openGenSidebarMenu();
        });
    }
    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', closeGenSidebarMenu);
    }

    if (menuLinks) {
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                // If it's an anchor link on the same page or any link from visible sidebar
                if (link.getAttribute('href').startsWith('#') || (link.pathname === window.location.pathname && link.hash)) {
                    if (sidebarMenu && sidebarMenu.classList.contains('visible')) {
                        // handleCloseActions will manage overlay and body class
                        closeGenSidebarMenu(); // Close this specific menu
                    }
                } else { // For navigation to other pages
                     if (sidebarMenu && sidebarMenu.classList.contains('visible')) {
                        closeGenSidebarMenu();
                    }
                }
                // Check if any menu is open to decide on overlay/body class
                const fybsNavMenu = document.getElementById('navMenu');
                if ((!fybsNavMenu || !fybsNavMenu.classList.contains('active')) &&
                    (!sidebarMenu || !sidebarMenu.classList.contains('visible'))) {
                    if (genOverlay) genOverlay.classList.remove('visible');
                    if (body) body.classList.remove('menu-active');
                }
            });
        });
    }

    // Handles closing actions for ALL menus (FYBS and general sidebar)
    function handleCloseActions() {
        let fybsMenuOpen = false;
        let oldSidebarOpen = false;
        const fybsNavMenu = document.getElementById('navMenu');
        const fybsHamburgerIcon = document.getElementById('mobileMenuToggle') ? document.getElementById('mobileMenuToggle').querySelector('.fybs-hamburger') : null;

        if (fybsNavMenu && fybsNavMenu.classList.contains('active')) {
            fybsNavMenu.classList.remove('active');
            if (fybsHamburgerIcon) fybsHamburgerIcon.classList.remove('active');
            fybsMenuOpen = true;
        }
        if (sidebarMenu && sidebarMenu.classList.contains('visible')) {
            sidebarMenu.classList.remove('visible'); // Use the specific close function if it has more logic
            oldSidebarOpen = true;
        }

        if (fybsMenuOpen || oldSidebarOpen) { // If any menu was closed
            if (genOverlay) genOverlay.classList.remove('visible');
            if (body) body.classList.remove('menu-active');
        }
    }

    if (genOverlay) {
        genOverlay.addEventListener('click', handleCloseActions);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            handleCloseActions();
        }
    });

    // FYBS (Find Your Best Spot) specific header and mobile menu logic
    const fybsHeader = document.querySelector('.fybs-header');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const fybsNavMenuEl = document.getElementById('navMenu');
    const fybsHamburgerIconEl = mobileMenuToggle ? mobileMenuToggle.querySelector('.fybs-hamburger') : null;

    if (mobileMenuToggle && fybsNavMenuEl && fybsHamburgerIconEl) {
        mobileMenuToggle.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent interference if toggle is inside another clickable area
            fybsNavMenuEl.classList.toggle('active');
            fybsHamburgerIconEl.classList.toggle('active');
            const isFybsMenuNowOpen = fybsNavMenuEl.classList.contains('active');

            if (genOverlay) genOverlay.classList.toggle('visible', isFybsMenuNowOpen);
            if (body) body.classList.toggle('menu-active', isFybsMenuNowOpen);
        });
    }

    // FYBS specific navigation link handling (active state, smooth scroll for anchors)
    const fybsNavLinks = document.querySelectorAll('.fybs-nav-link');
    if (fybsNavLinks.length > 0) {
        fybsNavLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                fybsNavLinks.forEach(l => l.classList.remove('active')); // Remove active from all
                this.classList.add('active'); // Add active to clicked

                let isInternalAnchor = false;
                if (href) {
                    if (href.startsWith('#')) { // Simple anchor on current page
                        isInternalAnchor = true;
                    } else { // Check if it's an anchor to index.html or current page
                        try {
                            const url = new URL(href, window.location.origin);
                            if (url.pathname === window.location.pathname && url.hash) {
                                isInternalAnchor = true;
                            } else if ((url.pathname.endsWith('index.html') || url.pathname === '/') && url.hash &&
                                (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/index.html')) {
                                isInternalAnchor = true; // Anchor to index.html from index.html
                            }
                        } catch (error) {
                            // Fallback for simple relative paths like "index.html#section"
                             if ((href.startsWith('index.html#') || href.startsWith('/index.html#')) &&
                                (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/index.html') ) {
                                isInternalAnchor = true;
                            }
                        }
                    }
                }

                if (isInternalAnchor) {
                    e.preventDefault();
                    const targetId = href.substring(href.lastIndexOf('#')); // Get #section part
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        const headerOffset = fybsHeader && window.getComputedStyle(fybsHeader).position === 'fixed' ? fybsHeader.offsetHeight : 0;
                        const elementPosition = targetElement.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                }
                // Close menu after click (if it was open)
                if (fybsNavMenuEl && fybsNavMenuEl.classList.contains('active') && fybsHamburgerIconEl) {
                    handleCloseActions(); // This will close FYBS menu and manage overlay
                }
            });
        });
    }

    // FYBS Header auto-hide on scroll
    if (fybsHeader) {
        let lastScroll = 0;
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            if (currentScroll <= (fybsHeader.offsetHeight || 70)) { // Show if at top or near top
                fybsHeader.style.transform = 'translateY(0)';
            } else if (currentScroll > lastScroll) { // Scrolling down
                fybsHeader.style.transform = 'translateY(-100%)'; // Hide
            } else { // Scrolling up
                fybsHeader.style.transform = 'translateY(0)'; // Show
            }
            lastScroll = currentScroll <= 0 ? 0 : currentScroll; // For Mobile or negative scrolling
        }, { passive: true }); // Improve scroll performance
    }

    // Section: General Anchor Link Smooth Scrolling
    // Purpose: Provides smooth scrolling for general anchor links not handled by specific menu logic.
    const generalAnchorLinks = document.querySelectorAll('a[href^="#"]:not(.fybs-nav-link):not(.sidebar-menu ul li a), a[href^="index.html#"]:not(.fybs-nav-link):not(.sidebar-menu ul li a)');
    generalAnchorLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            let targetId;

            if (href.includes('index.html#')) { // For links like "index.html#section"
                targetId = href.substring(href.indexOf('#'));
            } else if (href.startsWith('#')) { // For links like "#section"
                targetId = href;
            } else {
                return; // Not a recognized anchor link format for this handler
            }

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                event.preventDefault();
                // Determine header offset, considering FYBS header or other potential fixed headers.
                const fybsHeaderFixed = fybsHeader && window.getComputedStyle(fybsHeader).position === 'fixed';
                const otherFixedHeader = document.querySelector('body > header:not(.fybs-header)'); // Example selector for other fixed headers
                const otherFixedHeaderVisible = otherFixedHeader && window.getComputedStyle(otherFixedHeader).position === 'fixed';

                let headerOffset = 0;
                if (fybsHeaderFixed) {
                    headerOffset = fybsHeader.offsetHeight;
                } else if (otherFixedHeaderVisible) {
                    headerOffset = otherFixedHeader.offsetHeight;
                }

                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    });


    // Section: Quiz Page Logic
    // Purpose: Initializes and manages the quiz flow on quiz-specific pages.
    const quizContainer = document.querySelector('.quiz-container');
    if (quizContainer) {
        console.log("Quiz container found. Setting up quiz page logic.");
        const urlParams = new URLSearchParams(window.location.search);
        const h2Element = quizContainer.querySelector('h2.quiz-question');
        const quizOptionsContainer = quizContainer.querySelector('.quiz-options');
        const nextButton = quizContainer.querySelector('.next-btn');

        if (!quizOptionsContainer || !nextButton || !h2Element) {
            console.error("CRITICAL QUIZ SETUP: One or more essential elements (question, options, next button) not found within .quiz-container. Next button may not work. HTML check needed.");
            if (nextButton) nextButton.disabled = true; // Disable button if setup fails
            return; // Exit if essential elements are missing
        }

        let preferenceTypeForPage = '';
        const questionText = h2Element.textContent.toLowerCase().trim();

        // Determine preference type based on the question text.
        if (questionText.includes('lighting')) preferenceTypeForPage = 'lightingPreference';
        else if (questionText.includes('space for')) preferenceTypeForPage = 'spaceUsagePreference';
        else if (questionText.includes('temperature preference')) preferenceTypeForPage = 'temperaturePreference';
        else {
            console.error("Could not determine preference type from question:", h2Element.textContent.trim());
            if (nextButton) nextButton.disabled = true;
        }
        console.log('[Quiz Page Logic] Determined preferenceTypeForPage:', preferenceTypeForPage);

        // If starting a new quiz, clear previous preferences and processed data.
        if (urlParams.has('start') && urlParams.get('start') === 'new' && preferenceTypeForPage === 'lightingPreference') {
            debugDataFlow('quiz-init-new', 'localStorage-clear', 'Clearing preferences for new quiz session.');
            localStorage.removeItem('lightingPreference');
            localStorage.removeItem('spaceUsagePreference');
            localStorage.removeItem('temperaturePreference');
            localStorage.removeItem('lightProcessedData');
            localStorage.removeItem('noiseProcessedData');
            localStorage.removeItem('temperatureProcessedData');
            localStorage.removeItem('finalRecommendations');
        }

        // Update progress indicator based on the current step.
        let currentStep = 0;
        if (preferenceTypeForPage === 'lightingPreference') currentStep = 1;
        else if (preferenceTypeForPage === 'spaceUsagePreference') currentStep = 2;
        else if (preferenceTypeForPage === 'temperaturePreference') currentStep = 3;
        if (currentStep > 0) updateProgressIndicator(currentStep);

        if (preferenceTypeForPage) {
            let csvFile = null, localProcessDataFn = null, nextPage = '';
            // Configure CSV file, processing function, and next page URL based on preference type.
            if (preferenceTypeForPage === 'lightingPreference') {
                // AI: CSV Error in Samba Lights Data Processing - This is where samba_lights.csv is specified.
                csvFile = 'samba_lights.csv';
                localProcessDataFn = processLightData;
                nextPage = 'quiz-step2.html';
            } else if (preferenceTypeForPage === 'spaceUsagePreference') {
                csvFile = 'samba_noise.csv';
                localProcessDataFn = processNoiseData;
                nextPage = 'quiz-step3.html';
            } else if (preferenceTypeForPage === 'temperaturePreference') {
                csvFile = 'samba_TA.csv';
                localProcessDataFn = processTemperatureData;
                nextPage = 'results.html'; // This will be changed to loading.html by setupQuizInteractions
            }
            console.log('[Quiz Page Logic] Next page URL determined:', nextPage);

            // Fetch and process CSV data if not already in localStorage.
            // Note: This fetches data on each quiz step page load. Consider optimizing if data is large/static.
            if (csvFile && localProcessDataFn) {
                fetch(csvFile)
                    .then(response => {
                        if (!response.ok) throw new Error(`File ${csvFile} not found (${response.status})`);
                        return response.text();
                    })
                    .then(csvString => {
                        if (csvString.trim() === "") throw new Error(`${csvFile} is empty.`);
                        const processedData = localProcessDataFn(csvString);
                        const storageKey = preferenceTypeForPage.replace('Preference', 'ProcessedData');
                        localStorage.setItem(storageKey, JSON.stringify(processedData || []));
                        // AI: Debugging a Broken "Next" Button - setupQuizInteractions is called here.
                        setupQuizInteractions(quizOptionsContainer, nextButton, preferenceTypeForPage, nextPage);
                    })
                    .catch(error => {
                        // AI: CSV Error in Samba Lights Data Processing (and other CSVs) - Error handling for fetch/process.
                        console.error(`[Quiz Page] CSV Error for ${preferenceTypeForPage} (${csvFile}): ${error.message}.`);
                        // Still setup interactions, but data might be missing, affecting recommendations.
                        // AI: Debugging a Broken "Next" Button - setupQuizInteractions is called even on error.
                        setupQuizInteractions(quizOptionsContainer, nextButton, preferenceTypeForPage, nextPage);
                    });
            } else {
                // AI: Debugging a Broken "Next" Button - setupQuizInteractions is called if no CSV processing needed.
                setupQuizInteractions(quizOptionsContainer, nextButton, preferenceTypeForPage, nextPage);
            }
        } else if (nextButton) { // If preferenceTypeForPage couldn't be determined
            nextButton.disabled = true;
            nextButton.classList.remove('next-btn-active');
        }
    }


    // Section: Loading Page Logic
    // Purpose: Handles data fetching, processing, and recommendation calculation on the loading page.
    // AI: Troubleshooting Application Loading Page Errors
    // This entire block is relevant. Errors in fetching CSVs, processing data, calculating recommendations,
    // or issues with localStorage can cause the loading page to fail or hang.
    if (document.body.classList.contains('loading-page')) {
        debugDataFlow('loading-page', 'init', 'Loading page script activated');
        const startTime = Date.now();
        const minLoadingTime = 2000; // Minimum time to show loading animation.
        const loadingStatusElement = document.getElementById('loading-status') || document.querySelector('.loading-text');

        if (!loadingStatusElement || (loadingStatusElement.tagName !== 'P' && !loadingStatusElement.classList.contains('loading-text'))) {
            const fallbackLoadingText = document.querySelector('.loading-text'); // Attempt to find it again
            if(fallbackLoadingText) fallbackLoadingText.textContent = "Finding your ideal zone...";
        }


        const lightingPref = localStorage.getItem('lightingPreference');
        const spaceUsagePref = localStorage.getItem('spaceUsagePreference');
        const temperaturePref = localStorage.getItem('temperaturePreference');

        const dataPromises = [];
        let lightProcessedData = JSON.parse(localStorage.getItem('lightProcessedData') || '[]');
        let noiseProcessedData = JSON.parse(localStorage.getItem('noiseProcessedData') || '[]');
        let temperatureProcessedData = JSON.parse(localStorage.getItem('temperatureProcessedData') || '[]');

        // Fetch light data if preference selected and not already processed.
        if (lightProcessedData.length === 0 && lightingPref) {
            // AI: CSV Error in Samba Lights Data Processing - Fetching samba_lights.csv on loading page.
            dataPromises.push(
                fetch('samba_lights.csv')
                    .then(r => { if (!r.ok) throw new Error(`CSV Error (samba_lights.csv): ${r.status}`); return r.text(); })
                    .then(csv => {
                        lightProcessedData = processLightData(csv);
                        localStorage.setItem('lightProcessedData', JSON.stringify(lightProcessedData));
                        return lightProcessedData;
                    })
            );
        } else {
            dataPromises.push(Promise.resolve(lightProcessedData));
        }

        // Fetch noise data if preference selected and not already processed.
        if (noiseProcessedData.length === 0 && spaceUsagePref) {
            dataPromises.push(
                fetch('samba_noise.csv')
                    .then(r => { if (!r.ok) throw new Error(`CSV Error (samba_noise.csv): ${r.status}`); return r.text(); })
                    .then(csv => {
                        noiseProcessedData = processNoiseData(csv);
                        localStorage.setItem('noiseProcessedData', JSON.stringify(noiseProcessedData));
                        return noiseProcessedData;
                    })
            );
        } else {
            dataPromises.push(Promise.resolve(noiseProcessedData));
        }

        // Fetch "feels like" temperature lookup data and then temperature data if needed.
        dataPromises.push(
            fetch('ta_Feels_Like_Temperature.csv')
                .then(r => { if (!r.ok) throw new Error(`CSV Error (ta_Feels_Like_Temperature.csv): ${r.status}`); return r.text(); })
                .then(fLCsv => {
                    const fLLookup = processFeelsLikeLookup(fLCsv);
                    if (temperatureProcessedData.length === 0 && temperaturePref) {
                        return fetch('samba_TA.csv')
                            .then(r => { if (!r.ok) throw new Error(`CSV Error (samba_TA.csv): ${r.status}`); return r.text(); })
                            .then(tmpCsv => {
                                temperatureProcessedData = processTemperatureData(tmpCsv);
                                localStorage.setItem('temperatureProcessedData', JSON.stringify(temperatureProcessedData));
                                return { fLLookup, tmpPData: temperatureProcessedData };
                            });
                    }
                    return { fLLookup, tmpPData: temperatureProcessedData }; // Return even if temp data already exists
                })
        );

        Promise.all(dataPromises)
            .then(results => {
                let fLLookup;
                // Extract feelsLikeLookup and potentially updated temperatureProcessedData from promises.
                const fLResult = results.find(r => r && r.fLLookup); // The promise that returns { fLLookup, tmpPData }
                if (fLResult) {
                    fLLookup = fLResult.fLLookup;
                    // If temperature data was fetched within this promise chain and wasn't already populated.
                    if (fLResult.tmpPData && fLResult.tmpPData.length > 0 && temperatureProcessedData.length === 0) {
                        temperatureProcessedData = fLResult.tmpPData;
                    }
                } else {
                     console.warn("Feels like temperature data (ta_Feels_Like_Temperature.csv) might be missing or malformed. FeelsLikeTemp might be N/A.");
                     fLLookup = []; // Ensure fLLookup is an empty array if not found
                }


                // Display selected preferences summary.
                const preferencesDisplayElement = document.querySelector('.preferences-summary');
                if (preferencesDisplayElement) {
                    const getD = (v) => preferenceDisplayMap[v] || preferenceDisplayMap['Not specified'];
                    let prefsHTML = `<p><strong>Your Preferences:</strong></p><ul>`;
                    if (lightingPref) prefsHTML += `<li><i class="${getD(lightingPref).icon} preference-icon"></i> <span class="preference-label">Lighting:</span> <span class="preference-value">${getD(lightingPref).text}</span></li>`;
                    if (spaceUsagePref) prefsHTML += `<li><i class="${getD(spaceUsagePref).icon} preference-icon"></i> <span class="preference-label">Space Usage:</span> <span class="preference-value">${getD(spaceUsagePref).text}</span></li>`;
                    if (temperaturePref) prefsHTML += `<li><i class="${getD(temperaturePref).icon} preference-icon"></i> <span class="preference-label">Temperature:</span> <span class="preference-value">${getD(temperaturePref).text}</span></li>`;
                    prefsHTML += `</ul>`;
                    if (!lightingPref && !spaceUsagePref && !temperaturePref) {
                        prefsHTML = `<p><strong>No specific preferences selected.</strong></p><p>We'll show general recommendations.</p>`;
                    }
                    preferencesDisplayElement.innerHTML = prefsHTML;
                }

                const hasAnyZoneData = lightProcessedData.length > 0 || noiseProcessedData.length > 0 || temperatureProcessedData.length > 0;
                if (!hasAnyZoneData && (lightingPref || spaceUsagePref || temperaturePref)) {
                    throw new Error("Environmental data for zones could not be loaded, but preferences were selected. Please check CSV files.");
                }

                // Code for Calculating final recommendations.
                const finalRecommendations = calculateFinalRecommendations(
                    lightingPref, spaceUsagePref, temperaturePref,
                    { light: lightProcessedData, noise: noiseProcessedData, temperature: temperatureProcessedData },
                    { lighting: lightingThresholds, noise: noiseWorkTypeThresholds, temperature: temperatureThresholds },
                    fLLookup
                );
                localStorage.setItem('finalRecommendations', JSON.stringify(finalRecommendations));

                // Navigate to results page after minimum loading time.
                const elapsedTime = Date.now() - startTime;
                setTimeout(() => {
                    window.location.href = 'results.html';
                }, Math.max(0, minLoadingTime - elapsedTime));
            })
            .catch(error => {
                // AI: Troubleshooting Application Loading Page Errors - This is the main error handler for the loading page.
                console.error("Loading Page Error:", error.message, error.stack);
                const errorDisplayArea = document.getElementById('loading-error-message') || loadingStatusElement; // Fallback to loadingStatusElement
                if (errorDisplayArea) {
                     errorDisplayArea.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}. Please try <a href="index.html?start=new" style="color: inherit; text-decoration: underline;">restarting the quiz</a>.`;
                    errorDisplayArea.style.color = 'red';
                    errorDisplayArea.style.textAlign = 'center';
                    errorDisplayArea.style.display = 'block';
                } else {
                    
                    alert(`Critical Loading Error: ${error.message}. Please restart.`);
                }
                const loadingAnimationArea = document.querySelector('.loading-animation-area');
                if(loadingAnimationArea) loadingAnimationArea.style.display = 'none'; 
            });
    }


    // Section: Results Page Logic
    // Purpose: Displays the calculated recommendations and user preferences on the results page.
    // AI: Debugging JavaScript Code: Results Page Issue
    // This block handles displaying recommendations. Problems with parsing `finalRecommendations` from localStorage,
    // AI Helped needed as empty or malformed recommendation data, or issues in `displayRecommendations` can lead to a broken results page.
    if (document.getElementById('recommendations-container')) {
        // Helper to get display text for a preference.
        function getPreferenceDisplayText(preferenceTypeUnused, preferenceValue) {
            if (!preferenceValue) return "Not Selected";
            const mapping = preferenceDisplayMap[preferenceValue];
            return mapping ? mapping.text : preferenceValue;
        }

        // Display selected preferences.
        const lightingPrefValueFromLS = localStorage.getItem('lightingPreference');
        const noisePrefValueFromLS = localStorage.getItem('spaceUsagePreference');
        const temperaturePrefValueFromLS = localStorage.getItem('temperaturePreference');

        const selectedLightingEl = document.getElementById('selected-lighting');
        if (selectedLightingEl) selectedLightingEl.textContent = getPreferenceDisplayText('lighting', lightingPrefValueFromLS);
        const selectedNoiseEl = document.getElementById('selected-noise');
        if (selectedNoiseEl) selectedNoiseEl.textContent = getPreferenceDisplayText('noise', noisePrefValueFromLS);
        const selectedTempEl = document.getElementById('selected-temperature');
        if (selectedTempEl) selectedTempEl.textContent = getPreferenceDisplayText('temperature', temperaturePrefValueFromLS);

        // Generates HTML for star rating based on normalized comfort score.
        function generateStarRating(normalizedComfortScore) {
            let starsHtml = '';
            let displayStars = 0;
            // Determine number of stars based on score ranges.
            if (normalizedComfortScore >= 0.9) displayStars = 5;
            else if (normalizedComfortScore >= 0.75) displayStars = 4.5;
            else if (normalizedComfortScore >= 0.6) displayStars = 4;
            else if (normalizedComfortScore >= 0.45) displayStars = 3.5;
            else if (normalizedComfortScore >= 0.3) displayStars = 3;
            else if (normalizedComfortScore >= 0.2) displayStars = 2.5;
            else if (normalizedComfortScore > 0.05) displayStars = Math.max(0.5, Math.round(normalizedComfortScore * 5 * 2) / 2); // At least 0.5 if slightly positive
            else displayStars = 0;

            for (let i = 1; i <= 5; i++) {
                if (displayStars >= i) starsHtml += '<i class="fas fa-star star"></i>';
                else if (displayStars >= i - 0.5) starsHtml += '<i class="fas fa-star-half-alt star"></i>';
                else starsHtml += '<i class="far fa-star star"></i>';
            }
            return starsHtml;
        }
        // Gets appropriate image for a zone based on its light value.
        function getZoneImage(zoneIdUnused, lightValue) {
            if (typeof lightValue === 'number' && !isNaN(lightValue)) {
                if (lightValue >= (lightingThresholds['sunny-natural']?.min || 1001)) return 'Images/sunny-office-space.jpg';
                if (lightValue >= (lightingThresholds['well-lit']?.min || 501)) return 'Images/Well-lit-home-office.webp';
                if (lightValue >= (lightingThresholds['balanced']?.min || 151)) return 'Images/Balanced-light-office-room.webp';
                if (lightValue >= (lightingThresholds.dim?.min || 0)) return 'Images/Dim-lit-room.jpg';
            }
            return 'Images/default-room.jpg'; // Alternate image
        }

        // Displays an error message in the recommendations container.
        function showError(message) {
            const container = document.getElementById('recommendations-container');
            if (container) {
                container.innerHTML = `<div class="error-message-results"><i class="fas fa-exclamation-triangle"></i><p>${message}</p><a href="index.html?start=new" class="cta-link primary-cta" style="margin-top:1rem;">Back to Home & Restart Quiz</a></div>`;
            }
        }

        // Navigation function for viewing zone details.
        window.viewZoneDetails = function(zoneId) { // Assign to window for inline onclick
            if (zoneId) {
                window.location.href = `zone-details.html?id=${encodeURIComponent(zoneId)}`;
            } else {
                console.error("viewZoneDetails called with no zoneId");
                alert("Cannot view details: Zone ID is missing."); // AI: Consider custom modal
            }
        };

        // Displays the recommendations in card format.
        function displayRecommendations(recommendations) {
            const container = document.getElementById('recommendations-container');
            if (!container) return;
            container.innerHTML = ''; 

            if (!recommendations || recommendations.length === 0 || recommendations.every(rec => rec.zoneId.includes("(No Data)") || rec.zoneId.includes("(Unavailable)") || rec.zoneId.includes("(Fallback)"))) {
                // AI: Debugging JavaScript Code: Results Page Issue - Handles cases with no valid recommendations.
                showError('No suitable recommendations found. This could be due to no zones matching your criteria or missing environmental data. Please try adjusting your quiz answers or check if environmental data files (CSVs) are correctly loaded and formatted.');
                return;
            }

            const validRecommendations = recommendations.filter(rec => rec.zoneId && !rec.zoneId.includes("(No Data)") && !rec.zoneId.includes("(Unavailable)") && !rec.zoneId.includes("(Fallback)"));
            if (validRecommendations.length === 0) {
                // AI: Debugging JavaScript Code: Results Page Issue - Another check for valid recommendations.
                showError('No valid recommendations could be processed. Please try the quiz again.');
                return;
            }

            const bestRecommendation = validRecommendations[0]; // Assuming sorted by calculateFinalRecommendations

            validRecommendations.forEach((rec, index) => {
                const isBestChoice = bestRecommendation && (rec.zoneId === bestRecommendation.zoneId) && bestRecommendation.comfortScore > 0.1 && bestRecommendation.criteriaMetCount > 0;
                const zoneImage = getZoneImage(rec.zoneId, rec.light); 
                let rankBadge = '';
                if (isBestChoice) {
                    rankBadge = '<div class="best-choice-badge"><i class="fas fa-star"></i> Best Match</div>';
                } else if (index === 1 && validRecommendations.length > 1 && validRecommendations[1].comfortScore > 0.1) {
                    rankBadge = '<div class="best-choice-badge" style="background-color: #5293c2;">2nd Choice</div>';
                } else if (index === 2 && validRecommendations.length > 2 && validRecommendations[2].comfortScore > 0.1) {
                    rankBadge = '<div class="best-choice-badge" style="background-color: #7aa05b;">3rd Choice</div>';
                }

                container.innerHTML += `
                    <div class="recommendation-card ${isBestChoice ? 'best-choice' : ''}">
                        ${rankBadge}
                        <div class="card-image">
                            <img src="${zoneImage}" alt="Image of Zone ${rec.zoneId}" onerror="this.onerror=null;this.src='Images/default-room.jpg';">
                        </div>
                        <div class="card-content">
                            <h3 class="zone-title">Zone ${rec.zoneId}</h3>
                            <div class="environment-info">
                                <div class="info-item">
                                    <div class="info-icon"><i class="fas fa-lightbulb"></i></div>
                                    <div class="info-label">Light:</div>
                                    <div class="info-value">
                                        <span class="primary-value">${getLightDescription(rec.light)}</span>
                                        <span class="secondary-value">${rec.light !== "N/A" && !isNaN(parseFloat(rec.light)) ? parseFloat(rec.light).toFixed(1) + " lux" : "N/A"}</span>
                                    </div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon"><i class="fas fa-volume-up"></i></div>
                                    <div class="info-label">Noise:</div>
                                    <div class="info-value">
                                        <span class="primary-value">${getNoiseDescription(rec.noise)}</span>
                                        <span class="secondary-value">${rec.noise !== "N/A" && !isNaN(parseFloat(rec.noise)) ? parseFloat(rec.noise).toFixed(1) + " dB" : "N/A"}</span>
                                    </div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon"><i class="fas fa-thermometer-half"></i></div>
                                    <div class="info-label">Temp:</div>
                                    <div class="info-value">
                                        <span class="primary-value">${getTemperatureDescription(rec.temperature)}</span>
                                        <span class="secondary-value">
                                            ${rec.temperature !== "N/A" && !isNaN(parseFloat(rec.temperature)) ? parseFloat(rec.temperature).toFixed(1) + " °C" : "N/A"}
                                            ${(rec.feelsLikeTemp !== 'N/A' && rec.feelsLikeTemp !== null && !isNaN(parseFloat(rec.feelsLikeTemp)) && Math.abs(parseFloat(rec.temperature) - parseFloat(rec.feelsLikeTemp)) > 0.5) ? ` (Feels ${parseFloat(rec.feelsLikeTemp).toFixed(1)}°C)` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="rating-section">
                                <div class="rating-label">Comfort Rating</div>
                                <div class="star-rating">
                                    ${generateStarRating(rec.comfortScore)}
                                </div>
                            </div>
                            <button class="view-btn" onclick="viewZoneDetails('${rec.zoneId}')">View Details</button>
                        </div>
                    </div>
                `;
            });

            // AI: Add highlight and text overlay (Results Page)
            // This section handles highlighting the best recommendation on the floorplan.
            const floorplanContainer = document.getElementById('floorplanContainer');
            const zoneHighlightOverlay = document.getElementById('zoneHighlightOverlay');
            const highlightMessage = document.getElementById('highlightMessage');
            const zoneLocation = document.getElementById('zoneLocation');

            if (floorplanContainer && zoneHighlightOverlay && highlightMessage && zoneLocation && bestRecommendation && bestRecommendation.zoneId) {
                const bestZoneId = bestRecommendation.zoneId;
                const coords = zoneCoordinates[bestZoneId]; // Get coordinates from shared config
                const locationText = zoneLocations[bestZoneId]; // To Get location text

                if (coords) {
                    zoneHighlightOverlay.style.top = coords.top;
                    zoneHighlightOverlay.style.left = coords.left;
                    zoneHighlightOverlay.style.width = coords.width;
                    zoneHighlightOverlay.style.height = coords.height;
                    zoneHighlightOverlay.style.display = 'block';
                    highlightMessage.textContent = "This highlighted zone is your best recommendation!";
                    zoneLocation.textContent = locationText || `Zone ${bestZoneId}`; 
                    floorplanContainer.classList.add('highlight-active');
                    debugDataFlow('ResultsPage', 'FloorplanHighlight', { zoneId: bestZoneId, coords: coords, location: locationText });
                } else {
                    console.warn(`[Results Page] No coordinates found for best match zone: ${bestZoneId}. Cannot highlight.`);
                    floorplanContainer.classList.remove('highlight-active');
                    if (zoneHighlightOverlay) zoneHighlightOverlay.style.display = 'none';
                }
            } else {
                console.warn('[Results Page] Missing elements for floorplan highlight or no best recommendation found. Highlight will not be shown.');
                if (floorplanContainer) floorplanContainer.classList.remove('highlight-active');
                if (zoneHighlightOverlay) zoneHighlightOverlay.style.display = 'none';
            }
        }

        // Load recommendations from localStorage and display them.
        const finalRecommendationsStr = localStorage.getItem('finalRecommendations');
        if (finalRecommendationsStr) {
            try {
                const finalRecs = JSON.parse(finalRecommendationsStr);
                // AI SUGGESTED: Debugging JavaScript Code: Results Page Issue - Check if parsed recommendations are valid.
                if (finalRecs && finalRecs.length > 0) {
                    const loadingMsgEl = document.getElementById('loading-recommendations-message');
                    if (loadingMsgEl) loadingMsgEl.style.display = 'none'; 
                    displayRecommendations(finalRecs);
                } else {
                    showError('No recommendations were generated. Please try the quiz again.');
                }
            } catch (error) {
                // AI SUGGESTED: Debugging JavaScript Code: Results Page Issue - Error handling for parsing recommendations.
                showError('Failed to load recommendations due to a data error. Please try the quiz again.');
                console.error("Error parsing finalRecommendations from localStorage:", error);
            }
        } else {
            // AI SUGGUESTED: Debugging JavaScript Code: Results Page Issue - Handles missing recommendations in localStorage.
            showError('No recommendations found. Please complete the preference quiz first by going back to the home page.');
        }
    }


    // Section: Zone Details Page Logic
    // Purpose: Manages the display of detailed information for a specific zone.
    if (document.body.classList.contains('zone-details-page-layout')) {
        const urlParams = new URLSearchParams(window.location.search);
        const zoneIdParam = urlParams.get('id'); // Get zone ID from URL

        if (!zoneIdParam) {
            console.warn('[ZoneDetailsPage] No zone ID found in URL parameters. Page may not display correctly.');
            
            const mainContentArea = document.querySelector('.zone-detail-main-content') || document.body;
            mainContentArea.innerHTML = `<div class="error-message" style="padding: 20px; text-align: center;">
                                            <h2><i class="fas fa-exclamation-triangle"></i> Zone Not Found</h2>
                                            <p>No zone ID was provided in the URL. Please go back and select a zone to view its details.</p>
                                            <a href="results.html" class="cta-link primary-cta" style="margin-top:1rem;">Back to Recommendations</a>
                                         </div>`;
        }

        // This Makes characteristic cards clickable to navigate to forecast charts. (Used AI to help me understand how to navigate to the exact IEQ chart)
        function setupInteractiveCharacteristics() {
            if (!zoneIdParam) return;

            function navigateToForecastChart(chartType) {
                const forecastUrl = `zone_forecast.html?id=${encodeURIComponent(zoneIdParam)}#${chartType}`;
                window.location.href = forecastUrl;
            }

            const characteristicCards = [
                { id: 'charCardLight', type: 'light', name: 'Light' },
                { id: 'charCardTemp', type: 'temperature', name: 'Temperature' },
                { id: 'charCardNoise', type: 'noise', name: 'Noise' }
            ];

            characteristicCards.forEach(cardInfo => {
                const cardElement = document.getElementById(cardInfo.id);
                if (cardElement) {
                    cardElement.addEventListener('click', function(e) {
                        e.preventDefault();
                        console.log(`Navigating to ${cardInfo.name} forecast chart`);
                        navigateToForecastChart(cardInfo.type);
                    });
                    cardElement.style.cursor = 'pointer';
                    cardElement.setAttribute('title', `Click to view detailed ${cardInfo.name.toLowerCase()} forecast`);

                    // Added the hover effects for better UX
                    cardElement.addEventListener('mouseenter', function() {
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        this.style.transition = 'all 0.2s ease';
                    });
                    cardElement.addEventListener('mouseleave', function() {
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = ''; 
                    });
                } else {
                    console.warn(`[ZoneDetailsPage] Characteristic card with ID '${cardInfo.id}' not found.`);
                }
            });
            console.log('Zone details interactive navigation initialized for zone:', zoneIdParam);
        }

        // AI: Add highlight and text overlay (Zone Details Page)
        // Sets up the highlight and text overlay on the floorplan image.
        function setupFloorplanHighlight() {
            if (!zoneIdParam) return; // Don't attempt if no zone ID

            const highlightElement = document.getElementById('zoneDetailHighlight');
            const textOverlayElement = document.getElementById('zoneDetailTextOverlay');
            const floorplanImageElement = document.getElementById('zoneDetailFloorplanImage');

            if (highlightElement && textOverlayElement && floorplanImageElement) {
                function applyHighlightAndText() {
                    
                    if (!floorplanImageElement.complete || floorplanImageElement.naturalWidth === 0) {
                        
                        console.warn("[ZoneDetailsPage] Floorplan image not fully loaded for highlight. Retrying or waiting for onload.");
                        setTimeout(applyHighlightAndText, 100); 
                        return;
                    }

                    const coords = zoneCoordinates[zoneIdParam] || FIXED_HIGHLIGHT_COORDS; 
                    highlightElement.style.top = coords.top;
                    highlightElement.style.left = coords.left;
                    highlightElement.style.width = coords.width;
                    highlightElement.style.height = coords.height;
                    highlightElement.style.display = 'block';

                    //  Position text overlay relative to the highlight or image (Using AI to help me understand and get how it is done)
                    const textTopOffset = 10; 
                    const textLeftOffsetPercent = 5;

                    textOverlayElement.style.top = `calc(${coords.top} + ${textTopOffset}px)`;
                    textOverlayElement.style.left = `calc(${coords.left} + ${textLeftOffsetPercent}%)`;
                    textOverlayElement.textContent = zoneLocations[zoneIdParam] || `Location for Zone ${zoneIdParam}`;
                    textOverlayElement.style.display = 'block';

                    debugDataFlow('ZoneDetailsPage', 'FloorplanHighlightAndText', { zoneId: zoneIdParam, appliedCoords: coords, textTop: textOverlayElement.style.top, textLeft: textOverlayElement.style.left });
                }

                if (floorplanImageElement.complete && floorplanImageElement.naturalWidth > 0) {
                    applyHighlightAndText();
                } else {
                    floorplanImageElement.onload = applyHighlightAndText;
                    floorplanImageElement.onerror = () => {
                        console.error("[ZoneDetailsPage] Floorplan image failed to load. Cannot apply highlight.");
                         if (highlightElement) highlightElement.style.display = 'none';
                         if (textOverlayElement) textOverlayElement.style.display = 'none';
                    };
                }
                // Re-apply on resize if layout is fluid
                window.addEventListener('resize', applyHighlightAndText);
            } else {
                console.warn("[ZoneDetailsPage] Highlight, TextOverlay, or FloorplanImage element not found. Cannot display highlight.");
                if (highlightElement) highlightElement.style.display = 'none';
                if (textOverlayElement) textOverlayElement.style.display = 'none';
            }
        }

        // Populates the zone details page with data for the specified zone.
        function populateZoneDetails() {
            if (!zoneIdParam) {
                console.warn('[ZoneDetailsPage] No zone ID parameter found for populating details.');
                return;
            }

            const recommendationsStr = localStorage.getItem('finalRecommendations');
            let recommendations = null;
            if (recommendationsStr) {
                try {
                    recommendations = JSON.parse(recommendationsStr);
                } catch (e) {
                    console.error("[ZoneDetailsPage] Error parsing 'finalRecommendations' from localStorage:", e);
                    recommendations = []; // Treat as empty if parsing fails
                }
            } else {
                console.warn("[ZoneDetailsPage] 'finalRecommendations' not found in localStorage.");
                recommendations = [];
            }

            let zoneData = null;
            if (recommendations && Array.isArray(recommendations)) {
                // Ensure comparison is type-consistent (e.g., both strings)
                zoneData = recommendations.find(rec => String(rec.zoneId).trim() === String(zoneIdParam).trim());
            }
            debugDataFlow('ZoneDetailsPage', 'ZoneDataForDetailsPopulation', zoneData);

            
            // user preferences for contextual information.
            const userPreferences = {
                light: localStorage.getItem('lightingPreference'),
                temp: localStorage.getItem('temperaturePreference'),
                noise: localStorage.getItem('spaceUsagePreference')
            };

        
            // All DOM elements to be populated.
            const elements = {
                zoneDetailTitle: document.getElementById('zoneDetailTitle'),
                zoneDetailSubtitle: document.getElementById('zoneDetailSubtitle'),
                comfortScoreValue: document.getElementById('zoneDetailComfortScoreValue'),
                mainImg: document.getElementById('zoneDetailMainImage'),
                matchTitle: document.getElementById('matchTitleText'),
                matchDescription: document.getElementById('zoneDetailMatchDescription'),
                charLightLabel: document.getElementById('charLightLabel'),
                charLightValue: document.getElementById('charLightValue'),
                charTempLabel: document.getElementById('charTempLabel'),
                charTempValue: document.getElementById('charTempValue'),
                charNoiseLabel: document.getElementById('charNoiseLabel'),
                charNoiseValue: document.getElementById('charNoiseValue'),
                workTypeLabel: document.getElementById('charWorkTypeLabel'),
                workTypeValue: document.getElementById('charWorkTypeValue'),
                availabilityText: document.getElementById('availabilityText'),
                availabilitySubtext: document.getElementById('availabilitySubtext'),
                availabilityIcon: document.getElementById('availabilityIcon'),
                crowdLevelText: document.getElementById('crowdLevelText')
            };

            if (zoneData) {
                if (elements.zoneDetailTitle) elements.zoneDetailTitle.textContent = `Zone ${zoneData.zoneId || zoneIdParam}`;
                if (elements.zoneDetailSubtitle) {
                    let rankText = "Zone Details"; let rankEmoji = "";
                    if (zoneData.rank) {
                        switch (zoneData.rank) {
                            case "Best Match": rankEmoji = "🥇 "; rankText = "This is your Best Match!"; break;
                            case "2nd Choice": rankEmoji = "🥈 "; rankText = "This is your 2nd Choice."; break;
                            case "3rd Choice": rankEmoji = "🥉 "; rankText = "This is your 3rd Choice."; break;
                            case "Info Unavailable": rankText = "Information unavailable"; break;
                            default: rankText = zoneData.rank; break;
                        }
                    }
                    elements.zoneDetailSubtitle.textContent = rankEmoji + rankText;
                }
                if (elements.comfortScoreValue && zoneData.comfortScore !== undefined) {
                    elements.comfortScoreValue.textContent = `${Math.round(zoneData.comfortScore * 100)}/100`;
                }
                if (elements.mainImg) {
                    elements.mainImg.src = zoneData.zoneImage || 'Images/default-room.jpg'; // Using this default image if not specified
                    elements.mainImg.alt = `Image of Zone ${zoneData.zoneId || zoneIdParam}`;
                }

                // Add the match information (for zone summary on Zone-details page).
                let matchReasoning = "";
                const locationTextForDetails = zoneLocations[zoneIdParam] || `Zone ${zoneIdParam}`;
                if (elements.matchTitle) {
                    if (zoneData.rank && zoneData.rank !== "Info Unavailable") {
                        elements.matchTitle.textContent = zoneData.rank;
                        matchReasoning = `This zone is your "${zoneData.rank}". It's located at: ${locationTextForDetails}. `;
                    } else {
                        elements.matchTitle.textContent = "Zone Information";
                        matchReasoning = `Here's an overview of Zone ${zoneIdParam}'s characteristics. It's located at: ${locationTextForDetails}. `;
                    }
                }

                let preferenceMatchCount = 0;
                const totalUserPrefsSelected = Object.values(userPreferences).filter(Boolean).length;

                if (zoneData.metCriteria) {
                    if (zoneData.metCriteria.light && userPreferences.light) {
                        matchReasoning += `Its ${getLightDescription(zoneData.light).toLowerCase()} lighting (${zoneData.light} lux) aligns with your preference. `;
                        preferenceMatchCount++;
                    }
                    if (zoneData.metCriteria.noise && userPreferences.noise) {
                        matchReasoning += `The noise level (${zoneData.noise} dB) is well-suited for your chosen activity. `;
                        preferenceMatchCount++;
                    }
                    if (zoneData.metCriteria.temp && userPreferences.temp) {
                        matchReasoning += `The temperature of ${zoneData.temperature}°C (feels like ${parseFloat(zoneData.feelsLikeTemp).toFixed(2)}°C) meets your comfort needs. `;
                        preferenceMatchCount++;
                    }
                }

                if (preferenceMatchCount === 0 && totalUserPrefsSelected > 0) {
                     if (!matchReasoning.includes("doesn't closely match")) { 
                        matchReasoning += "While it may not perfectly align with all your selected preferences, it offers a generally balanced environment.";
                    }
                } else if (totalUserPrefsSelected === 0) {
                    matchReasoning = `This zone offers a standard work environment. It's located at: ${locationTextForDetails}. Check its characteristics below.`;
                }
                if (elements.matchDescription) elements.matchDescription.textContent = matchReasoning.trim() || "Details about this zone's suitability based on your preferences.";

                // Add characteristics (Light, Temp, Noise).
                if (elements.charLightLabel) elements.charLightLabel.textContent = getLightDescription(zoneData.light);
                let lightValueText = `${(zoneData.light !== 'N/A' && !isNaN(parseFloat(zoneData.light))) ? parseFloat(zoneData.light).toFixed(1) + ' lux' : 'Data unavailable'}`;
                if (userPreferences.light && lightingThresholds[userPreferences.light] && typeof zoneData.light === 'number' && !isNaN(zoneData.light)) {
                    const prefLight = lightingThresholds[userPreferences.light];
                    if (zoneData.light >= prefLight.min && zoneData.light <= prefLight.max) lightValueText += ` • Matches preference`;
                    else if (zoneData.light < prefLight.min) lightValueText += ` • Dimmer than preferred`;
                    else lightValueText += ` • Brighter than preferred`;
                }
                if (elements.charLightValue) elements.charLightValue.textContent = lightValueText;

                if (elements.charTempLabel) elements.charTempLabel.textContent = `${(zoneData.temperature !== 'N/A' && !isNaN(parseFloat(zoneData.temperature))) ? parseFloat(zoneData.temperature).toFixed(1) + '°C' : 'N/A'}`;
                if (elements.charTempValue) elements.charTempValue.textContent = `Feels like: ${(zoneData.feelsLikeTemp !== 'N/A' && !isNaN(parseFloat(zoneData.feelsLikeTemp))) ? parseFloat(zoneData.feelsLikeTemp).toFixed(2) + '°C' : 'N/A'} • ${getTemperatureDescription(zoneData.temperature)}`;

                if (elements.charNoiseLabel) elements.charNoiseLabel.textContent = getNoiseDescription(zoneData.noise);
                let noiseSubText = `${(zoneData.noise !== 'N/A' && !isNaN(parseFloat(zoneData.noise))) ? parseFloat(zoneData.noise).toFixed(1) + ' dB' : 'Data unavailable'}`;
                 if (userPreferences.noise && noiseWorkTypeThresholds[userPreferences.noise] && typeof zoneData.noise === 'number' && !isNaN(zoneData.noise)) {
                    const prefRange = noiseWorkTypeThresholds[userPreferences.noise];
                    const userPrefText = (preferenceDisplayMap[userPreferences.noise]?.text || userPreferences.noise).split('(')[0].trim();
                    if (zoneData.noise >= prefRange.min && zoneData.noise <= prefRange.max) noiseSubText += ` • Ideal for ${userPrefText}`;
                    else if (zoneData.noise < prefRange.min) noiseSubText += ` • Quieter than typical for ${userPrefText}`;
                    else noiseSubText += ` • Noisier than typical for ${userPrefText}`;
                }
                if (elements.charNoiseValue) elements.charNoiseValue.textContent = noiseSubText;


                // work type information based on noise preference.
                if (userPreferences.noise && noisePreferenceDescriptors[userPreferences.noise]) {
                    if (elements.workTypeLabel) elements.workTypeLabel.textContent = noisePreferenceDescriptors[userPreferences.noise].label;
                    const prefNoiseRange = noiseWorkTypeThresholds[userPreferences.noise];
                    if (prefNoiseRange && typeof zoneData.noise === 'number' && !isNaN(zoneData.noise)) {
                        if (elements.workTypeValue) elements.workTypeValue.textContent = (zoneData.noise >= prefNoiseRange.min && zoneData.noise <= prefNoiseRange.max) ? `Noise level is suitable.` : `Current noise (${zoneData.noise} dB) may differ.`;
                    } else {
                        if (elements.workTypeValue) elements.workTypeValue.textContent = "Details based on your noise preference.";
                    }
                } else {
                    if (elements.workTypeLabel) elements.workTypeLabel.textContent = "General Use";
                    if (elements.workTypeValue) elements.workTypeValue.textContent = "Suitable for various activities.";
                }

                // (AI assistance) Populate status information (availability, crowd level - assuming these are in zoneData).
                if (elements.availabilityText) elements.availabilityText.textContent = zoneData.availabilityText || "Available";
                if (elements.availabilitySubtext) elements.availabilitySubtext.textContent = zoneData.availabilitySubtext || "Ready to use now";
                if (elements.availabilityIcon && elements.availabilityIcon.firstChild) elements.availabilityIcon.firstChild.className = zoneData.availabilityIconClass || "fas fa-check-circle"; // Default to available
                if (elements.crowdLevelText) elements.crowdLevelText.textContent = zoneData.crowdLevelText || "Not Busy";

            } else { // Handle case where specific zoneData is not found for the given zoneIdParam
                debugDataFlow('ZoneDetailsPage', 'ZoneDataErrorForDetails', `No specific data found for Zone ID: ${zoneIdParam} to populate details.`);
                if (elements.zoneDetailTitle) elements.zoneDetailTitle.textContent = `Zone ${zoneIdParam || "Details Unavailable"}`;
                if (elements.zoneDetailSubtitle) elements.zoneDetailSubtitle.textContent = "Detailed information could not be loaded for this zone.";
                if (elements.matchDescription) elements.matchDescription.textContent = "Suitability information is unavailable. Please ensure this zone ID is correct and was part of your recommendations.";
                if (elements.mainImg) elements.mainImg.src = 'Images/default-room.jpg'; // Default image

                // Clear characteristics with default labels and "Data unavailable" values
                const fieldsToClear = [
                    { labelEl: elements.charLightLabel, valueEl: elements.charLightValue, defaultLabel: "Light" },
                    { labelEl: elements.charTempLabel, valueEl: elements.charTempValue, defaultLabel: "Temperature" },
                    { labelEl: elements.charNoiseLabel, valueEl: elements.charNoiseValue, defaultLabel: "Noise Level" },
                    { labelEl: elements.workTypeLabel, valueEl: elements.workTypeValue, defaultLabel: "Best For" }
                ];
                fieldsToClear.forEach(field => {
                    if (field.labelEl) field.labelEl.textContent = field.defaultLabel;
                    if (field.valueEl) field.valueEl.textContent = "Data unavailable";
                });
                if (elements.comfortScoreValue) elements.comfortScoreValue.textContent = "--/100";
            }
        }

        // Sets up event listeners for action buttons on the zone details page.
        function setupActionButtons() {
            if (!zoneIdParam) return; 

            const backButton = document.getElementById('zoneDetailGoBackBtn');
            if (backButton) {
                backButton.addEventListener('click', () => window.history.back());
            }

            const showForecastBtn = document.getElementById('showFutureConditionsBtn');
            if (showForecastBtn) {
                showForecastBtn.addEventListener('click', () => {
                    window.location.href = `zone_forecast.html?id=${encodeURIComponent(zoneIdParam)}`;
                });
            }

            const findAlternativesBtnGlobal = document.getElementById('findAlternativesBtn'); 
            if (findAlternativesBtnGlobal) {
                findAlternativesBtnGlobal.addEventListener('click', findAlternatives); 
            }

            const bookSpaceBtnGlobal = document.getElementById('bookSpaceBtn'); 
            if (bookSpaceBtnGlobal) {
                bookSpaceBtnGlobal.addEventListener('click', bookSpace); 
            }
        }

        // Initializes all functionalities for the zone details page.
        function initializeZoneDetails() {
            if (!zoneIdParam) return; // Do not proceed if no zone ID
            console.log('[ZoneDetailsPage] Initializing zone details page for Zone ID:', zoneIdParam);
            setupInteractiveCharacteristics();
            setupFloorplanHighlight();
            populateZoneDetails();
            setupActionButtons();
            console.log('[ZoneDetailsPage] Zone details page initialization complete');
        }
        initializeZoneDetails(); 
    }


    // Section: Booking Confirmation Page Logic
    // Purpose: Manages the display of booking confirmation details.
    if (document.body.classList.contains('booking-confirmation-page')) {
        console.log("Booking confirmation page detected. Initializing...");

        function initializeBookingConfirmation() {
            console.log("Initializing booking confirmation page content...");
            const urlParams = new URLSearchParams(window.location.search);
            const bookedZoneId = urlParams.get('zone') || 'Unknown'; // Default to 'Unknown' if not provided
            console.log("Booked Zone ID from URL:", bookedZoneId);

            updateZoneInfo(bookedZoneId);
            updateBookingTimes();
            updateZoneCharacteristics(bookedZoneId); 
            generateConfirmationNumber();
            setupButtonListeners(bookedZoneId);
            startCountdownTimer();
        }

        function updateZoneInfo(zoneId) {
            const bookedZoneElement = document.getElementById('bookedZone');
            if (bookedZoneElement) bookedZoneElement.textContent = `Zone ${zoneId}`;

            const bookingTitleElement = document.getElementById('bookingTitle');
            if (bookingTitleElement) bookingTitleElement.textContent = `Zone ${zoneId} Successfully Booked!`;

            const zoneLocationElement = document.getElementById('zoneLocation');
            if (zoneLocationElement) {
                // Attempt to get location from the global zoneLocations map
                zoneLocationElement.textContent = zoneLocations[zoneId] || `Location details for Zone ${zoneId} unavailable.`;
            }
        }

        function updateBookingTimes() {
            const now = new Date();
            const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Booking for 2 hours

            const bookingDateElement = document.getElementById('bookingDate');
            if (bookingDateElement) {
                bookingDateElement.textContent = now.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
            const bookingTimeElement = document.getElementById('bookingTime');
            if (bookingTimeElement) {
                const startTimeString = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
                const endTimeString = endTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
                bookingTimeElement.textContent = `${startTimeString} - ${endTimeString}`;
            }
            const bookingDurationElement = document.getElementById('bookingDuration');
            if (bookingDurationElement) bookingDurationElement.textContent = '2 Hours';
        }

        function updateZoneCharacteristics(zoneId) {
            
            let lightInfo = "Well-lit (approx. 450 lux)";
            let noiseInfo = "Quiet (approx. 42 dB)";
            let tempInfo = "Comfortable (approx. 24°C)";
            let comfortScoreInfo = "85/100";

            const recommendationsStr = localStorage.getItem('finalRecommendations');
            if (recommendationsStr) {
                try {
                    const recommendations = JSON.parse(recommendationsStr);
                    const zoneData = recommendations.find(rec => String(rec.zoneId) === String(zoneId));
                    if (zoneData) {
                        lightInfo = `${getLightDescription(zoneData.light)} (${zoneData.light !== 'N/A' ? parseFloat(zoneData.light).toFixed(0) + ' lux' : 'N/A'})`;
                        noiseInfo = `${getNoiseDescription(zoneData.noise)} (${zoneData.noise !== 'N/A' ? parseFloat(zoneData.noise).toFixed(0) + ' dB' : 'N/A'})`;
                        tempInfo = `${getTemperatureDescription(zoneData.temperature)} (${zoneData.temperature !== 'N/A' ? parseFloat(zoneData.temperature).toFixed(0) + '°C' : 'N/A'})`;
                        comfortScoreInfo = `${zoneData.comfortScore !== undefined ? Math.round(zoneData.comfortScore * 100) : '--'}/100`;
                    }
                } catch (e) { console.error("Error parsing recommendations for booking characteristics:", e); }
            }

            const elements = {
                bookingLight: document.getElementById('bookingLightInfo'),
                bookingNoise: document.getElementById('bookingNoiseInfo'),
                bookingTemp: document.getElementById('bookingTempInfo'),
                bookingComfort: document.getElementById('bookingComfortScore')
            };
            if (elements.bookingLight) elements.bookingLight.innerHTML = `<i class="fas fa-lightbulb"></i> <strong>Lighting:</strong> ${lightInfo}`;
            if (elements.bookingNoise) elements.bookingNoise.innerHTML = `<i class="fas fa-volume-up"></i> <strong>Noise Level:</strong> ${noiseInfo}`;
            if (elements.bookingTemp) elements.bookingTemp.innerHTML = `<i class="fas fa-thermometer-half"></i> <strong>Temperature:</strong> ${tempInfo}`;
            if (elements.bookingComfort) elements.bookingComfort.innerHTML = `<i class="fas fa-star"></i> <strong>Comfort Rating:</strong> ${comfortScoreInfo}`;
            console.log("Updated zone characteristics for booking confirmation.");
        }

        function generateConfirmationNumber() {
            const confirmationElement = document.getElementById('confirmationNumber');
            if (confirmationElement) {
                confirmationElement.textContent = 'BK' + Math.random().toString(36).substring(2, 11).toUpperCase();
            }
        }

        function startCountdownTimer() {
            const countdownElement = document.getElementById('bookingCountdown');
            if (!countdownElement) return;

            const bookingEndTime = new Date().getTime() + (2 * 60 * 60 * 1000); // 2 hours from now

            function updateCountdown() {
                const now = new Date().getTime();
                const timeLeft = bookingEndTime - now;

                if (timeLeft <= 0) {
                    countdownElement.textContent = 'Booking Expired';
                    countdownElement.style.color = '#dc2626'; // Red
                    clearInterval(countdownInterval); // Stop the interval
                    return;
                }
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                countdownElement.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} remaining`;

                if (timeLeft < 10 * 60 * 1000) countdownElement.style.color = '#dc2626'; // Red for last 10 mins
                else if (timeLeft < 30 * 60 * 1000) countdownElement.style.color = '#f59e0b'; // Amber for last 30 mins
            }
            updateCountdown(); // Initial call
            const countdownInterval = setInterval(updateCountdown, 1000);
            console.log("Countdown timer started.");
        }

        function setupButtonListeners(zoneId) {
            const viewDetailsBtn = document.getElementById('viewZoneDetailsBtn');
            if (viewDetailsBtn) {
                viewDetailsBtn.addEventListener('click', () => window.location.href = `zone-details.html?id=${encodeURIComponent(zoneId)}`);
            }
            const modifyBookingBtn = document.getElementById('modifyBookingBtn');
            if (modifyBookingBtn) {
                modifyBookingBtn.addEventListener('click', () => {
                    // AI: Using confirm(). custom modal for better UX.
                    if (confirm('Do you want to modify your booking? This will take you back to the results page to choose another spot.')) {
                        window.location.href = 'results.html';
                    }
                });
            }
            const findAlternativesBtn = document.getElementById('findAlternativesFromBookingBtn');
            if (findAlternativesBtn) {
                 
                findAlternativesBtn.addEventListener('click', () => window.location.href = 'results.html');
            }
            const cancelBookingBtn = document.getElementById('cancelBookingBtn');
            if (cancelBookingBtn) {
                cancelBookingBtn.addEventListener('click', () => {
                    // AI: Using confirm() and alert(). custom modals.
                    if (confirm('Are you sure you want to cancel this booking?')) {
                        alert('Booking cancelled successfully.');
                        window.location.href = 'index.html';
                    }
                });
            }
            const doneBtn = document.getElementById('bookingDoneBtn');
            if (doneBtn) {
                doneBtn.addEventListener('click', () => window.location.href = 'index.html');
            }
        }
        initializeBookingConfirmation(); 
    }
});

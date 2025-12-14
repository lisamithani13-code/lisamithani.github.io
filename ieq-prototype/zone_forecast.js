//
// zone_forecast.js - Zone Environmental Condition Forecast Script
// ---------------------------------------------------------------
// This script handles fetching, processing, and displaying forecasted
// environmental data (light, temperature, noise) for a specific zone
// using interactive charts and textual summaries. It also manages
// UI elements like navigation and chart focusing.
//

document.addEventListener('DOMContentLoaded', async () => {

    // --- Section: 1. Initialization and DOM Setup ---
    // Purpose: Sets up initial page elements, retrieves URL parameters, and configures basic UI.

    // Display current year in the footer or relevant element.

    if(document.getElementById('currentYearForecast')) {
        document.getElementById('currentYearForecast').textContent = new Date().getFullYear();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const zoneId = urlParams.get('id');
    const zoneIdStr = zoneId ? zoneId.toString() : null;

    
    const forecastTitleEl = document.getElementById('forecastZoneTitle');
    if (forecastTitleEl && zoneIdStr) {
        forecastTitleEl.textContent = `Forecast for Zone ${zoneIdStr}`;
    } else if (forecastTitleEl) {
        forecastTitleEl.textContent = 'Zone Forecast (Zone ID Missing)';
    }
    
    const forecastBackBtn = document.getElementById('forecastBackBtn');
    if (forecastBackBtn) {
        if (zoneIdStr) {
            forecastBackBtn.href = `zone-details.html?id=${encodeURIComponent(zoneIdStr)}`;
        } else {
            forecastBackBtn.href = 'results.html'; 
        }
    }

    // --- Section: 2. Configuration Constants ---
    // Purpose: Defines thresholds and mappings for environmental parameters and preferences.
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
        'dim': { text: 'Dim (0-150 lx)', short: 'Dim Lighting' },
        'balanced': { text: 'Balanced (151-500 lx)', short: 'Balanced Lighting' },
        'well-lit': { text: 'Well Lit (501-1000 lx)', short: 'Bright Lighting' },
        'sunny-natural': { text: 'Sunny (>1000 lx)', short: 'Sunny Conditions' },
        'focus-work': { text: 'Focus (Quiet <45dB)', short: 'Quiet Environment' },
        'relaxed-productivity': { text: 'Relaxed (40-50dB)', short: 'Moderate Noise' },
        'collaborative-work': { text: 'Collaborative (45-55dB)', short: 'Active Environment' },
        'break-relaxation': { text: 'Break (<48dB)', short: 'Peaceful Setting' },
        'stable-comfortable': { text: 'Comfortable (23-25°C)', short: 'Comfortable Temperature' },
        'consistently-warm': { text: 'Warm (>25°C)', short: 'Warm Temperature' },
        'slightly-cool': { text: 'Cool (<23°C)', short: 'Cool Temperature' },
        'Not specified': { text: 'Not specified', short: 'No Preference' }
    };

    // --- Section: 3. Utility Functions ---
    // Purpose: Provides helper functions for common tasks like data fetching and formatting.

    // AI: CSV Error in Samba Lights Data Processing (and other CSVs)
    // This function is crucial for loading data. Errors here will prevent forecasts from displaying.
    // AI: Troubleshooting Application Loading Page Errors
    // AI Assistance needed because: Failures in fetching CSVs are a primary cause of loading issues on this page.

    async function fetchCSV(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const text = await response.text();
            if (!text || text.trim() === "") throw new Error("File is empty or contains no data");
            return text;
        } catch (error) {
            console.error(`[CSV Fetch] Failed to load ${filePath}:`, error);
            return null;
        }
    }

    // Converts time strings (e.g., "13:00") to AM/PM format.
    function convertToAmPm(timeStr) {
        if (!timeStr || !timeStr.includes(':')) return timeStr; // Return original if format is unexpected.
        const [hour, minute] = timeStr.split(':');
        const hourNum = parseInt(hour, 10);

        if (isNaN(hourNum) || isNaN(parseInt(minute, 10))) return timeStr; // Invalid time components

        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const twelveHour = hourNum % 12 || 12; // Convert 0 or 12 to 12
        return `${twelveHour}:${minute} ${ampm}`;
    }

    // --- Section: 4. Insight and Summary Generation ---
    // Purpose: Creates textual summaries and insights based on processed data and user preferences.

    // Generates smart textual insights for a chart based on data and preferred range.
    function generateSmartInsights(xValues, yValues, preferredRange, parameterType) {
        if (!yValues || yValues.length === 0) {
            return { mainInsight: `No ${parameterType.toLowerCase()} data available`, subInsight: '' };
        }

        const validValues = yValues.filter(v => v !== null && !isNaN(v));
        if (validValues.length === 0) {
            return { mainInsight: `No valid ${parameterType.toLowerCase()} readings`, subInsight: '' };
        }

        const avgValue = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        const minValue = Math.min(...validValues);
        const maxValue = Math.max(...validValues);

        // Get office hours insight for light data
        let officeHoursInsight = '';
        if (parameterType === 'Light' && xValues.length > 0) {
            // Check if we have hourly data that might include office hours
            const hasHourlyData = xValues.some(x => x.includes(':'));
            if (hasHourlyData) {
                const officeHourValues = yValues.filter((val, idx) => {
                    const timeLabel = xValues[idx];
                    if (timeLabel && timeLabel.includes(':')) {
                        const hour = parseInt(timeLabel.split(':')[0]);
                        return hour >= 9 && hour <= 17; // 9am to 5pm
                    }
                    return false;
                });
                
                if (officeHourValues.length > 0) {
                    const officeAvg = officeHourValues.reduce((sum, v) => sum + v, 0) / officeHourValues.length;
                    if (preferredRange && officeAvg >= preferredRange.min && officeAvg <= preferredRange.max) {
                        officeHoursInsight = ' During office hours, lighting aligns well with your preferences.';
                    } else if (preferredRange && officeAvg > preferredRange.max) {
                        officeHoursInsight = ' Office hours tend to be brighter than your preference.';
                    } else if (preferredRange && officeAvg < preferredRange.min) {
                        officeHoursInsight = ' Office hours may be dimmer than your preference.';
                    }
                }
            }
        }

        // Check night-time conditions for light
        let nightInsight = '';
        if (parameterType === 'Light' && xValues.length > 0) {
            const hasHourlyData = xValues.some(x => x.includes(':'));
            if (hasHourlyData) {
                const nightValues = yValues.filter((val, idx) => {
                    const timeLabel = xValues[idx];
                    if (timeLabel && timeLabel.includes(':')) {
                        const hour = parseInt(timeLabel.split(':')[0]);
                        return hour >= 19 || hour <= 6; // 7pm to 6am
                    }
                    return false;
                });
                
                if (nightValues.length > 0 && preferredRange) {
                    const nightAvg = nightValues.reduce((sum, v) => sum + v, 0) / nightValues.length;
                    if (nightAvg > preferredRange.max) {
                        nightInsight = ' Evening lighting may be too bright for comfort.';
                    }
                }
            }
        }

        // Generate main insights based on preferred range
        let mainInsight = '';
        let subInsight = '';

        if (!preferredRange) {
            mainInsight = `Average ${parameterType.toLowerCase()}: ${avgValue.toFixed(1)}${parameterType === 'Light' ? ' lux' : parameterType === 'Temperature' ? '°C' : ' dB'}`;
            subInsight = `Range: ${minValue.toFixed(1)} - ${maxValue.toFixed(1)}`;
        } else {
            const inRangeCount = validValues.filter(v => v >= preferredRange.min && v <= preferredRange.max).length;
            const percentageInRange = Math.round((inRangeCount / validValues.length) * 100);

            if (percentageInRange >= 80) {
                mainInsight = `Within preferred range for most of the day (${percentageInRange}%)`;
                subInsight = `Excellent conditions throughout.${officeHoursInsight}${nightInsight}`;
            } else if (percentageInRange >= 50) {
                mainInsight = `Partially matches your preferences (${percentageInRange}%)`;
                subInsight = `Some periods align well with your needs.${officeHoursInsight}${nightInsight}`;
            } else if (percentageInRange > 0) {
                mainInsight = `Limited optimal periods (${percentageInRange}%)`;
                if (avgValue > preferredRange.max) {
                    subInsight = `Generally ${parameterType === 'Light' ? 'brighter' : parameterType === 'Temperature' ? 'warmer' : 'louder'} than preferred.${officeHoursInsight}${nightInsight}`;
                } else {
                    subInsight = `Generally ${parameterType === 'Light' ? 'dimmer' : parameterType === 'Temperature' ? 'cooler' : 'quieter'} than preferred.${officeHoursInsight}${nightInsight}`;
                }
            } else {
                mainInsight = `Doesn't match your preferred range`;
                if (avgValue > preferredRange.max) {
                    subInsight = `Consistently ${parameterType === 'Light' ? 'too bright' : parameterType === 'Temperature' ? 'too warm' : 'too noisy'}.${officeHoursInsight}${nightInsight}`;
                } else {
                    subInsight = `Consistently ${parameterType === 'Light' ? 'too dim' : parameterType === 'Temperature' ? 'too cool' : 'too quiet'}.${officeHoursInsight}${nightInsight}`;
                }
            }
        }

        // Special insight for feels-like temperature
        if (parameterType === 'Temperature') {
            subInsight += ' Feels-like temperature shown for comfort reference.';
        }

        return { mainInsight, subInsight: subInsight.trim() };
    }

    // Enhanced time period analysis
    function analyzePreferredRangePeriods(xValues, yValues, preferredRange, parameterType) {
        if (!preferredRange || !yValues || yValues.length === 0) {
            return { 
                periods: [], 
                totalDuration: 0, 
                currentStatus: null, 
                summary: `No ${parameterType.toLowerCase()} preference set`,
                detailedSummary: `General ${parameterType.toLowerCase()} conditions shown`,
                preferenceAreaSummary: `No preference set`
            };
        }

        const periods = [];
        let currentPeriod = null;
        let totalInRangePeriods = 0;

        for (let i = 0; i < yValues.length; i++) {
            const value = yValues[i];
            const timeLabel = xValues[i];
            const isInRange = value !== null && value >= preferredRange.min && value <= preferredRange.max;

            if (isInRange) {
                if (!currentPeriod) {
                    currentPeriod = { start: timeLabel, end: timeLabel, startIndex: i, endIndex: i };
                } else {
                    currentPeriod.end = timeLabel;
                    currentPeriod.endIndex = i;
                }
                totalInRangePeriods++;
            } else {
                if (currentPeriod) {
                    periods.push({ ...currentPeriod });
                    currentPeriod = null;
                }
            }
        }

        if (currentPeriod) {
            periods.push(currentPeriod);
        }

        // Generate better summaries with AM/PM format
        let summary, detailedSummary, preferenceAreaSummary;
        const percentageOptimal = Math.round((totalInRangePeriods / yValues.length) * 100);
        
        if (periods.length === 0) {
            summary = `Not optimal today`;
            detailedSummary = `${parameterType} levels don't match your preferences throughout the day`;
            preferenceAreaSummary = `Not in preferred range today`;
        } else {
            const totalPeriods = periods.length;
            
            // Check if it covers most of the day
            const isAllDay = totalInRangePeriods === yValues.length;
            const isMostOfDay = percentageOptimal >= 80;
            
            if (isAllDay) {
                summary = `Optimal throughout the day`;
                detailedSummary = `Perfect ${parameterType.toLowerCase()} conditions all day long (100% of day)`;
                preferenceAreaSummary = `Optimal all day`;
            } else if (isMostOfDay) {
                summary = `Optimal most of the day (${percentageOptimal}%)`;
                detailedSummary = `Excellent ${parameterType.toLowerCase()} conditions for most periods (${percentageOptimal}% of day)`;
                preferenceAreaSummary = `Optimal most of the day`;
            } else if (totalPeriods === 1) {
                const period = periods[0];
                const startAmPm = convertToAmPm(period.start);
                const endAmPm = convertToAmPm(period.end);
                
                if (period.start === period.end) {
                    summary = `Optimal at ${startAmPm}`;
                    detailedSummary = `Perfect ${parameterType.toLowerCase()} conditions at ${startAmPm} (${percentageOptimal}% of day)`;
                    preferenceAreaSummary = `Optimal at ${startAmPm}`;
                } else {
                    summary = `Optimal: ${startAmPm} to ${endAmPm}`;
                    detailedSummary = `Perfect ${parameterType.toLowerCase()} conditions from ${startAmPm} to ${endAmPm} (${percentageOptimal}% of day)`;
                    preferenceAreaSummary = `Optimal: ${startAmPm} - ${endAmPm}`;
                }
            } else {
                summary = `Optimal in ${totalPeriods} periods (${percentageOptimal}% of day)`;
                const firstPeriod = periods[0];
                const lastPeriod = periods[periods.length - 1];
                const firstStartAmPm = convertToAmPm(firstPeriod.start);
                const lastEndAmPm = convertToAmPm(lastPeriod.end);
                detailedSummary = `${totalPeriods} optimal periods from ${firstStartAmPm} to ${lastEndAmPm} (${percentageOptimal}% of day)`;
                preferenceAreaSummary = `${totalPeriods} optimal periods (${percentageOptimal}% of day)`;
            }
        }

        return { 
            periods, 
            totalDuration: totalInRangePeriods, 
            percentageOptimal,
            summary,
            detailedSummary,
            preferenceAreaSummary
        };
    }

    // --- Section: 5. Data Processing Functions ---
    // Purpose: Parses and transforms raw CSV data into formats suitable for charting.
    // AI: CSV Error in Samba Lights Data Processing (and other CSVs)
    // All functions in this section are critical for interpreting CSV data.
    // AI Assistance needed because: Errors or incorrect parsing logic will lead to missing or wrong chart data.

    // Processes light data from CSV, expecting 'Zones' as the first column and time periods as subsequent columns.

function processLightDataForZone(csvString, targetZoneId) {
    if (!csvString || !targetZoneId) return null;
    
    try {
        const lines = csvString.trim().split(/\r\n|\n/).filter(line => line.trim());
        if (lines.length < 2) return null;
        
        const headers = lines[0].split(',').map(h => h.trim());
        if (headers[0].toLowerCase() !== 'zones') return null;

        // FIXED: Correct chronological order for time periods
        const timePeriodMapping = [
            { csvHeader: 'Early Morning', displayName: 'Early Morning' },
            { csvHeader: 'Morning', displayName: 'Morning' },
            { csvHeader: 'Afternoon', displayName: 'Afternoon' },
            { csvHeader: 'Evening', displayName: 'Evening' },
            { csvHeader: 'Late evening', displayName: 'Late Evening' },
            { csvHeader: 'Night', displayName: 'Night' }
        ];
        
        let targetRowData = null;
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values[0] === targetZoneId.toString()) {
                targetRowData = values;
                break;
            }
        }

        if (!targetRowData) return null;

        const xValues = [];
        const yValues = [];
        let validDataPoints = 0;

        timePeriodMapping.forEach(periodMap => {
            const colIndex = headers.findIndex(h => h.trim() === periodMap.csvHeader);
            if (colIndex !== -1 && colIndex < targetRowData.length) {
                const rawValue = targetRowData[colIndex];
                const numericValue = parseFloat(rawValue);
                
                xValues.push(periodMap.displayName);
                if (rawValue && rawValue.trim() !== "" && !isNaN(numericValue)) {
                    yValues.push(numericValue);
                    validDataPoints++;
                } else {
                    yValues.push(null);
                }
            }
        });
        
        return validDataPoints > 0 ? { x: xValues, y: yValues, validPoints: validDataPoints } : null;
    } catch (error) {
        console.error("[Light Data] Processing error:", error);
        return null;
    }
}
    
    function processZoneRowHourlyData(csvString, targetZoneId, dataType) {
        if (!csvString || !targetZoneId) return null;
        
        try {
            const lines = csvString.trim().split(/\r\n|\n/).filter(line => line.trim());
            if (lines.length < 2) return null;

            const headers = lines[0].split(',').map(h => h.trim());
            if (headers[0].toLowerCase() !== 'zone') return null;

            const hourHeaders = headers.slice(1);
            let targetRowData = null;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values[0] === targetZoneId.toString()) {
                    targetRowData = values.slice(1);
                    break;
                }
            }

            if (!targetRowData) return null;

            const xValues = [];
            const yValues = [];
            let validDataPoints = 0;

            hourHeaders.forEach((hour, index) => {
                const rawValue = targetRowData[index];
                const label = `${hour}:00`;
                
                xValues.push(label);
                if (rawValue !== undefined && rawValue !== '') {
                    const numericValue = parseFloat(rawValue);
                    if (!isNaN(numericValue)) {
                        yValues.push(numericValue);
                        validDataPoints++;
                    } else {
                        yValues.push(null);
                    }
                } else {
                    yValues.push(null);
                }
            });
            
            return validDataPoints > 0 ? { x: xValues, y: yValues, validPoints: validDataPoints } : null;
        } catch (error) {
            return null;
        }
    }

    function processZoneColumnHourlyData(csvString, targetZoneId, dataType) {
        if (!csvString || !targetZoneId) return null;
        
        try {
            const lines = csvString.trim().split(/\r\n|\n/).filter(line => line.trim());
            let headerRowIndex = -1;
            let actualHeaders;

            for (let i = 0; i < Math.min(lines.length, 5); i++) { 
                actualHeaders = lines[i].split(',').map(h => h.trim());
                if (actualHeaders.some(h => h.toLowerCase() === 'hour')) {
                    const foundZone = actualHeaders.find(h => 
                        h === targetZoneId || h.toLowerCase() === targetZoneId.toLowerCase()
                    );
                    if (foundZone) {
                        headerRowIndex = i;
                        targetZoneId = foundZone;
                        break;
                    }
                }
            }
            
            if (headerRowIndex === -1 || lines.length < headerRowIndex + 2) return null;
            
            actualHeaders = lines[headerRowIndex].split(',').map(h => h.trim());
            const zoneColumnIndex = actualHeaders.indexOf(targetZoneId);
            const hourColumnIndex = actualHeaders.findIndex(h => h.toLowerCase() === 'hour');

            if (zoneColumnIndex === -1 || hourColumnIndex === -1) return null;

            const xValues = []; 
            const yValues = [];
            let validDataPoints = 0;
            
            for (let i = headerRowIndex + 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== actualHeaders.length) continue;
                
                const hourStr = values[hourColumnIndex];
                const hour = parseInt(hourStr);
                if (isNaN(hour) || hour < 0 || hour > 23) continue;
                
                const dataValueStr = values[zoneColumnIndex];
                const dataValue = parseFloat(dataValueStr);
                
                xValues.push(`${hour}:00`);
                if (dataValueStr && dataValueStr.trim() !== "" && !isNaN(dataValue)) {
                    yValues.push(dataValue);
                    validDataPoints++;
                } else {
                    yValues.push(null);
                }
            }
            
            return validDataPoints > 0 ? { x: xValues, y: yValues, validPoints: validDataPoints } : null;
        } catch (error) {
            return null;
        }
    }

    // Feels-like temperature processing (simplified)
    function processFeelsLikeLookup(csvString) {
        if (!csvString) return [];
        
        const rows = csvString.trim().split(/\r\n|\n/);
        const data = [];
        if (rows.length <= 1) return data;
        
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].toLowerCase().includes('ta') && rows[i].toLowerCase().includes('feels like')) {
                headerRowIndex = i;
                break;
            }
        }
        
        if (headerRowIndex === -1) return data;
        
        const headers = rows[headerRowIndex].split(',').map(h => h.trim().toLowerCase());
        const taIndex = headers.indexOf('ta');
        const feelsLikeIndex = headers.findIndex(h => h.includes('feels like'));
        
        if (taIndex === -1 || feelsLikeIndex === -1) return data;
        
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const values = rows[i].split(',').map(v => v.trim());
            if (values.length > Math.max(taIndex, feelsLikeIndex)) {
                const ta = parseFloat(values[taIndex]);
                const feelsLike = parseFloat(values[feelsLikeIndex]);
                if (!isNaN(ta) && !isNaN(feelsLike)) {
                    data.push({ ta, feelsLike });
                }
            }
        }
        
        data.sort((a, b) => a.ta - b.ta);
        return data;
    }

    function getFeelsLikeTemperature(ambientTemp, feelsLikeLookupData) {
        if (!feelsLikeLookupData || feelsLikeLookupData.length === 0 || 
            ambientTemp === null || ambientTemp === undefined || 
            isNaN(parseFloat(ambientTemp))) {
            return null;
        }
        
        const numAmbientTemp = parseFloat(ambientTemp);
        let closest = feelsLikeLookupData[0];
        
        for (let i = 1; i < feelsLikeLookupData.length; i++) {
            if (Math.abs(feelsLikeLookupData[i].ta - numAmbientTemp) < 
                Math.abs(closest.ta - numAmbientTemp)) {
                closest = feelsLikeLookupData[i];
            }
        }
        
        return closest.feelsLike;
    }

    // --- Section: 6. Chart Creation and Enhancement ---
    // Purpose: Function responsible for generating and styling Plotly charts.

    // Creates a single, primary data trace for a chart.
    function createSingleVisibleTrace(name, xValues, yValues, preferredRange, color, unit = '', parameterType = '') {
        // Create one main trace that's always visible
        const mainTrace = {
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: color,
                width: 4,
                shape: 'spline'
            },
            marker: {
                color: color,
                size: 8,
                line: { color: '#ffffff', width: 2 }
            },
            name: name,
            hovertemplate: `%{x}: %{y:.2f}${unit}<extra></extra>`, // FIXED: 2 decimal places
            x: xValues,
            y: yValues,
            connectgaps: false,
            showlegend: false
        };

        console.log(`[Chart Debug] Creating trace for ${name} with ${xValues.length} points`);
        console.log(`[Chart Debug] X values:`, xValues);
        console.log(`[Chart Debug] Y values:`, yValues);

        return [mainTrace];
    }

    // ENHANCED: Chart creation with office hours shading and better accessibility
    function createEnhancedChart(divId, xValues, yValues, yTitle, preferredRange, color, unit = '', additionalTraces = [], parameterType = '') {
        const chartDiv = document.getElementById(divId);
        if (!chartDiv) {
            console.error(`Chart container '${divId}' not found`);
            return;
        }
        
        try {
            console.log(`[Chart Debug] Creating chart for ${divId}`);
            console.log(`[Chart Debug] Data length: ${yValues.length}`);
            
            chartDiv.innerHTML = '';
            
            const mainTraces = createSingleVisibleTrace('Data', xValues, yValues, preferredRange, color, unit, parameterType);
            const allTraces = [...mainTraces, ...additionalTraces];
            
            console.log(`[Chart Debug] Total traces: ${allTraces.length}`);
            
            // Calculate Y-axis range to show ALL data with padding, not limited by preferred range
            const validYValues = yValues.filter(v => v !== null && !isNaN(v));
            const additionalYValues = additionalTraces.flatMap(trace => 
                trace.y ? trace.y.filter(v => v !== null && !isNaN(v)) : []
            );
            const allYValues = [...validYValues, ...additionalYValues];
            
            let yAxisRange = null;
            if (allYValues.length > 0) {
                const minY = Math.min(...allYValues);
                const maxY = Math.max(...allYValues);
                const dataRange = maxY - minY;
                const padding = Math.max(dataRange * 0.15, 0.5); // At least 15% padding or 0.5 units
                
                yAxisRange = [
                    Math.max(0, minY - padding), // Don't go below 0 for most measurements
                    maxY + padding
                ];
                
                // For noise data, ensure we show a reasonable range even if data is clustered
                if (parameterType === 'Noise' && dataRange < 5) {
                    const center = (minY + maxY) / 2;
                    yAxisRange = [center - 3, center + 3];
                }
            }
            
            // Enhanced shapes array with office hours and preferred range
            const shapes = [];
            
            // Add preferred range background - restore the purple shading in charts
            if (preferredRange) {
                shapes.push({
                    type: 'rect',
                    xref: 'paper',
                    x0: 0,
                    x1: 1,
                    yref: 'y',
                    y0: preferredRange.min,
                    y1: preferredRange.max,
                    fillcolor: 'rgba(124, 58, 237, 0.15)', // Restore purple shading
                    line: { 
                        color: '#7c3aed',
                        width: 2,
                        dash: 'solid'
                    },
                    layer: 'below'
                });
            }
            
            // Add office hours shading for ALL charts with time period data
            if (xValues.some(x => x.includes(':'))) {
                // For hourly data, find 9am-5pm indices
                let startIndex = -1, endIndex = -1;
                for (let i = 0; i < xValues.length; i++) {
                    const timeLabel = xValues[i];
                    if (timeLabel.includes(':')) {
                        const hour = parseInt(timeLabel.split(':')[0]);
                        if (hour === 9 && startIndex === -1) startIndex = i;
                        if (hour === 17) endIndex = i;
                    }
                }
                
                if (startIndex >= 0 && endIndex >= 0) {
                    shapes.push({
                        type: 'rect',
                        xref: 'x',
                        x0: xValues[startIndex],
                        x1: xValues[endIndex],
                        yref: 'paper',
                        y0: 0,
                        y1: 1,
                        fillcolor: 'rgba(255, 193, 7, 0.12)', // Amber color for office hours
                        line: { 
                            color: 'rgba(255, 193, 7, 0.4)',
                            width: 2,
                            dash: 'dashdot'
                        },
                        layer: 'below'
                    });
                }
            } else if (xValues.length > 0) {
                // For period data (Early Morning, Morning, etc.), highlight Morning to Evening
                let morningIndex = -1, eveningIndex = -1;
                
                for (let i = 0; i < xValues.length; i++) {
                    const period = xValues[i].toLowerCase();
                    if (period.includes('morning') && !period.includes('early')) {
                        morningIndex = i;
                    }
                    if (period.includes('evening') && !period.includes('late')) {
                        eveningIndex = i;
                    }
                }
                
                if (morningIndex >= 0 && eveningIndex >= 0) {
                    shapes.push({
                        type: 'rect',
                        xref: 'x',
                        x0: morningIndex - 0.4, // Extend slightly to cover more of the period
                        x1: eveningIndex + 0.4,
                        yref: 'paper',
                        y0: 0,
                        y1: 1,
                        fillcolor: 'rgba(255, 193, 7, 0.15)', // Slightly more visible for period data
                        line: { 
                            color: 'rgba(255, 193, 7, 0.5)',
                            width: 2,
                            dash: 'dashdot'
                        },
                        layer: 'below'
                    });
                }
            }
            
            const layout = {
                xaxis: {
                    title: '',
                    showgrid: true,
                    gridcolor: 'rgba(156, 163, 175, 0.3)',
                    zeroline: false,
                    tickfont: { size: 12, color: '#374151', family: 'Inter, sans-serif', weight: 500 },
                    tickcolor: 'transparent'
                },
                yaxis: {
                    title: {
                        text: yTitle,
                        font: { size: 13, color: '#374151', family: 'Inter, sans-serif', weight: 600 }
                    },
                    showgrid: true,
                    gridcolor: 'rgba(156, 163, 175, 0.3)',
                    zeroline: false,
                    tickfont: { size: 11, color: '#374151', family: 'Inter, sans-serif', weight: 500 },
                    tickcolor: 'transparent',
                    range: yAxisRange // Set dynamic range based on actual data
                },
                plot_bgcolor: 'rgba(248, 250, 252, 0.5)',
                paper_bgcolor: 'transparent',
                margin: { l: 60, r: 20, t: 40, b: 50 },
                showlegend: additionalTraces.length > 0,
                legend: {
                    x: 0.5,
                    y: -0.15,
                    yanchor: 'top',
                    xanchor: 'center',
                    orientation: 'h',
                    font: { size: 10, family: 'Inter, sans-serif', weight: 500 }
                },
                hovermode: 'x unified',
                font: { family: 'Inter, sans-serif' },
                shapes: shapes,
                // Enhanced annotations for office hours - now for all charts with time data
                annotations: (() => {
                    const annotations = [];
                    
                    // Add office hours label at the top
                    if (xValues.some(x => x.includes(':')) || xValues.some(x => x.toLowerCase().includes('morning'))) {
                        annotations.push({
                            text: 'Office Hours (9AM-5PM)',
                            x: 0.5,
                            y: 1.02,
                            xref: 'paper',
                            yref: 'paper',
                            showarrow: false,
                            font: { 
                                size: 10, 
                                color: '#f59e0b', // Amber color to match shading
                                family: 'Inter, sans-serif',
                                weight: 600
                            },
                            bgcolor: 'rgba(255, 193, 7, 0.15)',
                            bordercolor: 'rgba(255, 193, 7, 0.4)',
                            borderwidth: 1,
                            borderpad: 4
                        });
                    }
                    
                    // Add x-axis range indicators for period data
                    if (!xValues.some(x => x.includes(':')) && xValues.length > 0) {
                        let morningIndex = -1, eveningIndex = -1;
                        
                        for (let i = 0; i < xValues.length; i++) {
                            const period = xValues[i].toLowerCase();
                            if (period.includes('morning') && !period.includes('early')) {
                                morningIndex = i;
                            }
                            if (period.includes('evening') && !period.includes('late')) {
                                eveningIndex = i;
                            }
                        }
                        
                        if (morningIndex >= 0) {
                            annotations.push({
                                text: '9AM',
                                x: morningIndex,
                                y: -0.12,
                                xref: 'x',
                                yref: 'paper',
                                showarrow: false,
                                font: { 
                                    size: 9, 
                                    color: '#f59e0b',
                                    family: 'Inter, sans-serif',
                                    weight: 600
                                },
                                bgcolor: 'rgba(255, 193, 7, 0.1)',
                                bordercolor: 'rgba(255, 193, 7, 0.3)',
                                borderwidth: 1,
                                borderpad: 2
                            });
                        }
                        
                        if (eveningIndex >= 0) {
                            annotations.push({
                                text: '5PM',
                                x: eveningIndex,
                                y: -0.12,
                                xref: 'x',
                                yref: 'paper',
                                showarrow: false,
                                font: { 
                                    size: 9, 
                                    color: '#f59e0b',
                                    family: 'Inter, sans-serif',
                                    weight: 600
                                },
                                bgcolor: 'rgba(255, 193, 7, 0.1)',
                                bordercolor: 'rgba(255, 193, 7, 0.3)',
                                borderwidth: 1,
                                borderpad: 2
                            });
                        }
                    }
                    
                    return annotations;
                })()
            };
            
            const config = {
                responsive: true,
                displayModeBar: false,
                displaylogo: false
            };
            
            Plotly.newPlot(divId, allTraces, layout, config);
            
            console.log(`[Chart Debug] Chart created successfully for ${divId}`);
            
        } catch (error) {
            console.error(`[Chart] Failed to create '${divId}':`, error);
            chartDiv.innerHTML = `
                <div class="no-data-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Chart rendering failed</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    // Generates a consolidated summary based on analyses of all parameters.
    function generateConsolidatedSummary(lightAnalysis, tempAnalysis, noiseAnalysis, userPrefs) {
        const analyses = [];
        
        if (userPrefs.light && lightAnalysis) {
            analyses.push({ 
                type: 'Light', 
                name: 'lighting conditions',
                ...lightAnalysis 
            });
        }
        if (userPrefs.temp && tempAnalysis) {
            analyses.push({ 
                type: 'Temperature', 
                name: 'temperature',
                ...tempAnalysis 
            });
        }
        if (userPrefs.noise && noiseAnalysis) {
            analyses.push({ 
                type: 'Noise', 
                name: 'noise levels',
                ...noiseAnalysis 
            });
        }
        
        if (analyses.length === 0) {
            return {
                title: "No preferences set",
                summary: "Showing general environmental conditions for this zone.",
                details: "Set your preferences in the quiz to see personalized suitability analysis."
            };
        }
        
        // Find the best performing parameter
        const bestPerformer = analyses.reduce((best, current) => {
            const currentPercentage = current.percentageOptimal || 0;
            const bestPercentage = best.percentageOptimal || 0;
            return currentPercentage > bestPercentage ? current : best;
        });

        const totalOptimalPercentage = Math.round(
            analyses.reduce((sum, a) => sum + (a.percentageOptimal || 0), 0) / analyses.length
        );
        
        let title, summary, details;
        
        if (totalOptimalPercentage >= 70) {
            title = "⚡ Good Match";
            summary = `${bestPerformer.name} is optimal for the longest periods.`;
            details = "Consider timing your work when conditions are optimal.";
        } else if (totalOptimalPercentage >= 40) {
            title = "⚡ Good Match";
            summary = `${bestPerformer.name} is optimal for the longest periods.`;
            details = `Consider timing your work when ${bestPerformer.name} ${bestPerformer.name.includes('levels') ? 'are' : 'is'} optimal.`;
        } else if (totalOptimalPercentage > 0) {
            title = "⏳ Partial Match";
            summary = `${bestPerformer.name} has the most optimal periods.`;
            details = "Limited optimal periods - consider alternative zones or adjust timing.";
        } else {
            title = "❌ Poor Match";
            summary = `None of your preferred conditions are consistently met.`;
            details = "Consider choosing a different zone or adjusting your preferences.";
        }
        
        return { title, summary, details };
    }

    // --- Section: 7. UI Interaction - Chart Focusing and Notifications ---
    // Purpose: Handles focusing on specific charts based on URL hash and provides user feedback.
    // AI: Add highlight and text overlay (This is for chart section highlighting, not map overlay)
    // AI Helped to do some complex functions of highlighting a chart *section* (based on the IEQ card selected in the zone-detail page) and scrolling for it, which is a UI enhancement.

    // Checks URL hash to focus on a specific chart section.
    function handleChartFocusing() {
    // Check if there's a hash in the URL to focus on specific chart
    const hash = window.location.hash.substring(1); 
    
    if (hash) {
        console.log("Found hash parameter:", hash);
        
        // Map hash values to chart container IDs - find the parent parameter-card
        const chartMapping = {
            'light': 'lightChart',
            'temperature': 'temperatureChart', 
            'noise': 'noiseChart'
        };
        
        const targetChartId = chartMapping[hash];
        
        if (targetChartId) {
            // Wait a bit for charts to render, then scroll and highlight
            setTimeout(() => {
                highlightAndScrollToChart(targetChartId, hash);
            }, 1500); // Give time for charts to load
        }
    }
}

function highlightAndScrollToChart(chartId, chartType) {
    const targetChart = document.getElementById(chartId);
    
    if (targetChart) {
        // Find the parent parameter-card container
        const targetSection = targetChart.closest('.parameter-card');
        
        if (targetSection) {
            console.log("Scrolling to and highlighting:", chartId);
            
            // Add highlighting class
            targetSection.classList.add('chart-section-highlighted');
            
            // Scroll to the section with smooth behavior
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Show a subtle notification
            showChartFocusNotification(chartType);
            
            // Remove highlighting after a few seconds
            setTimeout(() => {
                targetSection.classList.remove('chart-section-highlighted');
            }, 4000);
        } else {
            console.warn("Could not find parent parameter-card for chart:", chartId);
            // Fallback: just scroll to the chart itself
            targetChart.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            showChartFocusNotification(chartType);
        }
    } else {
        console.warn("Target chart not found:", chartId);
    }
}

function showChartFocusNotification(chartType) {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = 'chart-focus-notification';
    notification.innerHTML = `
        <i class="fas fa-chart-line"></i>
        Viewing ${chartType} forecast
    `;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    
    if (!document.getElementById('chart-focus-styles')) {
        const style = document.createElement('style');
        style.id = 'chart-focus-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            .chart-section-highlighted {
                animation: chartHighlight 3s ease-in-out;
                border-radius: 12px;
            }
            
            @keyframes chartHighlight {
                0%, 100% {
                    box-shadow: none;
                    background: transparent;
                }
                50% {
                    box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);
                    background: rgba(124, 58, 237, 0.05);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// --- Section: 8. Main Execution Logic ---
    // Purpose: Orchestrates data fetching, processing, and rendering of forecasts and summaries.
    // AI: Troubleshooting Application Loading Page Errors
    // This try...catch block is the primary handler for errors during the page load process.
    // Failures within this block will result in the forecast page not displaying data correctly.

    if (!zoneIdStr) {
        console.error("No zone ID provided in URL");
        ['lightChart', 'temperatureChart', 'noiseChart'].forEach(chartId => {
            const el = document.getElementById(chartId);
            if (el) {
                el.innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-map-marker-alt"></i>
                        <p>Zone ID missing from URL</p>
                        <small>Cannot load forecast data without a valid zone identifier</small>
                    </div>
                `;
            }
        });
        return;
    }

    console.log(`[Forecast] Starting data processing for Zone: ${zoneIdStr}`);
    
    try {
        // Load all CSV files
        const [lightCsvText, tempCsvText, noiseCsvText, feelsLikeCsvText] = await Promise.all([
            fetchCSV('samba_lights.csv'),
            fetchCSV('samba_TA.csv'),
            fetchCSV('samba_noise.csv'),
            fetchCSV('ta_Feels_Like_Temperature.csv')
        ]);

        const feelsLikeLookup = processFeelsLikeLookup(feelsLikeCsvText);

        // Get user preferences
        const userPrefs = {
            light: localStorage.getItem('lightingPreference'),
            temp: localStorage.getItem('temperaturePreference'),
            noise: localStorage.getItem('spaceUsagePreference')
        };

        let lightAnalysis, tempAnalysis, noiseAnalysis;

        // Process and display light data
        if (lightCsvText) {
            const lightDataZone = processLightDataForZone(lightCsvText, zoneIdStr);
            const lightUserPrefEl = document.getElementById('lightUserPref');
            const lightPref = userPrefs.light;
            let lightRange;

            if (lightPref && lightingThresholds[lightPref]) {
                lightRange = lightingThresholds[lightPref];
                if (lightUserPrefEl) {
                    lightUserPrefEl.innerHTML = `
                        <div class="preference-indicator">🎯 Your preference: ${preferenceDisplayMap[lightPref]?.text || lightPref}</div>
                    `;
                    lightUserPrefEl.style.display = 'block';
                }
            } else if (lightUserPrefEl) {
                lightUserPrefEl.innerHTML = '<div class="preference-indicator">No light preference set</div>';
                lightUserPrefEl.style.display = 'block';
            }
            
            if (lightDataZone && lightDataZone.x && lightDataZone.x.length > 0) {
                lightAnalysis = analyzePreferredRangePeriods(lightDataZone.x, lightDataZone.y, lightRange, 'Light');
                
                // Generate and display smart insights
                const insights = generateSmartInsights(lightDataZone.x, lightDataZone.y, lightRange, 'Light');
                const lightAnalysisSummaryEl = document.getElementById('lightAnalysisSummary');
                if (lightAnalysisSummaryEl) {
                    lightAnalysisSummaryEl.innerHTML = `
                        <div class="chart-insight-main">${insights.mainInsight}</div>
                        ${insights.subInsight ? `<div class="chart-insight-sub">${insights.subInsight}</div>` : ''}
                    `;
                }
                
                createEnhancedChart('lightChart', lightDataZone.x, lightDataZone.y, 'Light Level (lux)', lightRange, '#7c3aed', ' lux', [], 'Light');
            } else {
                document.getElementById('lightChart').innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-lightbulb"></i>
                        <p>Light data not available for Zone ${zoneIdStr}</p>
                        <small>This zone may not have light sensors or data collection</small>
                    </div>
                `;
            }
        }

        // Process and display temperature data
        if (tempCsvText) {
            const tempDataZone = processZoneRowHourlyData(tempCsvText, zoneIdStr, 'Temperature');
            const tempUserPrefEl = document.getElementById('tempUserPref');
            const tempPref = userPrefs.temp;
            let tempRange;

            if (tempPref && temperatureThresholds[tempPref]) {
                tempRange = temperatureThresholds[tempPref];
                if (tempUserPrefEl) {
                    tempUserPrefEl.innerHTML = `
                        <div class="preference-indicator">🎯 Your preference: ${preferenceDisplayMap[tempPref]?.text || tempPref}</div>
                    `;
                    tempUserPrefEl.style.display = 'block';
                }
            } else if (tempUserPrefEl) {
                tempUserPrefEl.innerHTML = '<div class="preference-indicator">No temperature preference set</div>';
                tempUserPrefEl.style.display = 'block';
            }

            if (tempDataZone && tempDataZone.x && tempDataZone.x.length > 0) {
                tempAnalysis = analyzePreferredRangePeriods(tempDataZone.x, tempDataZone.y, tempRange, 'Temperature');
                
                // Generate and display smart insights
                const insights = generateSmartInsights(tempDataZone.x, tempDataZone.y, tempRange, 'Temperature');
                const tempAnalysisSummaryEl = document.getElementById('tempAnalysisSummary');
                if (tempAnalysisSummaryEl) {
                    tempAnalysisSummaryEl.innerHTML = `
                        <div class="chart-insight-main">${insights.mainInsight}</div>
                        ${insights.subInsight ? `<div class="chart-insight-sub">${insights.subInsight}</div>` : ''}
                    `;
                }
                
                const feelsLikeDataY = tempDataZone.y.map(tVal => 
                    getFeelsLikeTemperature(tVal, feelsLikeLookup)
                );

                // Create feels-like trace with simplified hover and FIXED 2 decimal places
                const feelsLikeTrace = {
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                        color: '#1f40b3', // Darker blue for better contrast
                        width: 3,
                        shape: 'spline',
                        dash: 'dot'
                    },
                    name: 'Feels Like',
                    hovertemplate: 'Feels Like: %{y:.2f}°C<extra></extra>', // FIXED: 2 decimal places
                    x: tempDataZone.x,
                    y: feelsLikeDataY,
                    opacity: 0.9,
                    showlegend: true
                };
                
                createEnhancedChart('temperatureChart', tempDataZone.x, tempDataZone.y, 'Temperature (°C)', tempRange, '#7c3aed', '°C', [feelsLikeTrace], 'Temperature');
            } else {
                document.getElementById('temperatureChart').innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-thermometer-half"></i>
                        <p>Temperature data not available for Zone ${zoneIdStr}</p>
                        <small>This zone may not have temperature sensors or data collection</small>
                    </div>
                `;
            }
        }

        // Process and display noise data
        if (noiseCsvText) {
            const noiseDataZone = processZoneColumnHourlyData(noiseCsvText, zoneIdStr, 'Noise');
            const noiseUserPrefEl = document.getElementById('noiseUserPref');
            const noisePref = userPrefs.noise;
            let noiseRange;

            if (noisePref && noiseWorkTypeThresholds[noisePref]) {
                noiseRange = noiseWorkTypeThresholds[noisePref];
                if (noiseUserPrefEl) {
                    noiseUserPrefEl.innerHTML = `
                        <div class="preference-indicator">🎯 Your preference: ${preferenceDisplayMap[noisePref]?.text || noisePref}</div>
                    `;
                    noiseUserPrefEl.style.display = 'block';
                }
            } else if (noiseUserPrefEl) {
                noiseUserPrefEl.innerHTML = '<div class="preference-indicator">No noise/space preference set</div>';
                noiseUserPrefEl.style.display = 'block';
            }
            
            if (noiseDataZone && noiseDataZone.x && noiseDataZone.x.length > 0) {
                noiseAnalysis = analyzePreferredRangePeriods(noiseDataZone.x, noiseDataZone.y, noiseRange, 'Noise');
                
                // Generate and display smart insights
                const insights = generateSmartInsights(noiseDataZone.x, noiseDataZone.y, noiseRange, 'Noise');
                const noiseAnalysisSummaryEl = document.getElementById('noiseAnalysisSummary');
                if (noiseAnalysisSummaryEl) {
                    noiseAnalysisSummaryEl.innerHTML = `
                        <div class="chart-insight-main">${insights.mainInsight}</div>
                        ${insights.subInsight ? `<div class="chart-insight-sub">${insights.subInsight}</div>` : ''}
                    `;
                }
                
                createEnhancedChart('noiseChart', noiseDataZone.x, noiseDataZone.y, 'Noise Level (dB)', noiseRange, '#7c3aed', ' dB', [], 'Noise');
            } else {
                document.getElementById('noiseChart').innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-volume-up"></i>
                        <p>Noise data not available for Zone ${zoneIdStr}</p>
                        <small>This zone may not have noise sensors or data collection</small>
                    </div>
                `;
            }
        }

        // Generate and display enhanced consolidated summary
        const consolidatedData = generateConsolidatedSummary(lightAnalysis, tempAnalysis, noiseAnalysis, userPrefs);
        const consolidatedSummaryEl = document.getElementById('consolidatedSummaryContent');
        if (consolidatedSummaryEl) {
            consolidatedSummaryEl.innerHTML = `
                <div class="consolidated-summary">
                    <h3>${consolidatedData.title}</h3>
                    <p class="summary-text">${consolidatedData.summary}</p>
                    <p class="summary-details">${consolidatedData.details}</p>
                </div>
            `;
        }

        console.log(`[Forecast] Data processing completed successfully for Zone: ${zoneIdStr}`);

    } catch (error) {
        // AI helping to debug: Troubleshooting Application Loading Page Errors - Catch-all for major processing failures.
        console.error("[Forecast] Critical error during data processing:", error);
        
        ['lightChart', 'temperatureChart', 'noiseChart'].forEach(chartId => {
            const el = document.getElementById(chartId);
            if (el) {
                el.innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load forecast data</p>
                        <small>Error: ${error.message}</small>
                    </div>
                `;
            }
        });
    }
    
    // --- Section: 9. Mobile Menu Toggle ( specific to this page) ---
    // Purpose: Handles the mobile navigation menu toggle.
    
    const mobileMenuToggleForecast = document.getElementById('mobileMenuToggle');
    const fybsNavMenuElForecast = document.getElementById('navMenu');
    const fybsHamburgerIconElForecast = mobileMenuToggleForecast ? 
        mobileMenuToggleForecast.querySelector('.fybs-hamburger') : null;
    
    let genOverlayForecast = document.querySelector('.overlay'); 
    if (!genOverlayForecast && mobileMenuToggleForecast) { 
        genOverlayForecast = document.createElement('div');
        genOverlayForecast.classList.add('overlay');
        document.body.appendChild(genOverlayForecast);
        
        genOverlayForecast.addEventListener('click', () => { 
            if (fybsNavMenuElForecast && fybsNavMenuElForecast.classList.contains('active')) {
                fybsNavMenuElForecast.classList.remove('active');
                if (fybsHamburgerIconElForecast) fybsHamburgerIconElForecast.classList.remove('active');
                genOverlayForecast.classList.remove('visible');
                document.body.classList.remove('menu-active');
            }
        });
    }
    
    if (mobileMenuToggleForecast && fybsNavMenuElForecast && fybsHamburgerIconElForecast) {
        mobileMenuToggleForecast.addEventListener('click', function(event) {
            event.stopPropagation();
            fybsNavMenuElForecast.classList.toggle('active');
            fybsHamburgerIconElForecast.classList.toggle('active');
            const isFybsMenuNowOpen = fybsNavMenuElForecast.classList.contains('active');
            if (genOverlayForecast) genOverlayForecast.classList.toggle('visible', isFybsMenuNowOpen);
            document.body.classList.toggle('menu-active', isFybsMenuNowOpen);
        });
    }

    
    handleChartFocusing();
});
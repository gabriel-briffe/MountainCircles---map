/**
 * OpenAIP Airspace Data Processor - JavaScript Edition
 * 
 * Processes OpenAir format airspace data and converts it to GeoJSON
 * This is a client-side JavaScript port of the Python processing pipeline
 */

class OpenAipProcessor {
    constructor() {
        this.altitudePrintCount = 0;
    }

    /**
     * Main processing function - processes OpenAir text content and returns GeoJSON
     * @param {string} openairContent - The OpenAir file content as a string
     * @param {Object} options - Processing options
     * @returns {Object} GeoJSON FeatureCollection
     */
    processOpenAir(openairContent, options = {}) {
        console.log('Starting OpenAIP processing...');
        
        // Parse OpenAir to intermediate JSON format
        const features = this.parseOpenAirContent(openairContent);
        console.log(`Parsed ${features.length} features from OpenAir content`);
        
        // Apply filtering if needed
        const filteredFeatures = this.applyFiltering(features, options);
        console.log(`${filteredFeatures.length} features after filtering`);
        
        // Convert to GeoJSON
        const geoJsonFeatures = filteredFeatures.map(feature => this.convertFeature(feature));
        
        // Remove null features and apply type remapping, then add sequential IDs
        const validFeatures = geoJsonFeatures
            .filter(f => f !== null)
            .map(feature => this.remapTypeField(feature))
            .map((feature, index) => {
                // Always set AI field with sequential ID to ensure no duplicates
                feature.properties.AI = index.toString();
                return feature;
            });


        const geojson = {
            type: "FeatureCollection",
            features: validFeatures
        };
        
        console.log(`Generated GeoJSON with ${validFeatures.length} features`);
        return geojson;
    }

    /**
     * Check if a line is a comment or empty
     */
    isCommentOrEmpty(line) {
        const trimmed = line.trim();
        return !trimmed || trimmed.startsWith('*');
    }

    /**
     * Extract command and content from a line
     */
    extractCommand(line) {
        // Remove comments
        if (line.includes('*')) {
            line = line.split('*')[0];
        }
        line = line.trim();
        if (!line) {
            return ['', ''];
        }
        const parts = line.split(' ');
        const command = parts[0].trim();
        const content = parts.slice(1).join(' ').trim();
        return [command, content];
    }

    /**
     * Format coordinate string to canonical format
     */
    formatCoordinateStr(coordStr) {
        const pattern = /^\s*(\d{1,3}):(\d{1,2}):(\d{1,2})\s*([NS])\s+(\d{1,3}):(\d{1,2}):(\d{1,2})\s*([EW])\s*$/;
        const match = coordStr.match(pattern);
        if (!match) {
            return coordStr.split(/\s+/).join(' ');
        }
        
        try {
            const latDeg = parseInt(match[1]);
            const latMin = parseInt(match[2]);
            const latSec = parseInt(match[3]);
            const latDir = match[4];
            const lonDeg = parseInt(match[5]);
            const lonMin = parseInt(match[6]);
            const lonSec = parseInt(match[7]);
            const lonDir = match[8];
            
            const formattedLat = `${latDeg.toString().padStart(2, '0')}:${latMin.toString().padStart(2, '0')}:${latSec.toString().padStart(2, '0')} ${latDir}`;
            const formattedLon = `${lonDeg.toString().padStart(3, '0')}:${lonMin.toString().padStart(2, '0')}:${lonSec.toString().padStart(2, '0')} ${lonDir}`;
            return formattedLat + " " + formattedLon;
        } catch (e) {
            return coordStr.split(/\s+/).join(' ');
        }
    }

    /**
     * Parse coordinate string in DMS format and return [lon, lat] in decimal degrees
     */
    parseCoordinate(coordStr) {
        const pattern = /^\s*(\d{1,3}):(\d{1,2}):(\d{1,2})\s*([NS])\s+(\d{1,3}):(\d{1,2}):(\d{1,2})\s*([EW])\s*$/;
        const match = coordStr.match(pattern);
        if (!match) {
            return null;
        }
        
        try {
            const latDeg = parseInt(match[1]);
            const latMin = parseInt(match[2]);
            const latSec = parseInt(match[3]);
            const latDir = match[4];
            const lonDeg = parseInt(match[5]);
            const lonMin = parseInt(match[6]);
            const lonSec = parseInt(match[7]);
            const lonDir = match[8];
            
            let lat = latDeg + latMin/60 + latSec/3600;
            let lon = lonDeg + lonMin/60 + lonSec/3600;
            
            if (latDir.toUpperCase() === 'S') {
                lat = -lat;
            }
            if (lonDir.toUpperCase() === 'W') {
                lon = -lon;
            }
            
            return [lon, lat]; // GeoJSON style [longitude, latitude]
        } catch (e) {
            return null;
        }
    }

    /**
     * Parse OpenAir content into features
     */
    parseOpenAirContent(content) {
        const features = [];
        let currentFeature = null;
        let currentCenter = null;
        let currentDirection = "+";

        const lines = content.split('\n');

        const finalizeFeature = (feature) => {
            const props = feature.properties || {};
            if (props.AC && props.AC !== "UNC") {
                props.type = props.AC;
            } else if (props.AY) {
                props.type = props.AY;
                if (props.type === "OVERFLIGHT_RESTRICTION") {
                    props.type = "PROHIBITED";
                }
            }
        };

        for (const line of lines) {
            if (this.isCommentOrEmpty(line)) {
                continue;
            }

            const [command, content] = this.extractCommand(line);

            // Handle A-commands (AC, AN, AH, AL, AY, AF, AG)
            if (command.startsWith('A')) {
                if (command === 'AC') {
                    if (currentFeature) {
                        finalizeFeature(currentFeature);
                        features.push(currentFeature);
                    }
                    currentFeature = { properties: {}, geometry: [] };
                    currentDirection = "+"; // reset direction for new feature
                }
                
                if (currentFeature !== null) {
                    if (command === "AH" || command === "AL") {
                        let altContent = content.trim().toUpperCase();
                        
                        // Apply altitude formatting rules
                        altContent = altContent.replace(/AMSL/g, "MSL");
                        altContent = altContent.replace(/AGL/g, "GND");
                        altContent = altContent.replace(/SFC/g, "GND");
                        altContent = altContent.replace(/ FT/g, "FT");
                        altContent = altContent.replace(/ M/g, "M");
                        altContent = altContent.replace(/FTMSL/g, "FT MSL");
                        altContent = altContent.replace(/MMSL/g, "M MSL");
                        altContent = altContent.replace(/FTGND/g, "FT GND");
                        altContent = altContent.replace(/MGND/g, "M GND");
                        altContent = altContent.replace(/^FL /, "FL");
                        
                        // Remove leading zeros from flight level values
                        if (altContent.startsWith("FL")) {
                            const flValue = altContent.slice(2);
                            const flNum = parseInt(flValue);
                            if (!isNaN(flNum)) {
                                altContent = "FL" + flNum.toString();
                            }
                        }
                        
                        // Format altitude
                        let formattedAltitude;
                        if (altContent === "GND" || 
                            /^\d+(FT|M)\s+MSL$/.test(altContent) || 
                            /^\d+(FT|M)\s+GND$/.test(altContent) || 
                            /^FL\d+$/.test(altContent)) {
                            formattedAltitude = altContent;
                        } else if (/^\d+(FT|M)/.test(altContent)) {
                            formattedAltitude = altContent + " GND";
                        } else {
                            formattedAltitude = altContent;
                            if (this.altitudePrintCount < 10) {
                                console.log(`Encountered ${command}: ${formattedAltitude}`);
                                this.altitudePrintCount++;
                            }
                        }
                        
                        currentFeature.properties[command] = formattedAltitude;
                    } else {
                        currentFeature.properties[command] = content.toUpperCase();
                    }
                }
            }
            // Handle V-commands (center and direction)
            else if (command.startsWith('V')) {
                if (content.trim().startsWith('X=')) {
                    const coordVal = content.split('=')[1].trim();
                    const formatted = this.formatCoordinateStr(coordVal);
                    currentCenter = this.parseCoordinate(formatted);
                    if (currentFeature !== null) {
                        currentFeature.properties["V X"] = formatted.toUpperCase();
                    }
                } else if (content.trim().startsWith('D=')) {
                    currentDirection = content.split('=')[1].trim();
                    if (currentFeature !== null) {
                        currentFeature.properties["V D"] = currentDirection;
                    }
                }
            }
            // Handle geometry commands (DP, DC, DA, DB)
            else if (['DP', 'DC', 'DA', 'DB'].includes(command)) {
                if (currentFeature === null) {
                    continue;
                }
                
                if (command === 'DP') {
                    // DP: polygon point
                    const coord = this.parseCoordinate(content);
                    if (coord) {
                        currentFeature.geometry.push({
                            type: "point",
                            coordinates: coord
                        });
                    }
                } else if (command === 'DC') {
                    // DC: circle
                    const radius = parseFloat(content.trim());
                    if (!isNaN(radius)) {
                        currentFeature.geometry.push({
                            type: "circle",
                            radius: radius,
                            center: currentCenter
                        });
                    }
                } else if (command === 'DA') {
                    // DA: arc
                    const parts = content.split(',').map(p => p.trim());
                    if (parts.length === 3) {
                        const radius = parseFloat(parts[0]);
                        const startAngle = parseFloat(parts[1]);
                        const endAngle = parseFloat(parts[2]);
                        
                        if (!isNaN(radius) && !isNaN(startAngle) && !isNaN(endAngle)) {
                            currentFeature.geometry.push({
                                type: "arc",
                                radius: radius,
                                start_angle: startAngle,
                                end_angle: endAngle,
                                center: currentCenter,
                                direction: currentDirection
                            });
                        }
                    }
                } else if (command === 'DB') {
                    // DB: arc by points
                    const coords = content.split(',').map(c => c.trim());
                    if (coords.length === 2) {
                        const p1 = this.parseCoordinate(coords[0]);
                        const p2 = this.parseCoordinate(coords[1]);
                        if (p1 && p2) {
                            currentFeature.geometry.push({
                                type: "arc_by_points",
                                start_point: p1,
                                end_point: p2,
                                center: currentCenter,
                                direction: currentDirection
                            });
                        }
                    }
                }
            }
        }

        // Add the last feature
        if (currentFeature) {
            finalizeFeature(currentFeature);
            features.push(currentFeature);
        }

        return features;
    }

    /**
     * Apply filtering rules to features
     */
    applyFiltering(features, options = {}) {
        const { enableFiltering = true, keepFirSector = false } = options;
        
        if (!enableFiltering) {
            return features;
        }

        return features.filter(feature => {
            const properties = feature.properties || {};
            
            // Rule 1: Skip features with AY=FIR unless specifically requested
            if (!keepFirSector && properties.AY && properties.AY.includes("FIR")) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * Convert a circle to polygon coordinates
     */
    circleToPolygon(center, radius) {
        if (!center || radius == null) {
            return null;
        }
        
        const [lonCenter, latCenter] = center;
        // 1 NM is approximately 1/60 degree of latitude
        const rDegLat = radius / 60;
        // Adjust for longitude: degrees per NM at given latitude
        const rDegLon = Math.cos(latCenter * Math.PI / 180) !== 0 ? 
            rDegLat / Math.cos(latCenter * Math.PI / 180) : 0;
        
        const numSegments = Math.max(36, Math.floor(radius * 36));
        const points = [];
        
        for (let i = 0; i < numSegments; i++) {
            const angleDeg = 360 / numSegments * i;
            const angleRad = angleDeg * Math.PI / 180;
            const lon = lonCenter + rDegLon * Math.cos(angleRad);
            const lat = latCenter + rDegLat * Math.sin(angleRad);
            points.push([lon, lat]);
        }
        
        points.push(points[0]); // close the polygon
        return points;
    }

    /**
     * Process an arc geometry
     */
    processArc(arcGeom) {
        const { start_angle, end_angle, center, radius, direction = "+" } = arcGeom;
        
        if (start_angle == null || end_angle == null || !center || radius == null) {
            return [];
        }

        // Convert radius from nautical miles to an angular distance in radians
        const dRad = (radius / 60.0) * Math.PI / 180;

        const [centerLon, centerLat] = center;
        const centerLatRad = centerLat * Math.PI / 180;
        const centerLonRad = centerLon * Math.PI / 180;

        // Compute the start point using the destination point formula
        const startBearingRad = start_angle * Math.PI / 180;
        const startLatRad = Math.asin(
            Math.sin(centerLatRad) * Math.cos(dRad) +
            Math.cos(centerLatRad) * Math.sin(dRad) * Math.cos(startBearingRad)
        );
        const startLonRad = centerLonRad + Math.atan2(
            Math.sin(startBearingRad) * Math.sin(dRad) * Math.cos(centerLatRad),
            Math.cos(dRad) - Math.sin(centerLatRad) * Math.sin(startLatRad)
        );
        const startPoint = [startLonRad * 180 / Math.PI, startLatRad * 180 / Math.PI];

        // Compute the end point using the destination point formula
        const endBearingRad = end_angle * Math.PI / 180;
        const endLatRad = Math.asin(
            Math.sin(centerLatRad) * Math.cos(dRad) +
            Math.cos(centerLatRad) * Math.sin(dRad) * Math.cos(endBearingRad)
        );
        const endLonRad = centerLonRad + Math.atan2(
            Math.sin(endBearingRad) * Math.sin(dRad) * Math.cos(centerLatRad),
            Math.cos(dRad) - Math.sin(centerLatRad) * Math.sin(endLatRad)
        );
        const endPoint = [endLonRad * 180 / Math.PI, endLatRad * 180 / Math.PI];

        // Build an arc_by_points geometry and call the corresponding function
        const arcByPointsGeom = {
            start_point: startPoint,
            end_point: endPoint,
            center: center,
            direction: direction
        };

        return this.processArcByPoints(arcByPointsGeom);
    }

    /**
     * Process an arc by points geometry
     */
    processArcByPoints(arcByPointsGeom) {
        const { start_point, end_point, center, direction = "+" } = arcByPointsGeom;

        if (!start_point || !end_point || !center) {
            return [];
        }

        const [centerLon, centerLat] = center;
        const [startLon, startLat] = start_point;
        const [endLon, endLat] = end_point;

        // Convert degrees to radians
        const centerLatRad = centerLat * Math.PI / 180;
        const centerLonRad = centerLon * Math.PI / 180;
        const startLatRad = startLat * Math.PI / 180;
        const startLonRad = startLon * Math.PI / 180;
        const endLatRad = endLat * Math.PI / 180;
        const endLonRad = endLon * Math.PI / 180;

        // Compute angular radius from center to start_point (in radians) using spherical law of cosines
        const radius = Math.acos(
            Math.sin(centerLatRad) * Math.sin(startLatRad) +
            Math.cos(centerLatRad) * Math.cos(startLatRad) * Math.cos(startLonRad - centerLonRad)
        );

        // Helper function to compute bearing from center to a given point
        const bearingFromCenter = (pt) => {
            const [ptLon, ptLat] = pt;
            const ptLatRad = ptLat * Math.PI / 180;
            const ptLonRad = ptLon * Math.PI / 180;
            const dlon = ptLonRad - centerLonRad;
            const y = Math.sin(dlon) * Math.cos(ptLatRad);
            const x = Math.cos(centerLatRad) * Math.sin(ptLatRad) - 
                     Math.sin(centerLatRad) * Math.cos(ptLatRad) * Math.cos(dlon);
            let b = Math.atan2(y, x);
            if (b < 0) {
                b += 2 * Math.PI;
            }
            return b;
        };

        const startBearing = bearingFromCenter(start_point);
        const endBearing = bearingFromCenter(end_point);

        let deltaAngle = endBearing - startBearing;
        // Adjust delta_angle based on direction: '+' means clockwise, '-' anticlockwise
        if (direction === "+") {
            if (deltaAngle < 0) {
                deltaAngle += 2 * Math.PI;
            }
        } else {
            if (deltaAngle > 0) {
                deltaAngle -= 2 * Math.PI;
            }
        }

        // Determine number of segments for the arc (excluding the endpoints)
        const numSegments = Math.max(2, Math.floor(Math.abs(deltaAngle) / (5 * Math.PI / 180)));
        const arcPoints = [];

        // Compute intermediate points along the arc (excluding start and end points)
        for (let i = 1; i < numSegments; i++) {
            const t = i / numSegments;
            let bearing = startBearing + t * deltaAngle;
            if (bearing < 0) {
                bearing += 2 * Math.PI;
            } else if (bearing > 2 * Math.PI) {
                bearing -= 2 * Math.PI;
            }

            const latRad = Math.asin(
                Math.sin(centerLatRad) * Math.cos(radius) +
                Math.cos(centerLatRad) * Math.sin(radius) * Math.cos(bearing)
            );
            let lonRad = centerLonRad + Math.atan2(
                Math.sin(bearing) * Math.sin(radius) * Math.cos(centerLatRad),
                Math.cos(radius) - Math.sin(centerLatRad) * Math.sin(latRad)
            );
            lonRad = ((lonRad + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
            
            const latPoint = latRad * 180 / Math.PI;
            const lonPoint = lonRad * 180 / Math.PI;
            arcPoints.push([lonPoint, latPoint]);
        }

        // Include the official start and end points in the arc
        return [start_point, ...arcPoints, end_point];
    }

    /**
     * Convert geometry to GeoJSON format
     */
    convertGeometry(geom) {
        const geomType = geom.type;
        
        if (geomType === "point") {
            return {
                type: "Point",
                coordinates: geom.coordinates
            };
        } else if (geomType === "circle") {
            const polygon = this.circleToPolygon(geom.center, geom.radius);
            if (polygon) {
                return {
                    type: "Polygon",
                    coordinates: [polygon]
                };
            }
        } else if (geomType === "arc") {
            const coords = this.processArc(geom);
            if (coords.length > 0) {
                return {
                    type: "LineString",
                    coordinates: coords
                };
            }
        } else if (geomType === "arc_by_points") {
            const coords = this.processArcByPoints(geom);
            if (coords.length > 0) {
                return {
                    type: "LineString",
                    coordinates: coords
                };
            }
        }
        
        return null;
    }

    /**
     * Convert altitude string to meters
     */
    convertAltitudeToMeters(altitudeStr) {
        if (!altitudeStr) {
            return null;
        }
        
        const alt = altitudeStr.toUpperCase().trim();
        
        // Handle Flight Levels (FL)
        if (alt.startsWith('FL')) {
            const flValue = parseFloat(alt.slice(2));
            if (!isNaN(flValue)) {
                return flValue * 100 * 0.3048; // FL * 100 feet to meters
            }
            return null;
        }
        
        // Handle feet (FT)
        const ftMatch = alt.match(/^(\d+(?:\.\d+)?)FT/);
        if (ftMatch) {
            const ftValue = parseFloat(ftMatch[1]);
            if (!isNaN(ftValue)) {
                return ftValue * 0.3048; // feet to meters
            }
        }
        
        // Handle meters (M)
        const mMatch = alt.match(/^(\d+(?:\.\d+)?)M/);
        if (mMatch) {
            const mValue = parseFloat(mMatch[1]);
            if (!isNaN(mValue)) {
                return mValue;
            }
        }
        
        // Handle GND (ground)
        if (alt === 'GND') {
            return 0;
        }
        
        return null;
    }

    /**
     * Remap type field values according to standardized naming conventions
     */
    remapTypeField(feature) {
        const properties = feature.properties || {};
        if (properties.type) {
            const typeValue = properties.type;
            
            // Define the remapping rules
            const typeMapping = {
                "P": "PROHIBITED",
                "R": "RESTRICTED", 
                "Q": "DANGER",
                "ASRA": "ACTIVITY",
                "OFR": "PROHIBITED",
                "GSEC": "GLIDING_SECTOR"
            };
            
            // Apply remapping if the type value exists in our mapping
            if (typeMapping[typeValue]) {
                properties.type = typeMapping[typeValue];
            }
        }
        
        return feature;
    }


    /**
     * Convert feature to GeoJSON format
     */
    convertFeature(feature) {
        const geometries = feature.geometry || [];
        const properties = feature.properties || {};
        
        // Convert altitude limits to meters
        const ahValue = properties.AH;
        const alValue = properties.AL;
        
        const upperLimitMeters = this.convertAltitudeToMeters(ahValue);
        const lowerLimitMeters = this.convertAltitudeToMeters(alValue);
        
        // If there is exactly one geometry and it is not a point, use it directly
        if (geometries.length === 1) {
            const g = geometries[0];
            const converted = this.convertGeometry(g);
            if (converted && converted.type !== "Point") {
                return {
                    type: "Feature",
                    properties: {
                        ...properties,
                        upperLimitMeters: upperLimitMeters,
                        lowerLimitMeters: lowerLimitMeters
                    },
                    geometry: converted
                };
            }
        }
        
        // Otherwise, combine all coordinates from geometries (points and LineStrings) for a polygon
        const coords = [];
        for (const geom of geometries) {
            const converted = this.convertGeometry(geom);
            if (!converted) {
                continue;
            }
            
            const typ = converted.type;
            if (typ === "Point") {
                coords.push(converted.coordinates);
            } else if (typ === "LineString") {
                // For LineString (arc_by_points) the returned coordinates are intermediate points
                coords.push(...converted.coordinates);
            } else if (typ === "Polygon") {
                // If a polygon is encountered (e.g., from a circle), use it directly
                coords.push(...converted.coordinates[0]);
                break;
            }
        }
        
        let finalGeom;
        if (coords.length >= 3) {
            if (!this.coordsEqual(coords[0], coords[coords.length - 1])) {
                coords.push(coords[0]);
            }
            finalGeom = {
                type: "Polygon",
                coordinates: [coords]
            };
        } else if (coords.length > 0) {
            finalGeom = {
                type: "MultiPoint",
                coordinates: coords
            };
        } else {
            finalGeom = null;
        }
        
        if (!finalGeom) {
            return null;
        }
        
        return {
            type: "Feature",
            properties: {
                ...properties,
                upperLimitMeters: upperLimitMeters,
                lowerLimitMeters: lowerLimitMeters
            },
            geometry: finalGeom
        };
    }

    /**
     * Check if two coordinates are equal
     */
    coordsEqual(coord1, coord2) {
        if (!coord1 || !coord2) return false;
        return Math.abs(coord1[0] - coord2[0]) < 1e-10 && Math.abs(coord1[1] - coord2[1]) < 1e-10;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = OpenAipProcessor;
} else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function() {
        return OpenAipProcessor;
    });
} else {
    // Browser global
    window.OpenAipProcessor = OpenAipProcessor;
}

/**
 * Convenience function for direct usage
 * @param {string} openairContent - The OpenAir file content as a string
 * @param {Object} options - Processing options
 * @returns {Object} GeoJSON FeatureCollection
 */
function processOpenAip(openairContent, options = {}) {
    const processor = new OpenAipProcessor();
    return processor.processOpenAir(openairContent, options);
}

// Export convenience function too
if (typeof module !== 'undefined' && module.exports) {
    module.exports.processOpenAip = processOpenAip;
} else {
    window.processOpenAip = processOpenAip;
}
// Define flags
let stopRefresh = false;
let shareLocation = false;
let allBusesMarkers = new Map();
let allStopsMarkers = null;
let allLinesData = [];
let allStopsData = [];
let allVehiclesData = [];

// Initialize the map with a default location and zoom level
const map = L.map('map').setView([0, 0], 1);

// Create marker icon for the bus with different colors
var busIcon = L.icon({
    iconUrl: 'img/bus.png',
    iconSize: [40, 40]
});

// Create smaller bus icon for all buses view
var smallBusIcon = L.icon({
    iconUrl: 'img/bus.png',
    iconSize: [24, 24]
});

// Create marker icon for stops
var stopPinIcon = L.icon({
    iconUrl: 'img/pin.png',
    iconSize: [24, 24]
});

// Add a marker to the map at the given location and use a costum icon
const marker = L.marker([0, 0], {icon: busIcon}).addTo(map);

// Define the API endpoint URL
// Use URL Path: ?bus=5&way=tour
const urlParams = new URLSearchParams(window.location.search);
const mapZoom = 15;
const busNumber = urlParams.get('bus');
const busDirection = urlParams.get('way');
const baseURL = 'http://86.127.97.204:8080'
const url = baseURL + '/TripPlanner/service/vehicles/line/' + busNumber + '/direction/' + busDirection;
var busLinesColor = ['red', 'blue', 'green'];
var globalVariant = [];

// Add a tile layer to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    maxZoom: mapZoom,
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// Call fetchLines() to populate with all the Bus routes buttons
fetchLines();

try {
    // Try to call setInitialView() to set the initial zoom level and center map
    setInitialView();
    autoRefresh();
    grabVariant();
} catch (error) {
    console.log(error);
}

// Use the fitBounds method to set the initial zoom level and center the map view on the initial point
function setInitialView() {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Set initial location in the base city
            const lat = 45.79;
            const lng = 24.13;

            // Set the initial view of the map
            const bounds = [
                [lat, lng]
            ];
            map.fitBounds(bounds, {
                padding: [50, 50]
            });
        })
        .catch(error => console.error(error));
}
var busMarkers = new Map();

function updateMap() {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.vehiclesByLineAndDirection && data.vehiclesByLineAndDirection.length > 0) {
                // Clear old markers that are no longer present
                const currentVehicleIds = new Set(data.vehiclesByLineAndDirection.map(vehicle => vehicle.id));
                for (const [vehicleId, marker] of busMarkers) {
                    if (!currentVehicleIds.has(vehicleId)) {
                        map.removeLayer(marker);
                        busMarkers.delete(vehicleId);
                    }
                }

                data.vehiclesByLineAndDirection.forEach(vehicle => {
                    const lat = vehicle.lat / 1000000;
                    const lng = vehicle.lng / 1000000;
                    
                    // Get punctuality and loading info
                    const punctuality = vehicle.punctuality;
                    let statusText = 'On time';
                    let statusColor = 'green';
                    
                    if (punctuality > 300) {
                        statusText = `${Math.round(punctuality/60)} min late`;
                        statusColor = 'red';
                    } else if (punctuality < -300) {
                        statusText = `${Math.round(Math.abs(punctuality)/60)} min early`;
                        statusColor = 'blue';
                    }
                    
                    const loadingDegree = vehicle.loadingDegree;
                    const loadingText = ['🟢 Empty', '🟡 Normal', '🟠 Crowded', '🔴 Full'][loadingDegree] || 'Unknown';
                    
                    if (busMarkers.has(vehicle.id)) {
                        // Update existing marker position
                        busMarkers.get(vehicle.id).setLatLng([lat, lng]);
                    } else {
                        const newMarker = L.marker([lat, lng], {icon: busIcon})
                            .addTo(map)
                            .bindPopup(`
                                <strong>🚌 Route ${busNumber}</strong><br>
                                Status: <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span><br>
                                Passengers: ${loadingText}<br>
                                Bus ID: ${vehicle.id}<br>
                                Journey: ${vehicle.journeyId}
                            `);
                        busMarkers.set(vehicle.id, newMarker);
                    }
                });
                // Center map on first bus if follow is enabled
                if (document.getElementById("followMarker").checked && data.vehiclesByLineAndDirection.length > 0) {
                    const firstBus = data.vehiclesByLineAndDirection[0];
                    map.setView([firstBus.lat / 1000000, firstBus.lng / 1000000]);
                }

                getStops();

                if (document.getElementById("getUserLiveLocation").checked) {
                    if (shareLocation !== true) {
                        getUserLocation()
                            .then((location) => {
                                shareLocation = true;
                            })
                            .catch((error) => {
                                console.error(error);
                            });
                    }
                } else {
                    shareLocation = false;
                }

                drawRoute(busNumber, globalVariant);
                updateBtnName(busNumber);
                
                // Handle all buses view
                if (document.getElementById("showAllBuses").checked) {
                    showAllBuses();
                }
                
                // Handle all stops view
                if (document.getElementById("showAllStops").checked) {
                    showAllStops();
                }
            } else {
                console.log("GPS Autobuz offline");
                drawRoute(busNumber, globalVariant);
                stopRefresh = true;
            }
        })
        .catch(error => {
            console.error(error);
        });
}

function grabVariant() {
    fetch(baseURL + '/TripPlanner/service/stops/line/' + busNumber + '/direction/' + busDirection)
    .then(response => response.json())
    .then(data => {
        const uniqueVariants = new Set();
        for (const stop of data.lineAndDirectionStops) {
            uniqueVariants.add(stop.variant);
        }
        globalVariant = Array.from(uniqueVariants);
        return globalVariant
    })
    .catch(error => console.error(error));
}

function autoRefresh() {
    if (!stopRefresh) {
        // Call updateMap() function immediately to display the initial data
        updateMap();
        setTimeout(autoRefresh, 5000); // call again after 5 seconds
    }
}

// Helper to create button for the bus route
function createButton(text, classes, clickHandler) {
    const button = document.createElement('button');
    button.innerText = text;
    button.classList.add('button', 'is-primary', 'is-fullwidth');
    if (classes.includes('is-outlined')) {
        button.classList.add('is-outlined');
    }

    button.addEventListener('click', clickHandler);
    return button;
}

// Define all the possible route types
const route_types = [
  { text: 'Selecteaza traseu', ids: [] },
  { text: 'Trasee principale', ids: [1, 2, 3, 5] },
  { text: 'Trasee secundare', ids: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },
  { text: 'Trasee profesionale', ids: [...Array.from({ length: 8 }, (_, i) => i + 111), 7, 24, 211, 213, 214, 215, 217] },
  { text: 'Trasee elevi', ids: [71, 72, 73, 74, 75, 76, 77, 78] },
  { text: 'Trasee turistice', ids: [22] },
  { text: 'Trasee metropolitane', ids: [500, 510, 520, 525, 530, 540, 550, 560, 561, 570, 571, 580, 581, 582] }
];

// Call API to fetch all the Bus Routes and create the buttons
function fetchLines() {
    fetch(baseURL + '/TripPlanner/service/lines')
        .then(response => response.json())
        .then(data => {
            const lines = data.allLines;
            allLinesData = lines; // Store for search
            const dropdown_route_list = document.getElementById('route_selection');
            const container_buttons = document.getElementById('buttonsContainer');
            
            route_types.forEach(route_type => {
                const route_option = document.createElement('option');
                route_option.value = route_type.text;
                route_option.innerHTML = route_type.text;
                dropdown_route_list.appendChild(route_option);
            });

            const selectedOption = new URLSearchParams(window.location.search).get('type');
            if (selectedOption) {
                dropdown_route_list.value = selectedOption;
                if (dropdown_route_list.value != "Selecteaza traseu") {
                    updateLines(selectedOption, lines, container_buttons);
                }
            }

            dropdown_route_list.addEventListener('change', () => {
                const selectedOption = dropdown_route_list.options[dropdown_route_list.selectedIndex].value;
                updateLines(selectedOption, lines, container_buttons);
            });
        })
        .catch(error => console.error(error));
}

function updateLines(selectedOption, lines, container_buttons) {
    // Filter the available bus routes by the selected route type
    const filteredLines = lines.filter(line => route_types.find(option => option.text === selectedOption).ids.includes(line.id));
    container_buttons.innerHTML = '';
    
    const lineElems = filteredLines.map(line => createLineElement(line, selectedOption));
    lineElems.forEach(element_linie_bus => {
        container_buttons.appendChild(element_linie_bus);
    });
}

function createLineElement(line, selectedOption) {
    const [second_route_description, first_route_description] = line.description.split(':');

    const element_linie_bus = document.createElement('div');
    element_linie_bus.classList.add('line');

    const text_number_bus = document.createElement('span');
    // Display E1, E2, etc. for student routes (71-78), otherwise show normal route number
    const displayId = (line.id >= 71 && line.id <= 78) ? `E${line.id - 70}` : line.id;
    text_number_bus.innerHTML = `<i class="fas fa-bus"></i> Traseu ${displayId}`;
    element_linie_bus.appendChild(text_number_bus);

    const first_route = createButton(`📍 ${first_route_description}`, ['is-full'], () => {
        window.location.href = `?bus=${line.id}&way=tour&type=${selectedOption}`;
    });
    element_linie_bus.appendChild(first_route);

    const second_route = createButton(`📍 ${second_route_description}`, ['is-outlined'], () => {
        window.location.href = `?bus=${line.id}&way=retour&type=${selectedOption}`;
    });
    element_linie_bus.appendChild(second_route);

    return element_linie_bus;
}

// Get specific coordinates for a requested bus defined by `busNumber`
function fetchRoute(busNumber, variant) {
    const url = baseURL + `/TripPlanner/service/gislinks/line/${busNumber}/variant/${variant}`;
    return fetch(url)
      .then(response => response.json())
      .then(data => data.gislinksForLineAndVariant);
}

// Draw the bus route by using polyline
function drawRoute(busNumber, variants) {
    variants.forEach((variant, index) => { // Use index to select color from the array
        fetchRoute(busNumber, variant).then(data => {
            const fullRoute = data.map(coord => L.latLng(coord.lat / 1000000, coord.lng / 1000000));
            L.polyline(fullRoute, { color: busLinesColor[index] }).addTo(map);
        }).catch(error => {
            console.error(error);
        });
    });
}

function getUserLocation() {
    let userMarkerGroup = L.layerGroup().addTo(map);
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported');
            reject(new Error('Geolocation is not supported'));
            shareLocation = false;
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                L.marker([latitude, longitude]).addTo(userMarkerGroup);
                map.setView([latitude, longitude], 14);
                resolve({ lat: latitude, lng: longitude });
            },
            error => {
                console.error(error);
                reject(error);
                shareLocation = false;
            }
        );
    });
}

function getStops() {
    fetch(baseURL + '/TripPlanner/service/stops/line/' + busNumber + '/direction/' + busDirection)
      .then(response => response.json())
      .then(data => {
        let filteredStops = data.lineAndDirectionStops;
        console.log('Route specific stops:', filteredStops);

        // Clear existing stop markers if any
        if (window.stopMarkersGroup) {
            window.stopMarkersGroup.clearLayers();
        } else {
            window.stopMarkersGroup = L.layerGroup().addTo(map);
        }

        // Add markers for the stops on this specific route
        filteredStops.forEach(stop => {
          const marker = L.marker([stop.lat / 1000000, stop.lng / 1000000], 
            { icon: stopPinIcon, iconSize: [30, 30], bubblingMouseEvents: false })
            .addTo(window.stopMarkersGroup)
            .bindPopup(`
                Statie: ${stop.name}<br>
                Variant: ${stop.variant}<br>
                Sequence: ${stop.sequence}
            `);
        });
      })
      .catch(error => console.error('Error fetching stops:', error));
}

function updateBtnName(busNumber) {
    // No longer needed as we have a persistent side menu
}

// Show all active buses on the map
function showAllBuses() {
    fetch(baseURL + '/TripPlanner/service/vehicles')
        .then(response => response.json())
        .then(data => {
            allVehiclesData = data.allVehicles; // Store for filtering
            displayFilteredBuses(allVehiclesData);
        })
        .catch(error => console.error('Error fetching all buses:', error));
}

// Display filtered buses based on current filter
function displayFilteredBuses(vehicles) {
    // Clear old markers
    allBusesMarkers.forEach(marker => map.removeLayer(marker));
    allBusesMarkers.clear();
    
    vehicles.forEach(vehicle => {
        if (vehicle.lineId > 0) { // Skip inactive buses
            const lat = vehicle.lat / 1000000;
            const lng = vehicle.lng / 1000000;
            
            // Get punctuality status
            const punctuality = vehicle.punctuality;
            let statusText = 'On time';
            let statusColor = 'green';
            
            if (punctuality > 300) {
                statusText = `${Math.round(punctuality/60)} min late`;
                statusColor = 'red';
            } else if (punctuality < -300) {
                statusText = `${Math.round(Math.abs(punctuality)/60)} min early`;
                statusColor = 'blue';
            }
            
            // Get loading status
            const loadingDegree = vehicle.loadingDegree;
            const loadingText = ['Empty', 'Normal', 'Crowded', 'Full'][loadingDegree] || 'Unknown';
            
            const marker = L.marker([lat, lng], {icon: smallBusIcon})
                .addTo(map)
                .bindPopup(`
                    <strong>Route ${vehicle.lineId}</strong><br>
                    Status: <span style="color: ${statusColor}">${statusText}</span><br>
                    Passengers: ${loadingText}<br>
                    Bus ID: ${vehicle.id}
                `);
            
            allBusesMarkers.set(vehicle.id, marker);
        }
    });
}

// Show all bus stops on the map
function showAllStops() {
    if (allStopsMarkers) return; // Already loaded
    
    fetch(baseURL + '/TripPlanner/service/stops')
        .then(response => response.json())
        .then(data => {
            allStopsData = data.allStops; // Store for search
            allStopsMarkers = L.layerGroup().addTo(map);
            
            data.allStops.forEach(stop => {
                const lat = stop.lat / 1000000;
                const lng = stop.lng / 1000000;
                
                const routes = stop.traversingLines.split(',').join(', ');
                
                const marker = L.marker([lat, lng], {
                    icon: stopPinIcon,
                    iconSize: [16, 16]
                })
                .addTo(allStopsMarkers)
                .bindPopup(`
                    <strong>${stop.name}</strong><br>
                    Routes: ${routes}<br>
                    Stop ID: ${stop.id}
                `);
            });
        })
        .catch(error => console.error('Error fetching all stops:', error));
}

// Search functionality
function performSearch(query) {
    const container = document.getElementById('buttonsContainer');
    container.innerHTML = '';
    
    if (!query.trim()) {
        // Show current route type selection if no search
        const selectedOption = document.getElementById('route_selection').value;
        if (selectedOption !== 'Selecteaza traseu') {
            updateLines(selectedOption, allLinesData, container);
        }
        return;
    }
    
    // Search routes
    const matchingRoutes = allLinesData.filter(line => {
        const displayId = (line.id >= 71 && line.id <= 78) ? `E${line.id - 70}` : line.id;
        return displayId.toString().includes(query) || 
               line.name.toLowerCase().includes(query.toLowerCase()) ||
               line.description.toLowerCase().includes(query.toLowerCase());
    });
    
    // Display search results
    if (matchingRoutes.length > 0) {
        const title = document.createElement('div');
        title.innerHTML = `<strong>🔍 Found ${matchingRoutes.length} routes:</strong>`;
        title.style.padding = '0.5rem';
        title.style.marginBottom = '0.5rem';
        container.appendChild(title);
        
        matchingRoutes.forEach(line => {
            const element = createLineElement(line, 'Search Results');
            container.appendChild(element);
        });
    } else {
        container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #666;">No routes found</div>';
    }
}

// Filter buses based on selected filter
function applyBusFilter(filterType) {
    if (!allVehiclesData.length) return;
    
    let filteredVehicles = allVehiclesData;
    
    switch(filterType) {
        case 'active':
            filteredVehicles = allVehiclesData.filter(v => v.lineId > 0);
            break;
        case 'inactive':
            filteredVehicles = allVehiclesData.filter(v => v.lineId === 0);
            break;
        case 'delayed':
            filteredVehicles = allVehiclesData.filter(v => v.punctuality > 300);
            break;
        default:
            filteredVehicles = allVehiclesData;
    }
    
    displayFilteredBuses(filteredVehicles);
}

// Find nearest stops to user location
function findNearestStops() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        if (!allStopsData.length) {
            alert('Please enable "Show All Stops" first to load stop data.');
            return;
        }
        
        // Calculate distances and find nearest 5 stops
        const stopsWithDistance = allStopsData.map(stop => {
            const stopLat = stop.lat / 1000000;
            const stopLng = stop.lng / 1000000;
            const distance = getDistance(userLat, userLng, stopLat, stopLng);
            return { ...stop, distance };
        });
        
        const nearestStops = stopsWithDistance
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
        
        // Display results
        const container = document.getElementById('buttonsContainer');
        container.innerHTML = '';
        
        const title = document.createElement('div');
        title.innerHTML = `<strong>📍 Nearest Stops:</strong>`;
        title.style.padding = '0.5rem';
        title.style.marginBottom = '0.5rem';
        container.appendChild(title);
        
        nearestStops.forEach(stop => {
            const stopElement = document.createElement('div');
            stopElement.classList.add('line');
            stopElement.innerHTML = `
                <span><i class="fas fa-map-pin"></i> ${stop.name}</span>
                <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
                    Distance: ${Math.round(stop.distance)}m<br>
                    Routes: ${stop.traversingLines.split(',').join(', ')}
                </div>
            `;
            stopElement.style.cursor = 'pointer';
            stopElement.addEventListener('click', () => {
                map.setView([stop.lat / 1000000, stop.lng / 1000000], 16);
            });
            container.appendChild(stopElement);
        });
        
    }, error => {
        alert('Unable to get your location. Please enable location services.');
    });
}

// Calculate distance between two points in meters
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

// Side Menu functionality
const sideMenu = document.getElementById('sideMenu');
const moveMenu = document.getElementById('moveMenu');

moveMenu.addEventListener('click', () => {
    sideMenu.classList.toggle('left');
});

// Event listeners for new features
document.getElementById('showAllBuses').addEventListener('change', function() {
    if (this.checked) {
        showAllBuses();
    } else {
        // Clear all buses markers
        allBusesMarkers.forEach(marker => map.removeLayer(marker));
        allBusesMarkers.clear();
    }
});

document.getElementById('showAllStops').addEventListener('change', function() {
    if (this.checked) {
        showAllStops();
    } else {
        // Clear all stops markers
        if (allStopsMarkers) {
            map.removeLayer(allStopsMarkers);
            allStopsMarkers = null;
        }
    }
});

// Search functionality
document.getElementById('searchInput').addEventListener('input', function() {
    const query = this.value.trim();
    performSearch(query);
});

// Filter functionality
document.getElementById('filterSelect').addEventListener('change', function() {
    const filterType = this.value;
    if (document.getElementById('showAllBuses').checked) {
        applyBusFilter(filterType);
    }
});

// Nearest stops functionality
document.getElementById('findNearestStops').addEventListener('click', findNearestStops);

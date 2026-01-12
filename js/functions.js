// Configuration
const CONFIG = {
    baseURL: 'http://86.127.97.204:8080',
    mapZoom: 15,
    refreshInterval: 5000,
    defaultLocation: { lat: 45.79, lng: 24.13 }
};

// State management
const state = {
    stopRefresh: false,
    shareLocation: false,
    allBusesMarkers: new Map(),
    allStopsMarkers: null,
    allLinesData: [],
    allStopsData: [],
    allVehiclesData: [],
    busMarkers: new Map(),
    globalVariant: [],
    routeLines: [] // Cache for route polylines
};

// URL parameters
const urlParams = new URLSearchParams(window.location.search);
const busNumber = urlParams.get('bus');
const busDirection = urlParams.get('way');
const url = `${CONFIG.baseURL}/TripPlanner/service/vehicles/line/${busNumber}/direction/${busDirection}`;

// Constants
const busLinesColor = ['red', 'blue', 'green'];

// Icons
const icons = {
    bus: L.icon({ iconUrl: 'img/bus.png', iconSize: [40, 40] }),
    smallBus: L.icon({ iconUrl: 'img/bus.png', iconSize: [24, 24] }),
    stop: L.icon({ iconUrl: 'img/pin.png', iconSize: [24, 24] })
};

// Initialize map
const map = L.map('map').setView([0, 0], 1);
const marker = L.marker([0, 0], {icon: icons.bus}).addTo(map);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    maxZoom: CONFIG.mapZoom,
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// Initialize app
fetchLines();
if (busNumber && busDirection) {
    setInitialView();
    autoRefresh();
    grabVariant();
}

function setInitialView() {
    const bounds = [[CONFIG.defaultLocation.lat, CONFIG.defaultLocation.lng]];
    map.fitBounds(bounds, { padding: [50, 50] });
}

function updateMap() {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.vehiclesByLineAndDirection?.length > 0) {
                updateBusMarkers(data.vehiclesByLineAndDirection);
                handleFollowBus(data.vehiclesByLineAndDirection);
                getStops();
                handleUserLocation();
                drawRoute(busNumber, state.globalVariant);
                handleAllBusesView();
                handleAllStopsView();
            } else {
                drawRoute(busNumber, state.globalVariant);
                state.stopRefresh = true;
            }
        })
        .catch(error => console.error('Error updating map:', error));
}

function updateBusMarkers(vehicles) {
    const currentVehicleIds = new Set(vehicles.map(v => v.id));
    
    // Remove old markers
    for (const [vehicleId, marker] of state.busMarkers) {
        if (!currentVehicleIds.has(vehicleId)) {
            map.removeLayer(marker);
            state.busMarkers.delete(vehicleId);
        }
    }
    
    // Update/add markers
    vehicles.forEach(vehicle => {
        const lat = vehicle.lat / 1000000;
        const lng = vehicle.lng / 1000000;
        const statusInfo = getVehicleStatus(vehicle);
        
        if (state.busMarkers.has(vehicle.id)) {
            state.busMarkers.get(vehicle.id).setLatLng([lat, lng]);
        } else {
            const marker = L.marker([lat, lng], {icon: icons.bus})
                .addTo(map)
                .bindPopup(createBusPopup(vehicle, statusInfo));
            state.busMarkers.set(vehicle.id, marker);
        }
    });
}

function getVehicleStatus(vehicle) {
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
    
    const loadingText = ['🟢 Empty', '🟡 Normal', '🟠 Crowded', '🔴 Full'][vehicle.loadingDegree] || 'Unknown';
    
    return { statusText, statusColor, loadingText };
}

function createBusPopup(vehicle, statusInfo) {
    return `
        <strong style="color: #2c3e50;">🚌 Traseu ${busNumber}</strong><br>
        Status: <span style="color: ${statusInfo.statusColor}; font-weight: bold;">${statusInfo.statusText}</span><br>
        Passengers: ${statusInfo.loadingText}<br>
        Bus ID: ${vehicle.id}<br>
        Journey: ${vehicle.journeyId}
    `;
}

function handleFollowBus(vehicles) {
    // Follow bus functionality removed
}

function handleUserLocation() {
    if (document.getElementById("getUserLiveLocation").checked) {
        if (!state.shareLocation) {
            getUserLocation()
                .then(() => { state.shareLocation = true; })
                .catch(error => console.error('Location error:', error));
        }
    } else {
        state.shareLocation = false;
    }
}

function handleAllBusesView() {
    if (document.getElementById("showAllBuses").checked) {
        showAllBuses();
    }
}

function handleAllStopsView() {
    if (document.getElementById("showAllStops").checked) {
        showAllStops();
    }
}

function grabVariant() {
    fetch(`${CONFIG.baseURL}/TripPlanner/service/stops/line/${busNumber}/direction/${busDirection}`)
        .then(response => response.json())
        .then(data => {
            const uniqueVariants = new Set();
            data.lineAndDirectionStops.forEach(stop => uniqueVariants.add(stop.variant));
            state.globalVariant = Array.from(uniqueVariants);
        })
        .catch(error => console.error('Error fetching variants:', error));
}

function autoRefresh() {
    if (!state.stopRefresh) {
        updateMap();
        setTimeout(autoRefresh, CONFIG.refreshInterval);
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

function fetchLines() {
    fetch(`${CONFIG.baseURL}/TripPlanner/service/lines`)
        .then(response => response.json())
        .then(data => {
            const lines = data.allLines;
            state.allLinesData = lines;
            initializeRouteDropdown();
            setupRouteChangeListener(lines);
        })
        .catch(error => console.error('Error fetching lines:', error));
}

function initializeRouteDropdown() {
    const dropdown = document.getElementById('route_selection');
    route_types.forEach(route_type => {
        const option = document.createElement('option');
        option.value = route_type.text;
        option.textContent = route_type.text;
        dropdown.appendChild(option);
    });
    
    const selectedOption = urlParams.get('type');
    if (selectedOption && selectedOption !== "Selecteaza traseu") {
        dropdown.value = selectedOption;
        updateLines(selectedOption, state.allLinesData, document.getElementById('buttonsContainer'));
    }
}

function setupRouteChangeListener(lines) {
    document.getElementById('route_selection').addEventListener('change', (e) => {
        const selectedOption = e.target.value;
        updateLines(selectedOption, lines, document.getElementById('buttonsContainer'));
    });
}

function updateLines(selectedOption, lines, container_buttons) {
    const routeType = route_types.find(option => option.text === selectedOption);
    if (!routeType) return;
    
    const filteredLines = lines.filter(line => routeType.ids.includes(line.id));
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

function fetchRoute(busNumber, variant) {
    const url = `${CONFIG.baseURL}/TripPlanner/service/gislinks/line/${busNumber}/variant/${variant}`;
    return fetch(url)
        .then(response => response.json())
        .then(data => data.gislinksForLineAndVariant);
}

function drawRoute(busNumber, variants) {
    // Clear existing route lines
    state.routeLines.forEach(line => map.removeLayer(line));
    state.routeLines = [];
    
    // Use Promise.all for parallel fetching
    const routePromises = variants.map((variant, index) => 
        fetchRoute(busNumber, variant)
            .then(data => {
                const fullRoute = data.map(coord => L.latLng(coord.lat / 1000000, coord.lng / 1000000));
                const polyline = L.polyline(fullRoute, { 
                    color: busLinesColor[index],
                    weight: 4,
                    opacity: 0.8
                });
                polyline.addTo(map);
                state.routeLines.push(polyline);
            })
    );
    
    Promise.all(routePromises).catch(error => console.error('Error drawing routes:', error));
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
    fetch(`${CONFIG.baseURL}/TripPlanner/service/stops/line/${busNumber}/direction/${busDirection}`)
        .then(response => response.json())
        .then(data => {
            const filteredStops = data.lineAndDirectionStops;
            
            if (window.stopMarkersGroup) {
                window.stopMarkersGroup.clearLayers();
            } else {
                window.stopMarkersGroup = L.layerGroup().addTo(map);
            }
            
            filteredStops.forEach(stop => {
                const marker = L.marker([stop.lat / 1000000, stop.lng / 1000000], 
                    { icon: icons.stop, iconSize: [30, 30], bubblingMouseEvents: false })
                    .addTo(window.stopMarkersGroup)
                    .bindPopup(`
                        <strong style="color: #2c3e50;">${stop.seq}. ${stop.name}</strong><br>
                        Variant: ${stop.variant || 'N/A'}
                    `);
            });
        })
        .catch(error => console.error('Error fetching stops:', error));
}

function showAllBuses() {
    fetch(`${CONFIG.baseURL}/TripPlanner/service/vehicles`)
        .then(response => response.json())
        .then(data => {
            state.allVehiclesData = data.allVehicles;
            displayFilteredBuses(state.allVehiclesData);
        })
        .catch(error => console.error('Error fetching all buses:', error));
}

function displayFilteredBuses(vehicles) {
    state.allBusesMarkers.forEach(marker => map.removeLayer(marker));
    state.allBusesMarkers.clear();
    
    vehicles.forEach(vehicle => {
        if (vehicle.lineId > 0) {
            const lat = vehicle.lat / 1000000;
            const lng = vehicle.lng / 1000000;
            const statusInfo = getVehicleStatus(vehicle);
            
            const marker = L.marker([lat, lng], {icon: icons.smallBus})
                .addTo(map)
                .bindPopup(`
                    <strong>Route ${vehicle.lineId}</strong><br>
                    Status: <span style="color: ${statusInfo.statusColor}">${statusInfo.statusText}</span><br>
                    Passengers: ${statusInfo.loadingText.replace(/🟢|🟡|🟠|🔴/g, '')}<br>
                    Bus ID: ${vehicle.id}
                `);
            
            state.allBusesMarkers.set(vehicle.id, marker);
        }
    });
}

function showAllStops() {
    if (state.allStopsMarkers) return;
    
    fetch(`${CONFIG.baseURL}/TripPlanner/service/stops`)
        .then(response => response.json())
        .then(data => {
            state.allStopsData = data.allStops;
            state.allStopsMarkers = L.layerGroup().addTo(map);
            
            data.allStops.forEach(stop => {
                const lat = stop.lat / 1000000;
                const lng = stop.lng / 1000000;
                const routes = stop.traversingLines.split(',').join(', ');
                
                const marker = L.marker([lat, lng], {
                    icon: icons.stop,
                    iconSize: [16, 16]
                })
                .addTo(state.allStopsMarkers)
                .bindPopup(`
                    <strong>${stop.name}</strong><br>
                    Routes: ${routes}<br>
                    Stop ID: ${stop.id}
                `);
            });
        })
        .catch(error => console.error('Error fetching all stops:', error));
}

function performSearch(query) {
    const container = document.getElementById('buttonsContainer');
    container.innerHTML = '';
    
    if (!query.trim()) {
        const selectedOption = document.getElementById('route_selection').value;
        if (selectedOption !== 'Selecteaza traseu') {
            updateLines(selectedOption, state.allLinesData, container);
        }
        return;
    }
    
    const matchingRoutes = state.allLinesData.filter(line => {
        const displayId = (line.id >= 71 && line.id <= 78) ? `E${line.id - 70}` : line.id;
        return displayId.toString().includes(query) || 
               line.name.toLowerCase().includes(query.toLowerCase()) ||
               line.description.toLowerCase().includes(query.toLowerCase());
    });
    
    if (matchingRoutes.length > 0) {
        const title = document.createElement('div');
        title.innerHTML = `<strong>🔍 Found ${matchingRoutes.length} routes:</strong>`;
        title.style.padding = '0.5rem';
        title.style.marginBottom = '0.5rem';
        container.appendChild(title);
        
        matchingRoutes.forEach(line => {
            container.appendChild(createLineElement(line, 'Search Results'));
        });
    } else {
        container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #95a5a6;">No routes found</div>';
    }
}

function applyBusFilter(filterType) {
    if (!state.allVehiclesData.length) return;
    
    const filterMap = {
        'active': v => v.lineId > 0,
        'inactive': v => v.lineId === 0,
        'delayed': v => v.punctuality > 300,
        'all': () => true
    };
    
    const filteredVehicles = state.allVehiclesData.filter(filterMap[filterType] || filterMap.all);
    displayFilteredBuses(filteredVehicles);
}

function findNearestStops() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        if (!state.allStopsData.length) {
            alert('Please enable "Show All Stops" first to load stop data.');
            return;
        }
        
        const stopsWithDistance = state.allStopsData
            .map(stop => ({
                ...stop,
                distance: getDistance(userLat, userLng, stop.lat / 1000000, stop.lng / 1000000)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
        
        displayNearestStops(stopsWithDistance);
    }, () => {
        alert('Unable to get your location. Please enable location services.');
    });
}

function displayNearestStops(stops) {
    const container = document.getElementById('buttonsContainer');
    container.innerHTML = '';
    
    const title = document.createElement('div');
    title.innerHTML = `<strong>📍 Nearest Stops:</strong>`;
    title.style.padding = '0.5rem';
    title.style.marginBottom = '0.5rem';
    container.appendChild(title);
    
    stops.forEach(stop => {
        const stopElement = document.createElement('div');
        stopElement.classList.add('line');
        stopElement.innerHTML = `
            <span><i class="fas fa-map-pin"></i> ${stop.name}</span>
            <div style="font-size: 0.8rem; color: #95a5a6; margin-top: 0.25rem;">
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

// Event listeners
document.getElementById('showAllBuses').addEventListener('change', function() {
    if (this.checked) {
        showAllBuses();
    } else {
        state.allBusesMarkers.forEach(marker => map.removeLayer(marker));
        state.allBusesMarkers.clear();
    }
});

document.getElementById('showAllStops').addEventListener('change', function() {
    if (this.checked) {
        showAllStops();
    } else {
        if (state.allStopsMarkers) {
            map.removeLayer(state.allStopsMarkers);
            state.allStopsMarkers = null;
        }
    }
});

document.getElementById('searchInput').addEventListener('input', function() {
    performSearch(this.value.trim());
});

document.getElementById('filterSelect').addEventListener('change', function() {
    if (document.getElementById('showAllBuses').checked) {
        applyBusFilter(this.value);
    }
});

document.getElementById('findNearestStops').addEventListener('click', findNearestStops);

document.getElementById('moveMenu').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.toggle('left');
});

// Mobile menu toggle
document.getElementById('mobileMenuToggle').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.toggle('show');
});

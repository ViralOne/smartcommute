// Define flags
let stopRefresh = false;
let shareLocation = false;

// Initialize the map with a default location and zoom level
const map = L.map('map').setView([0, 0], 1);

// Create marker icon for the bus
var busIcon = L.icon({
    iconUrl: 'img/bus.png',
    iconSize: [40, 40]
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
const baseURL = 'http://81.196.186.121:8080'
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

// Update the map with the latest data
function updateMap() {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Get the latitude and longitude from the JSON data
            if (data.vehiclesByLineAndDirection && data.vehiclesByLineAndDirection.length > 0) {
                const lat = data.vehiclesByLineAndDirection[0].lat / 1000000;
                const lng = data.vehiclesByLineAndDirection[0].lng / 1000000;

                // Update the marker position
                marker.setLatLng([lat, lng]);

                // Update map view to center on the marker
                if (document.getElementById("followMarker").checked) {
                    map.setView([lat, lng]);
                }
                
                // Place stop markers
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
                }
                else{
                    shareLocation = false;
                }
                // Draw map route
                drawRoute(busNumber, globalVariant);
                updateBtnName(busNumber);
            } else {
                console.log("GPS Autobuz offline")
                drawRoute(busNumber, globalVariant);
                
                // All the busses have an working interval
                // In case of error (ex. the bus is not sending GPS coordinates anymore) enable the flag
                stopRefresh = true
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
    button.classList.add(classes, 'button', 'is-primary', 'is-responsive', 'wide-button');

    button.addEventListener('click', clickHandler);

    return button;
}

// Define all the possible route types
const route_types = [  { text: 'Selecteaza traseu', ids: [] },
  { text: 'Trasee principale', ids: [1, 2, 3, 4, 5] },
  { text: 'Trasee secundare', ids: Array.from({ length: 14 }, (_, i) => i + 6) },
  { text: 'Trasee profesionale', ids: Array.from({ length: 9 }, (_, i) => i + 111) },
  { text: 'Trasee elevi', ids: Array.from({ length: 7 }, (_, i) => i + 71) },
  { text: 'Trasee turistice', ids: [22] }
];

// Call API to fetch all the Bus Routes and create the buttons
function fetchLines() {
    fetch(baseURL + '/TripPlanner/service/lines')
        .then(response => response.json())
        .then(data => {
            const lines = data.allLines;
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

// Update the displayed bus routes based on the selected route type
function updateLines(selectedOption, lines, container_buttons) {
    // Filter the available bus routes by the selected route type
    const filteredLines = lines.filter(line => route_types.find(option => option.text === selectedOption).ids.includes(line.id));
    container_buttons.innerHTML = '';
    
    // Create a button element for each bus route and add them to the container
    const lineElems = filteredLines.map(line => createLineElement(line, selectedOption));
    lineElems.forEach(element_linie_bus => {
        container_buttons.appendChild(element_linie_bus);
    });
}

// Create a button element for a given bus route
function createLineElement(line, selectedOption) {
    const [second_route_description, first_route_description] = line.description.split(':');

    const element_linie_bus = document.createElement('div');
    element_linie_bus.classList.add('line');

    // Create a span element for the bus number and add it to the div
    const text_number_bus = document.createElement('span');
    text_number_bus.innerText = `Autobuz: ${line.id}`;
    element_linie_bus.appendChild(text_number_bus);

    // Create a button for the first route and add it to the div
    const first_route = createButton(first_route_description, ['is-full'], () => {
        window.location.href = `?bus=${line.id}&way=tour&type=${selectedOption}`;
    });
    element_linie_bus.appendChild(first_route);

    // Create a button for the second route and add it to the div
    const second_route = createButton(second_route_description, ['is-outlined'], () => {
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
    fetch(baseURL + '/TripPlanner/service/stops')
      .then(response => response.json())
      .then(data => {
        let filteredStops = data.allStops;
  
        if (busNumber) {
          filteredStops = filteredStops.filter(stop => {
            const traversingLines = stop.traversingLines.split(",");
            return traversingLines.includes(busNumber.trim());
          });
        }
  
        if (busDirection === 'tour') {
          filteredStops = filteredStops.filter((stop, index) => index % 2 === 0);
        } else if (busDirection === 'retour') {
          filteredStops = filteredStops.filter((stop, index) => index % 2 === 1);
        }
  
        // Loop through each stop and add a marker to the map
        filteredStops.forEach(stop => {
          const marker = L.marker([stop.lat / 1000000, stop.lng / 1000000], { icon: stopPinIcon, iconSize: [30, 30], bubblingMouseEvents: false })
            .addTo(map)
            .bindPopup(`Statie: ${stop.name}<br> Autobuze ce opresc la aceasta statie: ${stop.traversingLines}`);
        });
      })
      .catch(error => console.error(error));
}

function updateBtnName(busNumber) {
    var button = document.getElementById('show_dialog');
    button.textContent = `Autobuz: ${busNumber} - Other Routes`;
}

var dialog = document.querySelector('dialog');
    document.querySelector('#show_dialog').onclick = function() {
    dialog.show();
};

document.querySelector('#close').onclick = function() {
    dialog.close();
};
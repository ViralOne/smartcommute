// Define flags
let stopRefresh = false;

// Initialize the map with a default location and zoom level
const map = L.map('map').setView([0, 0], 1);

// Add a marker to the map at the given location
const marker = L.marker([0, 0]).addTo(map);

// Define the API endpoint URL
// Use URL Path: ?bus=5&way=tour
const urlParams = new URLSearchParams(window.location.search);
const bus_number = urlParams.get('bus');
const bus_direction = urlParams.get('way');
const url = 'http://81.196.186.121:8080/TripPlanner/service/vehicles/line/' + bus_number + '/direction/' + bus_direction;

// Add a tile layer to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    maxZoom: 18,
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// Call fetchLines() to populate with all the Bus routes buttons
fetchLines();

try {
     // Try to call setInitialView() to set the initial zoom level and center the map view on the initial point
    setInitialView();

    // Try to call autoRefresh()
    // All the busses has an working interval
    // In case of error (the bus is not working anymore) enable flag stopRefresh
    autoRefresh();
} catch (error) {
    console.log(error);
    stopRefresh = true;
}

// Use the fitBounds method to set the initial zoom level and center the map view on the initial point
function setInitialView() {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Get the latitude and longitude from the JSON data
            const lat = data.vehiclesByLineAndDirection[0].lat / 1000000;
            const lng = data.vehiclesByLineAndDirection[0].lng / 1000000;

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

// Define a function to update the map with the latest data
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

                // If the "Follow the Bus" checkbox is checked, update the map view to center on the marker
                if (document.getElementById("followMarker").checked) {
                    map.setView([lat, lng]);
                }
            } else {
                console.log("GPS Autobuz offline")
                stopRefresh = true
            }
        })
        .catch(error => {
            console.error(error);
            stopRefresh = true;
        });
}

function autoRefresh() {
    if (!stopRefresh) {
        // Call the updateMap() function immediately to display the initial data
        updateMap();
        setTimeout(autoRefresh, 5000); // call again after 5 seconds
    }
}

// Helper to create button for the bus route
function createButton(text, classes, clickHandler) {
    const button = document.createElement('button');
    button.innerText = text;
    button.classList.add(classes, 'button', 'is-primary', 'is-responsive', 'wide-button');

    if (window.matchMedia('(max-width: 767px)').matches) {
      button.classList.add('is-large');
    } else {
      button.classList.add('is-medium');
    }

    button.addEventListener('click', clickHandler);
    
    return button;
}

// Call API and fetch all the Bus Routes
// Create two buttons for each ID
function fetchLines() {
    fetch('http://81.196.186.121:8080/TripPlanner/service/lines')
      .then(response => response.json())
      .then(data => {
        const lines = data.allLines;
        const container = document.createElement('div');
        lines.forEach(line => {
          const id = line.id;
          if (id > 0) {
            const [desc1, desc2] = line.description.split(':');
  
            const lineElem = document.createElement('div');
            lineElem.classList.add('line');
  
            const idElem = document.createElement('span');
            idElem.innerText = `Autobuz: ${id}`;
            lineElem.appendChild(idElem);
  
            const first_route = createButton(desc1, ['is-full'], () => {
              window.location.href = `?bus=${id}&way=tour`;
            });
            lineElem.appendChild(first_route);
  
            const second_route = createButton(desc2, ['is-outlined'], () => {
              window.location.href = `?bus=${id}&way=retour`;
            });
            lineElem.appendChild(second_route);
  
            container.appendChild(lineElem);
          }
        });
        document.body.appendChild(container);
      })
      .catch(error => console.error(error));
}

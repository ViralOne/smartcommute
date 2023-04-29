# 🚌 Tursib LiveMap

Tursib LiveMap is a web application that displays the real-time location of Tursib buses in Sibiu, Romania on a map. The app uses Leaflet to display the map and fetches the bus location data from the Tursib API. The app allows the user to follow a specific bus on the map and displays the routes of all available buses.

# Installation

No installation is required to use the Tursib LiveMap application. Simply visit the webpage and the application will load in your web browser.

# Usage

- Visit the webpage in your web browser.
- Select a bus route from the list of available routes.
- Optionally, click the "Follow the Bus" checkbox to center the map view on the selected bus.
- The map will display the real-time location of the selected bus.

# Docker container

To build and run the Docker image follow the next steps:
`docker build . -t smartcommute:0.0.1`
`docker run --rm -p 8080:80 smartcommute:0.0.1`

Or you can use Docker compose:
`docker-compose up`

And to stop the instance:
`docker-compose down`

# To do
- UI
  - [ ] Update design for Mobile
  - [ ] Update design for Desktop
  - [ ] Add stops on the map
  - [x] Add 'Get my location'
  - [x] [Update map marker icon](https://leafletjs.com/examples/custom-icons/)
  - [x] Draw map route for each Bus
  - [x] Create dockerized version
- ?

# Dependencies

- Leaflet 1.9.3
- Bulma 0.9.4

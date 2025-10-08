let plantLists = []; // Variable to store the list of plants
let currentFilter = 'all'; // Current filter type
let currentSort = 'date'; // Current sort method

// Function to navigate to the plant details page
function showDetailsPage(id) {
    window.location.href = "/plants/" + id + "?user=" + loggedInUser;
}

// Function to navigate to add plant page
function openAddPlantPage() {
    window.location.href = "/addPlant";
}

// Function to initialize the application
async function init() {
    checkIfUserLoggedIn(); // Check if user is logged in

    if ("serviceWorker" in navigator) {
        // Register service worker for offline capabilities
        navigator.serviceworker

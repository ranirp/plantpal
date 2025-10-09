const { get } = require("mongoose");

// Declare a variable to hold the logged in user information
let loggedInUser = null;

// Function to initialize the application
function init() {
    // Register form submission event 
    registerFormSubmit();
    // Get the logged in user
    getLoggedInUser();
    // Setup image preview functionality
    setupImagePreview();
}

// Function to get the logged in user
function getLoggedInUser() {
    // Asynchronously retrieve the user name
    getUserName().then((userName) => {
        // If user name exists, set it as the logged-in user
        if (userName) {
            loggedInUser = userName.value;
            // Pre-fill the nickname field with the logged-in user's name
            const nicknameField = document.getElementById("nickname");
            if (nicknameField && loggedInUser) {
                nicknameField.value = loggedInUser;
            }
        }
    });
}

// Function to setup image preview functionality
function setupImagePreview() {
    const photoInput = document.getElementById("photoID");
    if (photoInput) {
        photoInput.addEventListener("change", function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewImg = document.getElementById("previewImage");
                    const previewDiv = document.getElementById("imagePreview");
                    if (previewImg && previewDiv) {
                        previewImg.src = e.target.result;
                        previewDiv.classList.remove("hidden");
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Function to register form submission event
function registerFormSubmit() {
    const plantForm = document.getElementById("plantForm");
    if (plantForm) {
        plantForm.addEventListener("submit", function(event) {
            event.preventDefault(); // Prevent default form submission
            // Call custom form submission handler
            addNewPlantDetails();
        });
    } else {
        console.error("Plant form not found!");
    }
}

// Function to add new plant details
function addNewPlantDetails() {
    // Get values from the form fields
    const plantName = document.getElementById("plantName").value;
    const type = document.getElementById("type").value;
    const description = document.getElementById("description").value;
    const nickname = document.getElementById("nickname").value;
    const photo = document.getElementById("photoID").files[0];

    // Validate required fields
    if (!plantName || !type || !description || !nickname) {
        alert("Please fill in all required fields.");
        return;
    }

    // Create an object with the plant details
    const plantDetails = {
        plantName,
        type,
        description,
        nickname,
        photo
    };

    // Check if online
    if (navigator.onLine) {
        // If online, send the plant details to the server
        submitPlantDetails(plantDetails);
    } else {
        // If offline, save the plant details to local storage
        openSyncPlantIDB().then((db) => {
            addNewPlantToSync (db, plantDetails).then((data) => {
                console.log("Plant details saved for sync to DB");
                // Redirect to homepage after saving
                window.location.href = "/";
            });
        });
    }
}

// Function to submit plant details to the server
function submitPlantDetails(plantDetails) {
    // Create form data object
    const formData = new FormData();
    // Append plant details to form data
    formData.append("plantName", plantDetails.plantName);
    formData.append("type", plantDetails.type);
    formData.append("description", plantDetails.description);
    formData.append("nickname", plantDetails.nickname);
    if (plantDetails.photo) {
        formData.append("photo", plantDetails.photo);
    }

    // Send POST request to the server with plant details
    fetch("/api/plants", {
        method: "POST",
        body: formData
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error("Error submitting plant details");
        }
    })
    .then(data => {
        console.log("Plant details submitted successfully:", data);
        // Redirect to homepage or show success message
        window.location.href = "/";
    })
    .catch(error => {
        console.error("Error submitting plant details:", error);
        alert("Error submitting plant details. Please try again.");
    });
}

// Function to listen for online event and sync data
function listenForOnlineSync() {
    window.addEventListener("online", async() => {
        // Check if there are plants in local storage to sync and update
        const isTherePlantsToSync = await checkIfThereIsPlantsAndUpdate();
        // If there are no plants to sync, get plants from the server
        if (!isTherePlantsToSync) {
            console.log("Back online - syncing completed");
        }
    });
}

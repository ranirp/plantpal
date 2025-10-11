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
    // Setup character counter for description
    setupCharacterCounter();
}

// Function to get the logged in user
function getLoggedInUser() {
    // Use the proper IndexedDB user management system
    checkIfUserLoggedIn().then((userName) => {
        // If user name exists, set it as the logged-in user
        if (userName && userName.value) {
            loggedInUser = userName.value;
            console.log("User logged in:", loggedInUser);
            // Pre-fill the nickname field with the logged-in user's name
            const nicknameField = document.getElementById("nickname");
            if (nicknameField && loggedInUser) {
                nicknameField.value = loggedInUser;
                // Make the field readonly since they're logged in
                nicknameField.readOnly = true;
                nicknameField.style.backgroundColor = '#f3f4f6'; // Light gray background
                nicknameField.title = 'This is your logged-in username';
            }
        } else {
            console.log("No user logged in - user can enter any nickname");
            loggedInUser = null;
            // Make sure the field is editable if no user is logged in
            const nicknameField = document.getElementById("nickname");
            if (nicknameField) {
                nicknameField.readOnly = false;
                nicknameField.style.backgroundColor = '';
                nicknameField.title = '';
                nicknameField.placeholder = 'Enter your nickname';
            }
        }
    }).catch((error) => {
        console.log("No user logged in or error getting user:", error);
        loggedInUser = null;
        // Make sure the field is editable if there's an error
        const nicknameField = document.getElementById("nickname");
        if (nicknameField) {
            nicknameField.readOnly = false;
            nicknameField.style.backgroundColor = '';
            nicknameField.title = '';
            nicknameField.placeholder = 'Enter your nickname';
        }
    });
}

// Function to check actual server connectivity
async function checkServerConnectivity() {
    if (!navigator.onLine) {
        return false; // If browser says offline, don't bother checking
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('/api/plants/getAllPlants?check=true', {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.log('Server connectivity check failed:', error.message);
        return false;
    }
}

// Function to setup image preview functionality
function setupImagePreview() {
    console.log("Setting up image preview...");
    const photoInput = document.getElementById("photoID");
    console.log("Photo input element:", photoInput);
    
    if (photoInput) {
        photoInput.addEventListener("change", function(event) {
            const file = event.target.files[0];
            const previewImg = document.getElementById("previewImg");
            const previewDiv = document.getElementById("imagePreview");
            if (file && previewImg && previewDiv) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewDiv.classList.remove("hidden");
                };
                reader.readAsDataURL(file);
            } else if (previewDiv) {
                previewDiv.classList.add("hidden");
            }
        });
    }
}

// Function to setup character counter for description
function setupCharacterCounter() {
    const descriptionField = document.getElementById("description");
    const charCount = document.getElementById("charCount");
    
    if (descriptionField && charCount) {
        // Update count on input
        descriptionField.addEventListener("input", function() {
            const count = descriptionField.value.length;
            charCount.textContent = count;
            
            // Change color based on validation
            if (count < 10) {
                charCount.parentElement.classList.add("text-red-500");
                charCount.parentElement.classList.remove("text-gray-500", "text-green-600");
            } else if (count >= 10 && count <= 1000) {
                charCount.parentElement.classList.add("text-green-600");
                charCount.parentElement.classList.remove("text-gray-500", "text-red-500");
            }
        });
        
        // Initialize count
        charCount.textContent = descriptionField.value.length;
    }
}

// Function to register form submission event
function registerFormSubmit() {
    const plantForm = document.getElementById("addPlantForm");
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
    console.log("Starting form submission...");
    
    // Get values from the form fields
    const plantName = document.getElementById("plantName").value;
    const type = document.getElementById("type").value;
    const description = document.getElementById("description").value;
    const nickname = document.getElementById("nickname").value;
    const photo = document.getElementById("photoID").files[0];

    console.log("Form values:", {
        plantName,
        type,
        description,
        nickname,
        photo: photo ? photo.name : "No photo selected"
    });

    // Validate required fields
    if (!plantName || !type || !description || !nickname) {
        const missingFields = [];
        if (!plantName) missingFields.push("Plant Name");
        if (!type) missingFields.push("Plant Type");
        if (!description) missingFields.push("Description");
        if (!nickname) missingFields.push("Nickname");
        
        alert("Please fill in all required fields: " + missingFields.join(", "));
        return;
    }

    // Validate description length
    if (description.length < 10) {
        alert("Description must be at least 10 characters long. Currently: " + description.length + " characters.");
        return;
    }

    if (description.length > 1000) {
        alert("Description cannot exceed 1000 characters. Currently: " + description.length + " characters.");
        return;
    }

    if (!photo) {
        alert("Please select a photo for your plant.");
        return;
    }

    // Create an object with the plant details
    const plantDetails = {
        plantName,
        type,
        description,
        nickname,
        photo,
        createdAt: new Date().toISOString() // Add timestamp for offline plants
    };

    // Check if actually online by verifying server connectivity
    checkServerConnectivity().then((isActuallyOnline) => {
        if (isActuallyOnline) {
            // If online, send the plant details to the server
            console.log("✅ Online - Submitting plant to server");
            submitPlantDetails(plantDetails);
        } else {
            // If offline, save the plant details to IndexedDB
            console.log("❌ Offline - Saving plant locally for later sync");
            // Note: We can't store the actual File object, so we'll store metadata
            const timestamp = Date.now();
            const tempId = `offline_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
            
            const offlinePlantDetails = {
                ...plantDetails,
                _id: tempId, // Add temporary ID for offline plants
                photo: photo ? {
                    name: photo.name,
                    size: photo.size,
                    type: photo.type,
                    lastModified: photo.lastModified
                } : null,
                __isServerPlant: false,
                __syncStatus: 'pending',
                __createdOffline: true,
                __lastSyncTime: null,
                __tempId: tempId // Keep track of the temporary ID
            };
            
            openSyncPlantIDB().then((db) => {
                addNewPlantToSync (db, offlinePlantDetails).then((data) => {
                    console.log("✅ Plant details saved offline for later sync");
                    alert("🌱 Plant saved offline! It will be synced when you're back online.");
                    // Redirect to homepage after saving
                    window.location.href = "/";
                }).catch((error) => {
                    console.error("Error saving plant offline:", error);
                    alert("❌ Error saving plant. Please try again.");
                });
            });
        }
    }).catch((error) => {
        console.error("Error checking connectivity:", error);
        alert("❌ Error checking connection. Please try again.");
    });
}

// Function to submit plant details to the server
function submitPlantDetails(plantDetails) {
    console.log("Submitting plant details:", plantDetails);
    
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

    console.log("Form data prepared, sending to server...");

    // Send POST request to the server with plant details
    fetch("/api/plants/addNewPlant", {
        method: "POST",
        body: formData
    })
    .then(response => {
        console.log("Server response status:", response.status);
        return response.json().then(data => {
            if (response.ok) {
                return data;
            } else {
                // Throw error with the server's message
                throw new Error(data.message || "Error submitting plant details");
            }
        });
    })
    .then(data => {
        console.log("Plant details submitted successfully:", data);
        alert("🌱 Plant shared successfully!");
        // Redirect to homepage or show success message
        window.location.href = "/";
    })
    .catch(error => {
        console.error("Error submitting plant details:", error);
        // Display a user-friendly error message
        alert("❌ " + error.message + "\n\nPlease check your input and try again.");
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

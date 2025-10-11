let loggedInUser = null;
let imageWorker = null;
let compressedImageBlob = null; // will hold compressed Blob when worker completes

// Function to initialize the application
function init() {
    // Initialize Web Worker
    initializeWebWorker();
    // Register form submission event
    registerFormSubmit();
    // Get the logged in user
    getLoggedInUser();
    // Setup image preview with web worker if available
    setupImagePreviewWithWorker();
    // Setup character counter for description
    setupCharacterCounter();
}

// Function to get the logged in user
function getLoggedInUser() {
    // Use existing IndexedDB helper (checkIfUserLoggedIn / getUserName may exist in other scripts)
    if (typeof checkIfUserLoggedIn === 'function') {
        checkIfUserLoggedIn().then((userName) => {
            if (userName && userName.value) {
                loggedInUser = userName.value;
                const nicknameField = document.getElementById("nickname");
                if (nicknameField && loggedInUser) {
                    nicknameField.value = loggedInUser;
                    nicknameField.readOnly = true;
                    nicknameField.style.backgroundColor = '#f3f4f6';
                    nicknameField.title = 'This is your logged-in username';
                }
            }
        }).catch(() => { loggedInUser = null; });
        return;
    }

    // Fallback if another helper exists (older artifact used getUserName())
    if (typeof getUserName === 'function') {
        getUserName().then((userName) => {
            if (userName) {
                loggedInUser = userName.value || userName;
                const nicknameField = document.getElementById("nickname");
                if (nicknameField && loggedInUser) {
                    nicknameField.value = loggedInUser;
                }
            }
        }).catch(() => { loggedInUser = null; });
    }
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
/**
 * Initialize Web Worker for image processing
 */
function initializeWebWorker() {
    if (window.Worker) {
        try {
            // Worker path assumes public is served as root, adjust if needed
            imageWorker = new Worker('/javascripts/workers/imageWorker.js');

            imageWorker.addEventListener('message', function(e) {
                const { type } = e.data || {};

                switch (type) {
                    case 'COMPRESS_SUCCESS':
                        console.log('Image compressed successfully');
                        compressedImageBlob = e.data.blob || null;
                        // log sizes if provided
                        if (e.data.originalSize) console.log('Original size:', e.data.originalSize);
                        if (e.data.compressedSize) console.log('Compressed size:', e.data.compressedSize);
                        break;
                    case 'VALIDATION_ERROR':
                        console.error('Validation errors:', e.data.errors);
                        if (Array.isArray(e.data.errors)) alert(e.data.errors.join('\n'));
                        break;
                    case 'VALIDATION_SUCCESS':
                        console.log('Image validation passed');
                        break;
                    case 'THUMBNAIL_SUCCESS':
                        console.log('Thumbnail generated');
                        break;
                    case 'ERROR':
                        console.error('Worker error:', e.data.message);
                        alert('Error processing image: ' + e.data.message);
                        break;
                    default:
                        console.log('Worker message:', e.data);
                }
            });

            imageWorker.addEventListener('error', function(ev) {
                console.error('Web Worker error:', ev.message);
            });

            console.log('Web Worker initialized successfully');
        } catch (err) {
            console.warn('Failed to initialize worker:', err.message);
            imageWorker = null;
        }
    } else {
        console.warn('Web Workers not supported in this browser');
    }
}

/**
 * Setup image preview with Web Worker processing
 */
function setupImagePreviewWithWorker() {
    const photoInput = document.getElementById("photoID");
    if (photoInput) {
        photoInput.addEventListener("change", function(event) {
            const file = event.target.files[0];
            const previewDiv = document.getElementById("imagePreview");
            const previewImg = document.getElementById("previewImg");

            if (file && imageWorker) {
                // Validate image using worker
                try {
                    imageWorker.postMessage({ type: 'VALIDATE_IMAGE', data: { name: file.name, size: file.size, type: file.type } });
                } catch (err) {
                    console.warn('Could not post VALIDATE_IMAGE to worker:', err.message);
                }

                // Show preview immediately
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (previewImg && previewDiv) {
                        previewImg.src = e.target.result;
                        previewDiv.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);

                // Send original file to worker for compression
                try {
                    imageWorker.postMessage({ type: 'COMPRESS_IMAGE', data: { file: file, maxWidth: 800, maxHeight: 600, quality: 0.8 } });
                } catch (err) {
                    console.warn('Could not post COMPRESS_IMAGE to worker:', err.message);
                }
            } else if (file) {
                // Fallback to inline preview if no worker
                showImagePreview(file);
                if (previewDiv) previewDiv.classList.remove('hidden');
            } else if (previewDiv) {
                previewDiv.classList.add('hidden');
            }
        });
    }
}

// Function to setup character counter for description
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
// Function to register form submission event
function registerFormSubmit() {
    // keep backward compatibility: id might be addPlantForm or plantForm
    const plantForm = document.getElementById("addPlantForm") || document.getElementById("plantForm");
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
// Function to add new plant details
function addNewPlantDetails() {
    // Get values from the form fields
    const plantName = document.getElementById("plantName") ? document.getElementById("plantName").value : '';
    const type = document.getElementById("type") ? document.getElementById("type").value : '';
    const description = document.getElementById("description") ? document.getElementById("description").value : '';
    const nickname = document.getElementById("nickname") ? document.getElementById("nickname").value : '';
    const photoInput = document.getElementById("photoID");
    const originalPhoto = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

    // Validate required fields
    const missing = [];
    if (!plantName) missing.push('Plant Name');
    if (!type) missing.push('Plant Type');
    if (!description) missing.push('Description');
    if (!nickname) missing.push('Nickname');
    if (missing.length) {
        alert('Please fill in all required fields: ' + missing.join(', '));
        return;
    }

    if (description.length < 10) {
        alert('Description must be at least 10 characters long.');
        return;
    }

    if (description.length > 1000) {
        alert('Description cannot exceed 1000 characters.');
        return;
    }

    if (!originalPhoto && !compressedImageBlob) {
        alert('Please select a photo for your plant.');
        return;
    }

    // Choose compressed blob if available, otherwise original file
    const photoForUpload = compressedImageBlob || originalPhoto;

    const plantDetails = {
        plantName,
        type,
        description,
        nickname,
        photo: photoForUpload,
        createdAt: new Date().toISOString()
    };

    // If offline, save metadata to sync DB; if online submit to server
    if (navigator.onLine && typeof checkServerConnectivity === 'function') {
        // Prefer to check server reachability before sending large payloads
        checkServerConnectivity().then((isActuallyOnline) => {
            if (isActuallyOnline) {
                submitPlantDetails(plantDetails);
            } else {
                savePlantOffline(plantDetails, originalPhoto);
            }
        }).catch(() => {
            // In case connectivity check fails, attempt submit if navigator.onLine
            submitPlantDetails(plantDetails);
        });
    } else if (navigator.onLine) {
        // No connectivity check available; attempt submit
        submitPlantDetails(plantDetails);
    } else {
        savePlantOffline(plantDetails, originalPhoto);
    }
}

function savePlantOffline(plantDetails, originalPhoto) {
    // Save offline metadata and basic file info to IndexedDB for later sync
    const timestamp = Date.now();
    const tempId = `offline_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const offlinePlantDetails = {
        ...plantDetails,
        _id: tempId,
        photo: originalPhoto ? { name: originalPhoto.name, size: originalPhoto.size, type: originalPhoto.type, lastModified: originalPhoto.lastModified } : null,
        __isServerPlant: false,
        __syncStatus: 'pending',
        __createdOffline: true,
        __lastSyncTime: null,
        __tempId: tempId
    };

    if (typeof openSyncPlantIDB === 'function' && typeof addNewPlantToSync === 'function') {
        openSyncPlantIDB().then((db) => {
            addNewPlantToSync(db, offlinePlantDetails).then(() => {
                alert('🌱 Plant saved offline! It will be synced when you are back online.');
                window.location.href = '/';
            }).catch((err) => {
                console.error('Error saving plant offline:', err);
                alert('❌ Error saving plant offline. Please try again.');
            });
        }).catch((err) => {
            console.error('Error opening sync DB:', err);
            alert('❌ Error saving plant offline. Please try again.');
        });
    } else {
        console.warn('Offline DB helpers not available; cannot save offline.');
        alert('Unable to save offline on this device. Please try again when online.');
    }
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

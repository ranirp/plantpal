/**
 * @fileoverview Add plant form handler with offline support.
 * Manages plant form submission with image compression, validation, and offline queueing.
 * Uses Web Workers for client-side image processing and IndexedDB for offline storage.
 * 
 * Key Features:
 * - Client-side image validation and compression via Web Worker
 * - Automatic offline detection and queue management
 * - Form validation with real-time feedback
 * - Character counter for description field
 * - Duplicate submission prevention
 * - Background sync for offline submissions
 */

let loggedInUser = null;
let imageWorker = null;
let compressedImageBlob = null;
let isSubmitting = false;

/**
 * Initialize add plant form page.
 * Sets up Web Worker, form handlers, user info, and UI components.
 */
function init() {
    initializeWebWorker();
    registerFormSubmit();
    getLoggedInUser();
    setupImagePreviewWithWorker();
    setupCharacterCounter();
}

/**
 * Retrieve logged-in user and populate nickname field.
 * Makes nickname field read-only to prevent tampering.
 */
function getLoggedInUser() {
    // Always try modern auth method first
    checkIfUserLoggedIn()
        .then((userName) => {
            if (userName && userName.value) {
                loggedInUser = userName.value;
                const nicknameField = document.getElementById("nickname");
                if (nicknameField && loggedInUser) {
                    nicknameField.value = loggedInUser;
                    nicknameField.readOnly = true;
                    nicknameField.style.backgroundColor = '#f3f4f6';
                    nicknameField.title = 'This is your logged-in username';
                }
            } else {
                // Fallback to legacy auth method
                getUserName()
                    .then((legacyName) => {
                        if (legacyName) {
                            loggedInUser = legacyName.value || legacyName;
                            const nicknameField = document.getElementById("nickname");
                            if (nicknameField && loggedInUser) {
                                nicknameField.value = loggedInUser;
                                nicknameField.readOnly = true;
                                nicknameField.style.backgroundColor = '#f3f4f6';
                                nicknameField.title = 'This is your logged-in username';
                            }
                        } else {
                            showNotification('Could not fetch your username. Please log in again.', 'error');
                        }
                    })
                    .catch(() => {
                        showNotification('Could not fetch your username. Please log in again.', 'error');
                    });
            }
        })
        .catch(() => {
            // Fallback to legacy auth method
            getUserName()
                .then((legacyName) => {
                    if (legacyName) {
                        loggedInUser = legacyName.value || legacyName;
                        const nicknameField = document.getElementById("nickname");
                        if (nicknameField && loggedInUser) {
                            nicknameField.value = loggedInUser;
                            nicknameField.readOnly = true;
                            nicknameField.style.backgroundColor = '#f3f4f6';
                            nicknameField.title = 'This is your logged-in username';
                        }
                    } else {
                        showNotification('Could not fetch your username. Please log in again.', 'error');
                    }
                })
                .catch(() => {
                    showNotification('Could not fetch your username. Please log in again.', 'error');
                });
        });
}

/**
 * Initialize Web Worker for image processing.
 * Worker handles validation, compression, and thumbnail generation.
 */
function initializeWebWorker() {
    if (window.Worker) {
        try {
            imageWorker = new Worker('/javascripts/workers/imageWorker.js');
            imageWorker.addEventListener('message', function(e) {
                const { type } = e.data || {};
                switch (type) {
                    case 'COMPRESS_SUCCESS':
                        compressedImageBlob = e.data.blob || null;
                        break;
                    case 'VALIDATION_ERROR':
                        if (Array.isArray(e.data.errors)) showNotification(e.data.errors.join('\n'), 'error');
                        break;
                    case 'VALIDATION_SUCCESS':
                        break;
                    case 'THUMBNAIL_SUCCESS':
                        break;
                    case 'ERROR':
                        showNotification('Error processing image: ' + e.data.message, 'error');
                        break;
                }
            });
            imageWorker.addEventListener('error', function(ev) {
                console.error('Web Worker error:', ev);
            });
        } catch (err) {
            imageWorker = null;
        }
    }
}

/**
 * Setup image input handler with preview and worker processing.
 * Validates file type, displays preview, and sends to worker for compression.
 */
function setupImagePreviewWithWorker() {
    // Get reference to photo input element
    const photoInput = document.getElementById("photoID");
    if (photoInput) {
        // Handle image file selection
        photoInput.addEventListener("change", function(event) {
            const file = event.target.files[0];
            const previewDiv = document.getElementById("imagePreview");
            const previewImg = document.getElementById("previewImg");
            if (file && imageWorker) {
                try {
                    imageWorker.postMessage({ type: 'VALIDATE_IMAGE', data: { name: file.name, size: file.size, type: file.type } });
                } catch (err) {}
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (previewImg && previewDiv) {
                        previewImg.src = e.target.result;
                        previewDiv.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
                try {
                    imageWorker.postMessage({ type: 'COMPRESS_IMAGE', data: { file: file, maxWidth: 800, maxHeight: 600, quality: 0.8 } });
                } catch (err) {}
            } else if (file) {
                showImagePreview(file);
                if (previewDiv) previewDiv.classList.remove('hidden');
            } else if (previewDiv) {
                previewDiv.classList.add('hidden');
            }
        });
    }
}

/**
 * Setup character counter for description field with visual feedback.
 * Changes color based on character count:
 * - Red: < 10 characters (invalid)
 * - Green: 10-1000 characters (valid)
 */
function setupCharacterCounter() {
    const descriptionField = document.getElementById("description");
    const charCount = document.getElementById("charCount");
    if (descriptionField && charCount) {
        descriptionField.addEventListener("input", function() {
            const count = descriptionField.value.length;
            charCount.textContent = count;
            if (count < 10) {
                charCount.parentElement.classList.add("text-red-500");
                charCount.parentElement.classList.remove("text-gray-500", "text-green-600");
            } else if (count >= 10 && count <= 1000) {
                charCount.parentElement.classList.add("text-green-600");
                charCount.parentElement.classList.remove("text-gray-500", "text-red-500");
            }
        });
        charCount.textContent = descriptionField.value.length;
    }
}

/**
 * Register form submit event handler with duplicate submission prevention.
 * Looks for form with ID "addPlantForm" or "plantForm".
 */
function registerFormSubmit() {
    const plantForm = document.getElementById("addPlantForm") || document.getElementById("plantForm");
    if (plantForm) {
        plantForm.addEventListener("submit", function(event) {
            event.preventDefault();
            if (isSubmitting) return;
            addNewPlantDetails();
        });
    }
}

/**
 * Process plant form submission.
 * - Validates required fields and description length
 * - Handles both online and offline submissions
 * - Shows loading state during submission
 * - Prevents duplicate submissions
 */
function addNewPlantDetails() {
    if (isSubmitting) return;
    isSubmitting = true;
    const submitButton = document.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.innerHTML : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
    }
    const plantName = document.getElementById("plantName") ? document.getElementById("plantName").value.trim() : '';
    const type = document.getElementById("type") ? document.getElementById("type").value : '';
    const description = document.getElementById("description") ? document.getElementById("description").value.trim() : '';
    const nickname = document.getElementById("nickname") ? document.getElementById("nickname").value.trim() : '';
    const photoInput = document.getElementById("photoID");
    const originalPhoto = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
    // Helper function to reset UI state after form submission (success or failure)
    const resetFormState = () => {
        isSubmitting = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    };
    const missing = [];
    if (!plantName) missing.push('Plant Name');
    if (!type) missing.push('Plant Type');
    if (!description) missing.push('Description');
    if (!nickname) missing.push('Nickname');
    if (missing.length) {
        showNotification('Please fill in all required fields: ' + missing.join(', '), 'info');
        resetFormState();
        return;
    }
    if (description.length < 10) {
        showNotification('Description must be at least 10 characters long.', 'info');
        resetFormState();
        return;
    }
    if (description.length > 1000) {
        showNotification('Description cannot exceed 1000 characters.', 'info');
        resetFormState();
        return;
    }
    // Use compressed image if available, otherwise use original
    const photoForUpload = compressedImageBlob || originalPhoto;
    
    // Prepare plant data for submission
    const plantDetails = {
        plantName,
        type,
        description,
        nickname,
        photo: photoForUpload,
        createdAt: new Date().toISOString()
    };
    // Check both browser online status and actual server connectivity
    if (navigator.onLine && typeof checkServerConnectivity === 'function') {
        checkServerConnectivity().then((isActuallyOnline) => {
            if (isActuallyOnline) {
                submitPlantDetails(plantDetails, resetFormState);
            } else {
                savePlantOffline(plantDetails, originalPhoto, resetFormState);
            }
        }).catch(() => {
            submitPlantDetails(plantDetails, resetFormState);
        });
    } else if (navigator.onLine) {
        submitPlantDetails(plantDetails, resetFormState);
    } else {
        savePlantOffline(plantDetails, originalPhoto, resetFormState);
    }
}

/**
 * Save plant data to IndexedDB for offline synchronization.
 * @param {Object} plantDetails - The plant details to save
 * @param {File} originalPhoto - Original photo file before compression
 * @param {Function} resetFormState - Callback to reset form UI state
 */
function savePlantOffline(plantDetails, originalPhoto, resetFormState) {
    // Generate unique temporary ID for offline storage
    const timestamp = Date.now();
    const tempId = `offline_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add offline-specific metadata to plant details
    const offlinePlantDetails = {
        ...plantDetails,
        _id: tempId,
        photo: originalPhoto || null,
        __isServerPlant: false,
        __syncStatus: 'pending',
        __createdOffline: true,
        __lastSyncTime: null,
        __tempId: tempId
    };
    if (typeof openSyncPlantIDB === 'function' && typeof addNewPlantToSync === 'function') {
        openSyncPlantIDB().then((db) => {
            addNewPlantToSync(db, offlinePlantDetails).then(() => {
                resetFormState();
                showNotification('🌱 Plant saved offline! It will be synced when you are back online.', 'success', () => {
                    window.location.href = '/';
                });
            }).catch(() => {
                resetFormState();
                showNotification('❌ Error saving plant offline. Please try again.', 'error');
            });
        }).catch(() => {
            resetFormState();
            showNotification('❌ Error saving plant offline. Please try again.', 'error');
        });
    } else {
        resetFormState();
        showNotification('Unable to save offline on this device. Please try again when online.', 'error');
    }
}

/**
 * Submit plant details to server using FormData and fetch API.
 * @param {Object} plantDetails - Plant details including name, type, description, photo
 * @param {Function} resetFormState - Callback to reset form UI state
 */
function submitPlantDetails(plantDetails, resetFormState) {
    const formData = new FormData();
    formData.append("plantName", plantDetails.plantName);
    formData.append("type", plantDetails.type);
    formData.append("description", plantDetails.description);
    formData.append("nickname", plantDetails.nickname);
    if (plantDetails.photo) {
        formData.append("photo", plantDetails.photo);
    }
    
    fetch("/api/plants/addNewPlant", {
        method: "POST",
        body: formData
    })
    .then(response => {
        return response.json().then(data => {
            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || "Error submitting plant details");
            }
        });
    })
    .then(() => {
        resetFormState();
        showNotification("🌱 Plant shared successfully!", 'success', () => {
            // Clear cache and redirect with timestamp to force refresh
            if ('caches' in window) {
                caches.delete('plant-cache').then(() => {
                    window.location.href = "/?refresh=" + Date.now();
                });
            } else {
                window.location.href = "/?refresh=" + Date.now();
            }
        });
    })
    .catch(error => {
        resetFormState();
        const errorMessage = error.message.replace(/https?:\/\/[^\/]+/g, '');
        showNotification("❌ Error: Please check your input and try again.", 'error');
        console.error('Submission error:', errorMessage);
    });
}

/**
 * Listen for online events to trigger synchronization of offline plants.
 * Checks for pending offline plants and initiates sync when connection is restored.
 */
function listenForOnlineSync() {
    window.addEventListener("online", async() => {
        const isTherePlantsToSync = await checkIfThereIsPlantsAndUpdate();
        if (!isTherePlantsToSync) {
            console.log('No pending plants to sync');
        }
    });
}

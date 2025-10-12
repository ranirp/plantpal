/**
 * @fileoverview Homepage plant list rendering utilities.
 * Creates dynamic plant card UI elements from plant data.
 * Handles both online (server) and offline (IndexedDB) plant display.
 * Generates temporary IDs for offline plants and manages empty state UI.
 */

const placeHolderImage = '/images/placeholder.jpg';

/**
 * Format plant name with title case (first letter of each word capitalized)
 * @param {string} name - Plant name to format
 * @returns {string} Formatted plant name
 */
function formatPlantName(name) {
    if (!name) return '';
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Generate unique temporary ID for offline plants.
 * Creates identifier from plant properties for consistent offline tracking.
 * 
 * @param {Object} plant - Plant object with plantName, nickname, createdAt
 * @returns {string|null} Offline plant ID or null if invalid
 */
function generateOfflinePlantId(plant) {
    if (!plant || !plant.plantName) {
        return null;
    }
    
    // Create a temporary ID based on plant name, nickname, and creation time
    const timestamp = plant.createdAt || plant.dateAdded || Date.now();
    const nickname = plant.nickname || 'unknown';
    const plantName = plant.plantName;
    
    // Create a simple hash-like identifier
    const tempId = `offline_${plantName}_${nickname}_${timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_');
    return tempId;
}

/**
 * Render plant cards in grid layout.
 * Clears existing content and displays plant cards or empty state message.
 * 
 * @param {Array} plantList - Array of plant objects to display
 */
function renderPlantList(plantList) {
    console.log("🎨 renderPlantList called");
    console.log("📊 Number of plants to render:", plantList ? plantList.length : 0);
    console.log("🌱 Plants data:", plantList);
    
    // Access the container element where plant cards will be displayed
    const plantListContainer = document.getElementById('plantList');
    console.log("📦 Plant list container found:", !!plantListContainer);
    
    if (!plantListContainer) {
        console.error("❌ CRITICAL: plantList container not found in DOM!");
        return;
    }

    // Clear the container to avoid duplicates
    plantListContainer.innerHTML = '';

    // Add grid classes for 3-column layout
    plantListContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-2 py-4";

    // Check if there are no plants to display
    if (plantList.length === 0) {
        console.log("No plants to display, showing empty message");
        const noMessagesDiv = document.createElement("div");

        // Add classes for styling 'no plants' message
        noMessagesDiv.classList.add(
            "col-span-full",
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "py-20"
        );

        // Create an image element for the 'no plants' message
        const noMessagesImage = document.createElement("img");
        noMessagesImage.src = "/images/noplant.jpg";
        noMessagesImage.alt = "No Plants";
        noMessagesImage.classList.add("w-[400px]", "mb-8");

        // Create a text element for the 'no plants' message
        const noMessagesText = document.createElement("div");
        noMessagesText.textContent = "No plants Found";
        noMessagesText.classList.add("text-3xl", "font-semibold", "text-gray-500");

        // Create a subtitle
        const subtitle = document.createElement("div");
        subtitle.textContent = "Start sharing your plants with the community!";
        subtitle.classList.add("text-lg", "text-gray-400", "mt-2");

        // Append the image and text to the message div
        noMessagesDiv.appendChild(noMessagesImage);
        noMessagesDiv.appendChild(noMessagesText);
        noMessagesDiv.appendChild(subtitle);

        // Append the message div to the container
        plantListContainer.appendChild(noMessagesDiv);
    } else {
        // If plants exist, iterate through list and create a card for each plant
        plantList.forEach(function(plant) {
            const card = createdCard(plant);
            card.className = card.className.replace('max-w-xs', '');
            plantListContainer.appendChild(card); 
        });
    }
}

/**
 * Create individual plant card DOM element.
 * Builds card with image, title, type, description, and action button.
 * Handles both online and offline plant display modes.
 * 
 * @param {Object} plant - Plant object with all properties
 * @returns {HTMLElement} Complete plant card div element
 */
function createdCard(plant) {
    var card = document.createElement('div');

    // Determine photo path
    let photoPath;
    const isTrulyOfflinePlant = !plant._id && plant.photo && typeof plant.photo === 'object' && plant.photo.type;
    
    if (isTrulyOfflinePlant) {
        // Offline uploaded image
        photoPath = '/images/offlineimage.png';
    } else if (plant.photo && typeof plant.photo === 'string') {
        // Server uploaded image
        photoPath = '/images/uploads/' + plant.photo;
    } else {
        // No photo or null photo
        photoPath = placeHolderImage;
    }

    // Check if this is an offline plant
    const plantId = plant._id || plant.id || plant.plantId;
    const isOfflinePlant = !plantId || (typeof plantId === 'string' && plantId.startsWith('offline_'));
    
    // Add classes for compact card styling 
    let cardClasses = "w-full mx-auto bg-gray-200 border border-gray-400 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden";
    if (isOfflinePlant) {
        // Offline plants get a different style and no hover effect
        cardClasses += " opacity-75 cursor-not-allowed border-2 border-dashed border-yellow-400";
    } else {
        // Online plants are clickable
        cardClasses += " cursor-pointer";
    }
    card.className = cardClasses;
    
    // Set the onclick event to show plant details page
    card.onclick = function() {
        // Try to get any valid ID from the plant object
        const plantId = plant._id || plant.id || plant.plantId;
        
        if (plantId) {
            // Plant has a valid ID (can be offline or server), navigate to details page
            console.log('Navigating to plant details with ID:', plantId);
            showDetailsPage(plantId);
        } else {
            // For plants without any ID (corrupted data)
            console.error('Plant without any ID found:', plant);
            if (typeof showNotification === 'function') {
                showNotification('⚠️ Unable to view this plant.\n\nThis plant data appears to be incomplete. Please try refreshing the page.', 'error');
            } else {
                alert('⚠️ Unable to view this plant.\n\nThis plant data appears to be incomplete. Please try refreshing the page.');
            }
        }
    };

    // Create image container with 3:2 aspect ratio
    var imageContainer = document.createElement('div');
    imageContainer.className = "w-full h-48 relative overflow-hidden";

    // Create an image element for the plant photo
    var img = document.createElement('img');
    img.src = photoPath;
    img.alt = plant.plantName;

    // Set the placeholder image if the photo fails to load
    img.onerror = function() {
        this.onerror = null; // Prevent infinite loop if placeholder also fails
        this.src = placeHolderImage;
    };

    // Add classes for styling the image 
    img.className = "w-full h-full object-cover hover:scale-105 transition-transform duration-300";

    // Append the image to the container
    imageContainer.appendChild(img);

    // Create compact details container
    var detailsContainer = document.createElement('div');
    detailsContainer.className = "p-2";

    // Create and set the plant name - compact
    var title = document.createElement('h3');
    title.className = "font-semibold text-gray-800 text-base mb-1 truncate";
    title.textContent = formatPlantName(plant.plantName);

    // Create date/time element - compact
    var dateElement = document.createElement('p');
    dateElement.className = "text-sm text-gray-500";
    let formattedDate = 'Date not available';
    let formattedTime = '';
    
    if (plant.createdAt || plant.dateAdded) {
        try {
            const date = new Date(plant.createdAt || plant.dateAdded);
            formattedDate = date.toLocaleDateString();
            formattedTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (error) {
            console.error('Error formatting date for plant:', plant, error);
            formattedDate = 'Invalid date';
        }
    }
    dateElement.textContent = `Date/Time: ${formattedDate} ${formattedTime}`;

    // Append elements to details container
    detailsContainer.appendChild(title);
    detailsContainer.appendChild(dateElement);

    // Append image container and details to the card
    card.appendChild(imageContainer);
    card.appendChild(detailsContainer);

    // Return the constructed card element
    return card;
}

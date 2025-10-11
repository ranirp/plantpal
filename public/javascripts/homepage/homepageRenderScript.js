var placeHolderImage = '/images/placeholder.jpg';

/**
 * Generate a temporary ID for offline plants based on their properties
 * @param {Object} plant - Plant object
 * @returns {string|null} - Generated temporary ID or null if unable to generate
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

// Function to render the list of plants
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

    // Check if there are no plants to display
    if (plantList.length === 0) {
        console.log("No plants to display, showing empty message");
        // If no plants, create a message indicating no plants have been added
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
            plantListContainer.appendChild(card); 
        });
    }
}

// Function to create a card element for a plant
function createdCard(plant) {
    var card = document.createElement('div');

    // Determine photo path
    let photoPath;
    
    // A plant is considered truly offline if:
    // 1. It has no server _id AND
    // 2. It has photo metadata with type (indicating offline upload)
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
    
    // Add classes for styling the card
    let cardClasses = "card shadow-lg bg-white transition-shadow";
    if (isOfflinePlant) {
        // Offline plants get a different style and no hover effect
        cardClasses += " opacity-75 cursor-not-allowed border-2 border-dashed border-yellow-400";
    } else {
        // Online plants are clickable
        cardClasses += " cursor-pointer hover:shadow-xl";
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
            alert('⚠️ Unable to view this plant.\n\nThis plant data appears to be incomplete. Please try refreshing the page.');
        }
    };

    // Create figure for image
    var figure = document.createElement('figure');
    figure.className = "px-4 pt-4";

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
    img.className = "w-full h-48 object-cover rounded-lg";

    // Append the image to the figure
    figure.appendChild(img);

    // Create card body for plant details
    var cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Create and set the plant name
    var title = document.createElement('h3');
    title.className = "card-title text-lg font-bold";
    title.textContent = plant.plantName;

    // Create badges container
    var badgesContainer = document.createElement('div');
    badgesContainer.className = "flex gap-2 mt-2 flex-wrap";
    
    // Create type badge
    var typeBadge = document.createElement('div');
    typeBadge.className = "badge badge-primary capitalize";
    typeBadge.textContent = plant.type;
    badgesContainer.appendChild(typeBadge);
    
    // Add sync status badge for offline plants
    if (isOfflinePlant) {
        var syncBadge = document.createElement('div');
        syncBadge.className = "badge badge-warning gap-1";
        syncBadge.innerHTML = '<i class="fas fa-sync-alt"></i> Pending Sync';
        badgesContainer.appendChild(syncBadge);
    }

    // Create info container
    var infoDiv = document.createElement('div');
    infoDiv.className = "mt-3 space-y-1";

    // Create and set the nickname
    var nickname = document.createElement('p');
    nickname.className = "text-sm text-gray-600";
    nickname.innerHTML = '<i class="fas fa-user mr-2"></i>' + plant.nickname;

    // Create and set the creation date
    var dateElement = document.createElement('p');
    dateElement.className = "text-sm text-gray-600";
    let formattedDate = 'Date not available';
    if (plant.createdAt) {
        try {
            formattedDate = new Date(plant.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date for plant:', plant, error);
            formattedDate = 'Invalid date';
        }
    }
    dateElement.innerHTML = '<i class="fas fa-calendar-alt mr-2"></i>' + formattedDate;

    // Create description preview
    var description = document.createElement('p');
    description.className = "text-sm text-gray-700 mt-2 line-clamp-2";
    description.textContent = plant.description;

    // Append elements to info div
    infoDiv.appendChild(nickname);
    infoDiv.appendChild(dateElement);

    // Append all elements to card body
    cardBody.appendChild(title);
    cardBody.appendChild(badgesContainer);
    cardBody.appendChild(infoDiv);
    cardBody.appendChild(description);

    // Append figure and card body to the card
    card.appendChild(figure);
    card.appendChild(cardBody);

    // Return the constructed card element
    return card;
}

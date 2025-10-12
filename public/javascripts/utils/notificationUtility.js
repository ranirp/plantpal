/**
 * @fileoverview Custom notification utility to replace alert() across the application
 * Provides a consistent, customizable notification system that avoids showing localhost URLs
 */

/**
 * Show a custom notification modal (replaces alert())
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 * @param {function} callback - Optional callback function after user clicks OK
 */
function showNotification(message, type = 'info', callback = null) {
    // Remove any existing notification
    const existingModal = document.getElementById('customNotificationModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'customNotificationModal';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.2s ease-in;
    `;

    // Determine icon and color based on type
    let icon, iconColor, borderColor;
    switch(type) {
        case 'success':
            icon = '✅';
            iconColor = '#10b981';
            borderColor = '#10b981';
            break;
        case 'error':
            icon = '❌';
            iconColor = '#ef4444';
            borderColor = '#ef4444';
            break;
        default:
            icon = 'ℹ️';
            iconColor = '#3b82f6';
            borderColor = '#3b82f6';
    }

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-top: 4px solid ${borderColor};
        animation: slideIn 0.3s ease-out;
    `;

    modalContent.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
            <p style="font-size: 16px; color: #374151; margin-bottom: 24px; white-space: pre-line; line-height: 1.5;">
                ${message}
            </p>
            <button 
                id="notificationOkBtn" 
                style="
                    background-color: ${iconColor};
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 12px 32px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                "
                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 10px 15px -3px rgba(0, 0, 0, 0.1)';"
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 6px -1px rgba(0, 0, 0, 0.1)';"
            >
                OK
            </button>
        </div>
    `;

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { 
                transform: translateY(-50px);
                opacity: 0;
            }
            to { 
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Handle OK button click
    const okButton = document.getElementById('notificationOkBtn');
    okButton.addEventListener('click', function() {
        modalOverlay.remove();
        if (callback) {
            callback();
        }
    });

    // Handle ESC key
    function handleEscape(e) {
        if (e.key === 'Escape') {
            modalOverlay.remove();
            document.removeEventListener('keydown', handleEscape);
            if (callback) {
                callback();
            }
        }
    }
    document.addEventListener('keydown', handleEscape);

    // Focus the OK button for accessibility
    okButton.focus();
}

// Make the function available globally
window.showNotification = showNotification;
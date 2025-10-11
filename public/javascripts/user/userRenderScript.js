/**
 * @fileoverview User UI rendering utilities.
 * Manages login modal, logout button, and welcome message display.
 * Handles UI state changes based on user authentication status.
 * 
 * Key Features:
 * - Login modal management
 * - Logout button visibility toggle
 * - Welcome message with capitalized username
 * - UI synchronization with auth state
 */

/**
 * Handle user logout UI changes.
 * Shows login modal and hides authenticated UI elements.
 */
function onUserLoggedOut() {
    const loginUserModel = document.getElementById("loginUserModel");
    if (loginUserModel) {
        loginUserModel.showModal();
    }
    toggleLogoutButton(false);
    toggleWelcomeText(false);
}

/**
 * Handle user login UI changes.
 * Closes login modal and shows authenticated UI elements.
 */
function onUserLoggedIn() {
    const loginUserModel = document.getElementById("loginUserModel");
    if (loginUserModel) {
        loginUserModel.close();
    }
    toggleLogoutButton(true);
    toggleWelcomeText(true);
}

/**
 * Toggle logout button visibility.
 * @param {boolean} shouldShow - Whether to show the button
 */
function toggleLogoutButton(shouldShow) {
    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
        logoutButton.classList.toggle("hidden", !shouldShow);
    }
}

/**
 * Toggle welcome text visibility and update with username.
 * Capitalizes first letter of username for display.
 * @param {boolean} shouldShow - Whether to show the welcome text
 */
function toggleWelcomeText(shouldShow) {
    const userWelcomeText = document.getElementById("welcomeUserText");
    if (userWelcomeText) {
        const formatName = (name) => {
            if (!name) return '';
            const s = String(name).trim();
            return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        };
        userWelcomeText.innerText = loggedInUser ? `${formatName(loggedInUser)}` : '';
        userWelcomeText.classList.toggle("hidden", !shouldShow);
    }
}

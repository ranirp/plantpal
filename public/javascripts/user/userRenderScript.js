function onUserLoggedOut() {
    const loginUserModel = document.getElementById("loginUserModel");
    if (loginUserModel) {
        loginUserModel.showModal();
    }
    toggleLogoutButton(false);
    toggleWelcomeText(false);
}

function onUserLoggedIn() {
    const loginUserModel = document.getElementById("loginUserModel");
    if (loginUserModel) {
        loginUserModel.close();
    }
    toggleLogoutButton(true);
    toggleWelcomeText(true);
}

function toggleLogoutButton(shouldShow) {
    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
        logoutButton.classList.toggle("hidden", !shouldShow);
    }
}

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

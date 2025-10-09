var loggedInUser;

function logout() {
    return deleteAllUsers().then(() => {
        loggedInUser = null;
        onUserLoggedOut();
    });
}

function logInUser() {
    var loginInTextField = document.getElementById("userName");
    var userName = loginInTextField.value;
    loginInTextField.value = "";
    return addUserToIDB(userName).then(() => {
        loggedInUser = userName;
        onUserLoggedIn();
    });
}

function checkIfUserLoggedIn() {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                getUserName(db)
                    .then((userName) => {
                        if (userName && userName.value) {
                            loggedInUser = userName.value;
                            onUserLoggedIn();
                            resolve(userName);
                        } else {
                            console.log("No user found in IndexedDB, showing login modal");
                            onUserLoggedOut();
                            resolve(null);
                        }
                    })
                    .catch((error) => {
                        console.error("Error getting username:", error);
                        onUserLoggedOut();
                        reject(error);
                    });
                })
            .catch((error) => {
                console.error("Error initializing user IDB:", error);
                onUserLoggedOut();
                reject(error);
            });
    });
}

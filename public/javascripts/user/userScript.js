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
                        if (userName) {
                            loggedInUser = userName.value;
                            onUserLoggedIn();
                            resolve(userName);
                        } else {
                            onUserLoggedOut();
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
                })
            .catch((error) => {
                reject(error);
            });
    });
}

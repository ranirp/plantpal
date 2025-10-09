exports.init = function (io) {
    let userCounts = {}; // Initialize user count object

    io.sockets.on('connection', function (socket) {
        try {
            socket.on('createorjoin', function (plantID, userID) {
                socket.join(plantID);
                const userCountID = plantID + userID; // Unique identifier for user count
                if (!userCounts[userCountID]) {
                    userCounts[userCountID] = 0;
                }
                userCounts[userCountID]++;
                console.log('User joined. Total users for plantID ' 
                    + plantID + ': ' + userCounts[userCountID]);
                io.sockets
                    .to(plantID)
                    .emit('joined', plantID, userID, userCounts[userCountID]); // Pass the user count in the joined event
                });

            socket.on('chat', function (message) {
                io.sockets.to(message.plantID).emit('chatmessage', message);
            });

            socket.on('disconnect', function () {
                const plantID = Object.keys(socket.rooms)[1]; // Get the plantID from the socket rooms
                const userCountID = plantID + socket.id; // Unique identifier for user count
                if (userCounts[userCountID]) {
                    userCounts[userCountID]--; // Decrement user count for the userCountID
                    console.log(
                        'User disconnected. Total users for plantID ' +
                            plantID + ': ' + userCounts[userCountID]);
                    io.sockets
                        .to(plantID)
                        .emit('left', plantID, null, userCounts[userCountID]);
                }
            });
        } catch (e) {
            console.log(e);
        }
    });
};
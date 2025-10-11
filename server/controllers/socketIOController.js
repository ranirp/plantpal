exports.init = function (io) {
    let roomUserCounts = {}; // Track user count per plant/room

    io.sockets.on('connection', function (socket) {
        try {
            socket.on('createorjoin', function (plantID, userID) {
                socket.join(plantID);
                
                // Store plantID on socket for later use
                socket.plantID = plantID;
                socket.userID = userID;
                
                // Increment user count for this plant room
                if (!roomUserCounts[plantID]) {
                    roomUserCounts[plantID] = 0;
                }
                roomUserCounts[plantID]++;
                
                console.log('User ' + userID + ' joined plant room ' + plantID + 
                    '. Total users: ' + roomUserCounts[plantID]);
                
                io.sockets
                    .to(plantID)
                    .emit('joined', plantID, userID, roomUserCounts[plantID]);
            });

            socket.on('chat', function (message) {
                console.log('Chat message in room ' + message.plantId + ':', message);
                io.sockets.to(message.plantId).emit('chatmessage', message);
            });

            socket.on('disconnect', function () {
                const plantID = socket.plantID;
                const userID = socket.userID;
                
                if (plantID && roomUserCounts[plantID]) {
                    roomUserCounts[plantID]--;
                    
                    console.log('User ' + userID + ' disconnected from plant room ' + plantID + 
                        '. Total users: ' + roomUserCounts[plantID]);
                    
                    // Clean up if no users left
                    if (roomUserCounts[plantID] <= 0) {
                        delete roomUserCounts[plantID];
                    }
                    
                    io.sockets
                        .to(plantID)
                        .emit('left', plantID, userID, roomUserCounts[plantID]);
                }
            });
        } catch (e) {
            console.log('Socket error:', e);
        }
    });
};
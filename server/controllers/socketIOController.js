/**
 * @fileoverview Socket.IO controller for real-time chat functionality.
 * Manages WebSocket connections, chat rooms per plant, and user presence tracking.
 * Implements plant-specific chat rooms with join/leave notifications.
 * 
 * @requires socket.io - Real-time bidirectional event-based communication
 */

/**
 * Initialize Socket.IO event handlers.
 * Sets up connection, room management, chat messaging, and disconnection handlers.
 * 
 * @param {Object} io - Socket.IO server instance
 */
exports.init = function (io) {
    let roomUserCounts = {};

    io.sockets.on('connection', function (socket) {
        try {
            /**
             * Handle user joining a plant-specific chat room.
             * @event createorjoin
             * @param {string} plantID - Plant ID (used as room identifier)
             * @param {string} userID - User nickname
             */
            socket.on('createorjoin', function (plantID, userID) {
                socket.join(plantID);
                
                socket.plantID = plantID;
                socket.userID = userID;
                
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

            /**
             * Handle incoming chat messages and broadcast to room.
             * @event chat
             * @param {Object} message - Chat message object with plantId, userID, text, timestamp
             */
            socket.on('chat', function (message) {
                console.log('Chat message in room ' + message.plantId + ':', message);
                io.sockets.to(message.plantId).emit('chatmessage', message);
            });

            /**
             * Handle user disconnection and room cleanup.
             * @event disconnect
             */
            socket.on('disconnect', function () {
                const plantID = socket.plantID;
                const userID = socket.userID;
                
                if (plantID && roomUserCounts[plantID]) {
                    roomUserCounts[plantID]--;
                    
                    console.log('User ' + userID + ' disconnected from plant room ' + plantID + 
                        '. Total users: ' + roomUserCounts[plantID]);
                    
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
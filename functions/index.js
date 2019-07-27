const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
 
admin.initializeApp();

// firebase function to get current server timestamp
exports.getServerTime = functions.https.onRequest((request, response ) => {
    return cors(request, response, () => {
        const serverTime = Date.now();
        return response.send({time: serverTime});
    });
});


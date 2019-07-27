require('dotenv').config();

// get server timestamp by fetching from the server
const getServerTime = async () => {
    //console.log(process.env.firebase_url);
    try {
        const API = 'https://us-central1-alc-dev-toolkit-d50fe.cloudfunctions.net';
        const response = await fetch(`${API}/getServerTime`);
        const { time } = await response.json();
        return time;
    } catch (error) {
        console.warn(error);
    }
};

export default getServerTime;


require('dotenv').config();

// get server timestamp by fetching from the server
const getServerTime = async() => {
    const response = await fetch(process.env.firebase_url);
    const data = await response.json();
    const  { time } = data; 
    return time;
};

export default getServerTime;


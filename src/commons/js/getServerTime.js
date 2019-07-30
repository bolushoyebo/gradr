import dotenv from 'dotenv';

dotenv.config();

// get server timestamp by fetching from the server
const getServerTime = async () => {
    try {
        const response = await fetch(process.env.firebaseURL);
        const { time } = await response.json();
        return time;
    } catch (error) {
        console.warn(error);
        return undefined;
    }
};

export default getServerTime;


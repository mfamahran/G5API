import { initializeApp, FirebaseOptions } from "firebase/app";
import { getDatabase } from "firebase/database";
import config from 'config';

const firebaseConfig = {
    apiKey: config.get("firebase.apiKey"),
    authDomain: config.get("firebase.authDomain"),
    databaseURL: config.get("firebase.databaseURL"),
    projectId: config.get("firebase.projectId"),
    storageBucket: config.get("firebase.storageBucket"),
    messagingSenderId: config.get("firebase.messagingSenderId"),
    appId: config.get("firebase.appId")
} as FirebaseOptions;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
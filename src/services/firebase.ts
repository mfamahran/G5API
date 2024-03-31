import { initializeApp, FirebaseOptions } from "firebase/app";
import { getDatabase, ref as dataRef, push, onValue, set, get, remove } from "firebase/database";
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
const fdb = getDatabase(app);
class Database {
    async addToQueue(player: User) {
        try {
            const queueRef = dataRef(fdb, "queue");
            onValue(
                queueRef,
                snapshot => {
                  let queue: Queue = snapshot.val() || { players: [], matchFound: false, team1: [], team2: [] };
                  let inQueue = false;
                  console.log(player.steam_id);
                  Object.values(queue.players).forEach(queuedPlayer => {
                    if (queuedPlayer.steam_id === player.steam_id) {
                      inQueue = true;
                    }
                  });
                  if (!inQueue) {
                    // Player not in queue, add them
                    if (queue?.players === undefined) {
                      queue.players = new Array<User>();
                    }
                    queue.players.push(player);
                    set(queueRef, queue);
                  } else {
                    // Handle the case where player is already in the queue
                    throw "Player already in queue";
                  }
                },
                {
                  onlyOnce: true // This ensures the listener is removed after it receives a value
                }
            );
        } catch (err) {
          throw err;
        }
    }

    async removeFromQueue(player: User) {
        try {
            const queueRef = dataRef(fdb, "queue");
            onValue(
                queueRef,
                snapshot => {
                  let queue: Queue = snapshot.val() || { players: [], matchFound: false, team1: [], team2: [] };
                  // let updatedQueue: { [key: string]: any } = {};
                  // Filter out the logged-in player
                  queue.players = queue.players.filter(
                    queuedPlayer => queuedPlayer.steam_id !== player.steam_id
                  );
                  // Update the queue in Firebase
                  if (queue.players.length === 0) {
                    remove(queueRef);
                  } else {
                    set(queueRef, queue);
                  }
                },
                {
                  onlyOnce: true // Ensure this is only run once and not left on as a listener
                }
            );
        } catch (err) {
          throw err;
        }
    }

    async updateQueue(queue: Queue): Promise<void> {
        const queueRef = dataRef(fdb, "queue");
        set(queueRef, queue);
    }

    async watchQueue(): Promise<void> {
        const queueRef = dataRef(fdb, "queue");
        onValue(
            queueRef,
            snapshot => {
              const queue = snapshot.val();
            },
            {
              onlyOnce: false
            }
        );
    }

    // function to get the queue
    async getQueue(): Promise<Queue> {
        const queueRef = dataRef(fdb, "queue");
        const snapshot = await get(queueRef);
        return snapshot.val();
    }
}

let db = new Database();
export { db, fdb };
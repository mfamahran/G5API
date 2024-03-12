import { Router } from "express";
import {db} from "../services/firebase.js";
import { ref as dataRef, push, onValue, set } from "firebase/database";
import Utils from "../utility/utils.js";

const router = Router();
/* Swagger shared definitions */

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     NewMap:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: System identifier of a map.
 *         steam_id:
 *           type: string
 *           description: Foreign Key User ID.
 *         map_name:
 *           type: string
 *           description: The technical name of the map. This usually starts with de_.
 *         map_display_name:
 *           type: string
 *           description: The display name that a user wishes to show.
 *         enabled:
 *           type: boolean
 *           description: Value representing whether the map is used or not. Defaults to true,
 *         inserted_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of when a new map was inserted.
 *     Queue:
 *       allOf:
 *         - $ref: '#/components/schemas/NewMap'
 *         - type: object
 *           properties:
 *             id:
 *               type: integer
 *             steam_id:
 *               type: string
 *             username:
 *               type: string
 *             avatar:
 *               type: string
 *             date:
 *               type: string  
 */

/**
 * @swagger
 *
 * /queue/:
 *   get:
 *     description: Get queue.
 *     produces:
 *       - text/event-stream
 *     tags:
 *       - queue
 *     responses:
 *       200:
 *         description: Queue
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Queue'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
router.get("/", async (req, res) => {
    try {
      const queueRef = dataRef(db, "queue");
      res.set({
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no"
      });
      res.flushHeaders();
      let queueString = `event: queue\ndata: ${JSON.stringify([])}\n\n`;
      onValue(
        queueRef,
        snapshot => {
          const queue = snapshot.val() || {};
          // Check if the player is already in the queue
          let players = Object.values(queue);
          players = players.map((v) => Object.assign({}, v));
          queueString = `event: queue\ndata: ${JSON.stringify(players)}\n\n`;
          res.write(queueString);
        },
        {
          onlyOnce: false
        }
      );
      req.on("close", () => {
            res.end();
        });
        
        req.on("disconnect", () => {
        res.end();
        });
      

      
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.toString() });
    }
});

router.post("/join", Utils.ensureAuthenticated, async (req, res, next) => {
    try {
        const queueRef = dataRef(db, "queue");
        onValue(
            queueRef,
            snapshot => {
              const queue = snapshot.val() || {};
              let inQueue = false;
              // Check if the player is already in the queue
              Object.values(queue).forEach(queuedPlayer => {
                if (queuedPlayer.steam_id === req.user.steam_id) {
                  inQueue = true;
                }
              });
    
              if (!inQueue) {
                // Player not in queue, add them
                const date = new Date().toISOString();
                push(queueRef, {
                  date: date,
                  steam_id: req.user.steam_id,
                  username: req.user.name,
                  avatar: req.user.medium_image
                });
              } else {
                // Handle the case where player is already in the queue
                res.status(405).json({ message: "Player already in queue" });
              }
            },
            {
              onlyOnce: true // This ensures the listener is removed after it receives a value
            }
        );
        res.status(200).json({ message: "You have joined the queue" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});

router.post("/join", Utils.ensureAuthenticated, async (req, res, next) => {
    try {
        const queueRef = dataRef(db, "queue");
        onValue(
            queueRef,
            snapshot => {
              const queue = snapshot.val() || {};
              let inQueue = false;
              // Check if the player is already in the queue
              Object.values(queue).forEach(queuedPlayer => {
                if (queuedPlayer.steam_id === req.user.steam_id) {
                  inQueue = true;
                }
              });
    
              if (!inQueue) {
                // Player not in queue, add them
                const date = new Date().toISOString();
                push(queueRef, {
                  date: date,
                  steam_id: req.user.steam_id,
                  username: req.user.name,
                  avatar: req.user.medium_image
                });
              } else {
                // Handle the case where player is already in the queue
                res.status(405).json({ message: "Player already in queue" });
              }
            },
            {
              onlyOnce: true // This ensures the listener is removed after it receives a value
            }
        );
        res.status(200).json({ message: "You have joined the queue" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});router.post("/leave", Utils.ensureAuthenticated, async (req, res, next) => {
    try {
        const queueRef = dataRef(db, "queue");
        onValue(
            queueRef,
            snapshot => {
              const queue = snapshot.val();
              let updatedQueue = {};
    
              // Filter out the logged-in player
              Object.keys(queue).forEach(key => {
                if (queue[key].steam_id !== req.user.steam_id) {
                  updatedQueue[key] = queue[key];
                }
              });
    
              // Update the queue in Firebase
              set(queueRef, updatedQueue);
    
              // Update local state if necessary
            },
            {
              onlyOnce: true // Ensure this is only run once and not left on as a listener
            }
          );
        res.status(200).json({ message: "You have left the queue" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});

export default router;
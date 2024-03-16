import { Router } from "express";
import {db, fdb} from "../services/firebase.js";
import { ref as dataRef, push, onValue, set } from "firebase/database";
import Utils from "../utility/utils.js";
import {fork} from 'child_process';

const router = Router();
const child = fork('./src/utility/child.js');
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
      const queueRef = dataRef(fdb, "queue");
      res.set({
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no"
      });
      res.flushHeaders();
      let queueString = `event: queue\ndata: ${JSON.stringify([])}\n\n`;
      let gQueue = {};
      onValue(
        queueRef,
        snapshot => {
          const queue = snapshot.val() || {};
          if (queue.players === undefined) {
            queue.players = [];
          }
          gQueue = queue;
          queueString = `event: queue\ndata: ${JSON.stringify(queue)}\n\n`;
          res.write(queueString);
        },
        {
          onlyOnce: false
        }
      );

      child.on("message", async (msg) => {
        if (msg.action === "MATCH_FOUND") {
          console.log("Match found, updating queue");
          gQueue.matchFound = true;
          gQueue.team1Captain = msg.captains[0];
          gQueue.team2Captain = msg.captains[1];
          gQueue.playersMatch = msg.playersMatch;
          gQueue.players = [];
          console.log(gQueue);
          await db.updateQueue(gQueue);
        } 
      });
      
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
        await db.addToQueue(req.user);
        const player = req.user;
        child.send({ action: 'JOIN_QUEUE', player });
        res.status(200).json({ message: "You have joined the queue" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});

router.post("/leave", Utils.ensureAuthenticated, async (req, res, next) => {
    const player = req.user;
    try {
        db.removeFromQueue(req.user);
        child.send({ action: 'LEAVE_QUEUE', player });
        res.status(200).json({ message: "You have left the queue" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});

router.post("/pick", Utils.ensureAuthenticated, async (req, res, next) => {
    try {
        let queue = req.body;
        queue.team1 = queue.team1.players;
        queue.team2 = queue.team2.players;
        let team1 = req.body.team1.players;
        let team2 = req.body.team2.players;
        if (queue.team1.length === 1 && queue.team2.length === 0) {
          queue.turn = 'team2';
        } else if (queue.team1.length === 1 && queue.team2.length === 1) {
          queue.turn = 'team1';
        } else if (queue.team1.length === 2 && queue.team2.length === 1) {
          queue.turn = 'team1';
        } else if (queue.team1.length === 3 && queue.team2.length === 1) {
          queue.turn = 'team2';
        } else if (queue.team1.length === 3 && queue.team2.length === 2) {
          queue.turn = 'team2';
        } else if (queue.team1.length === 3 && queue.team2.length === 3) {
          queue.turn = 'team1';
        } else if (queue.team1.length === 4 && queue.team2.length === 3) {
          queue.turn = 'team2';
        } else if (queue.team1.length === 4 && queue.team2.length === 4) {
          quque.turn = 'done';
        }
        await db.updateQueue(queue);
        child.send({ action: 'PICK', team1: team1, team2: team2 });
        res.status(200).json({ message: "Team picked" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});

export default router;
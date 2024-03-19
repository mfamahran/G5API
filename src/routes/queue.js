import { Router } from "express";
import {db, fdb} from "../services/firebase.js";
import {db as db2} from "../services/db.js";
import GameServer from "../utility/serverrcon.js";
import { ref as dataRef, push, onValue, set } from "firebase/database";
import Utils from "../utility/utils.js";
import {fork} from 'child_process';
import { generate } from "randomstring";

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
          // check if queue is empty
          if (Object.keys(queue).length === 0 && queue.constructor === Object) {
            child.send({ action: 'RESET_QUEUE'});
          }
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
        // let team1 = req.body.team1.players;
        // let team2 = req.body.team2.players;
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
          queue.turn = 'map_pick_team1';
          const team1ID = await createTeam(queue.team1, queue.team1Captain);
          const team2ID = await createTeam(queue.team2, queue.team2Captain);
          queue.team1id = team1ID;
          queue.team2id = team2ID;
          queue.maps = ['de_inferno', 'de_mirage', 'de_nuke', 'de_overpass', 'de_vertigo', 'de_anubis', 'de_ancient'];
        }
        await db.updateQueue(queue);
        res.status(200).json({ message: "Team picked" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.toString() });
    }
});

router.post("/ban", Utils.ensureAuthenticated, async (req, res, next) => {
  try {
    let queue = req.body;
    if (queue.maps.length > 1) {
      if (queue.turn === 'map_pick_team1') {
        queue.turn = 'map_pick_team2';
      } else if (queue.turn === 'map_pick_team2') {
        queue.turn = 'map_pick_team1';
      }
    } else if (queue.maps.length === 1) {
      queue.turn = 'done';
      const matchId = await createMatch(queue);
      queue.matchId = matchId;
      await db.updateQueue(queue);
      res.status(200).json({ message: "Match Ready", matchId: matchId });
    }
    await db.updateQueue(queue);
    res.status(200).json({ message: "Map banned", matchId: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.toString() });
  }
});

const createTeam = async (team, captain) => {
  let players = team;
  players.push(captain);
  let teamID = null;
  let newTeam = [
    {
      user_id: captain.id,
      name: 'team_' + captain.name,
      flag: 'EG',
      logo: null,
      tag: 'TEM' + captain.name,
      public_team: false,
    },
  ];
  let sql =
    "INSERT INTO team (user_id, name, flag, logo, tag, public_team) VALUES ?";
  
  const insertTeam = await db2.query(sql, [
    newTeam.map((item) => [
      item.user_id,
      item.name,
      item.flag,
      item.logo,
      item.tag,
      item.public_team,
    ]),
  ]);
  teamID = insertTeam.insertId;

  sql =
      "INSERT INTO team_auth_names (team_id, auth, name, captain, coach) VALUES (?, ?, ?, ?, ?)";

  for (const player of players) {
    await db2.query(sql, [
      teamID,
      player.steam_id,
      player.name,
      player.name === captain.name ? 1 : 0,
      0,
    ]);
  }

  return teamID;
}

const createMatch = async (queue) => {
  let serverSql =
      "SELECT ip_string, port, rcon_password, in_use, user_id, public_server FROM game_server WHERE in_use = ?";
    const serverInUse = await db2.query(serverSql, [0]);
    let teamNameSql = "SELECT name FROM team WHERE id = ?";
    let teamOneName = await db2.query(teamNameSql, [queue.team1id]);
    let teamTwoName = await db2.query(teamNameSql, [queue.team2id]);
    let apiKey = generate({
      length: 24,
      capitalization: "uppercase"
    });
    let skipVeto = 1;
    let insertMatch;
    let insertSet = {
      user_id: queue.team1Captain.id,
      server_id: serverInUse[0].id,
      team1_id: queue.team1id,
      team2_id: queue.team2id,
      season_id: null,
      start_time: new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " "),
      max_maps: 1,
      title: teamOneName[0].name + ' vs. ' + teamTwoName[0].name,
      skip_veto: skipVeto,
      veto_first: 'team1',
      veto_mappool: queue.maps[0],
      side_type: 'always_knife',
      plugin_version: null,
      private_match: 0,
      enforce_teams: 1,
      api_key: apiKey,
      winner: null,
      team1_string: teamOneName[0].name == null ? null : teamOneName[0].name,
      team2_string: teamTwoName[0].name == null ? null : teamTwoName[0].name,
      is_pug: 1,
      min_player_ready: 5,
      players_per_team: 5,
      min_spectators_to_ready: 0,
      map_sides: 'knife',
      wingman: false 
    };

    let sql = "INSERT INTO `match` SET ?";
    insertSet = await db2.buildUpdateStatement(insertSet);
    insertMatch = await db2.query(sql, [insertSet]);

    const newServer = new GameServer(
      serverInUse[0].ip_string,
      serverInUse[0].port,
      serverInUse[0].rcon_password
    );

    if (
      (await newServer.isServerAlive()) &&
      (await newServer.isGet5Available())
    ) {
      sql = "UPDATE game_server SET in_use = 1 WHERE id = ?";
      await db2.query(sql, [req.body[0].server_id]);

      sql = "UPDATE `match` SET plugin_version = ? WHERE id = ?";
      let get5Version = await newServer.getGet5Version();
      await db2.query(sql, [get5Version, insertMatch.insertId]);
      if (
        !(await newServer.prepareGet5Match(
          config.get("server.apiURL") +
            "/matches/" +
            insertMatch.insertId +
            "/config",
          apiKey
        ))
      ) {
        // Delete the match as it does not belong in the database.
        sql = "DELETE FROM `match` WHERE id = ?";
        await db2.query(sql, [insertMatch.insertId]);

        sql = "UPDATE game_server SET in_use = 0 WHERE id = ?";
        await db2.query(sql, [serverInUse[0].id]);
        throw "Please check server logs, as something was not set properly. You may cancel the match and server status is not updated.";
      }
      return insertMatch.insertId;
    }
}

export default router;
// queueManager.js
import { db } from "./firebase.js";
import {db as db2} from "./db.js";
import { generate } from "randomstring";
import GameServer from "../utility/serverrcon.js";
import config from "config";

let playerQueue: any = [];
let Queue: Queue = {
  players: [],
  matchFound: false,
  team1: [],
  team2: [],
  maps: [],
  turn: 'team1',
}


const startMatchIfPossible = () => {
  if (Queue.players.length >= 10) {
    // Simulate match creation logic
    console.log("MATCH FOUND");
    const playersForMatch = Queue.players.slice(0, 10);
    // Pick captains randomly
    const captains = playersForMatch
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    if (!Queue.matchFound) {
      Queue.matchFound = true;
      Queue.team1Captain = captains[0];
      Queue.team2Captain = captains[1];
      Queue.playersMatch = playersForMatch;
      db.updateQueue(Queue).then(() => {
        console.log("Queue | Updated Queue");
      });
    }
    


    // const playersForMatch = playerQueue.slice(0, 10);
    // console.log(`Match started with players: ${playersForMatch.join(', ')}`);
    // // Remove players from the queue
    // playerQueue = playerQueue.slice(10);
    // process.send({ type: 'MATCH_STARTED', players: playersForMatch });
  }
};

class QueueManager {
  constructor() {
    // Start the queue manager
    db.getQueue().then((queue: Queue) => {
      Queue = queue;
      startMatchIfPossible();
      console.log(`Queue | Started Queue, queue size: ${Queue?.players?.length}`);
    });
  }

  async createTeam(team: User[], captain: User) {
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
    teamID = insertTeam[0].insertId;
  
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

  addToQueue(player: any) {
    playerQueue.push(player);
    startMatchIfPossible();
  }
  removeFromQueue(player: any) {
    playerQueue = playerQueue.filter((p: User) => p.steam_id !== player.steam_id);
    startMatchIfPossible();
  }

  async pickPlayer(captain: User, player: User) {
    if (captain.steam_id === Queue.team1Captain?.steam_id) {
      if (Queue.team1 === undefined) {
        Queue.team1 = [];
      }
      Queue.team1.push(player);
      if (Queue.team1.length === 1 || Queue.team1.length === 3) {
        Queue.turn = 'team2';
      } else if (Queue.team1.length === 4) {
        Queue.turn = 'map_pick_team1'
        Queue.maps = ['de_inferno', 'de_mirage', 'de_nuke', 'de_overpass', 'de_vertigo', 'de_anubis', 'de_ancient'];
        if (Queue.team1Captain) {
          const team1ID = await this.createTeam(Queue.team1, Queue.team1Captain);
          Queue.team1id = team1ID;
        }
        
        if (Queue.team2Captain) {
          const team2ID = await this.createTeam(Queue.team2, Queue.team2Captain);
          Queue.team2id = team2ID;
        }        
      }
      Queue.turn = 'team2';
    } else if (captain.steam_id === Queue.team2Captain?.steam_id) {
      if (Queue.team2 === undefined) {
        Queue.team1 = [];
      }
      Queue.team2.push(player);
      if (Queue.team2.length === 2 || Queue.team2.length === 4) {
        Queue.turn = 'team1';
      }
    } else {
      throw "Captain not found";
    }
    await db.updateQueue(Queue).then(() => {
      console.log("Queue | Updated Queue");
    });
  }

  async banMap(captian: User, map: string) {
    if (Queue.maps.includes(map)) {
      throw "Map already banned";
    }
    if (captian.steam_id === Queue.team1Captain?.steam_id) {
      Queue.turn = 'map_pick_team2';
    } else if (captian.steam_id === Queue.team2Captain?.steam_id) {
      Queue.turn = 'map_pick_team1';
    }
    if (Queue.maps.length === 1) {
      const matchId = await this.createMatch(Queue);
      Queue.matchId = matchId;
      Queue.turn = 'done';
    }
    // remove map from Queue.maps
    Queue.maps = Queue.maps.filter((m: string) => m !== map);
    await db.updateQueue(Queue).then(() => {
      console.log("Queue | Updated Queue");
    });
  }

  async createMatch(queue: Queue) {
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
      let insertSet: any = {
        user_id: queue?.team1Captain?.id,
        server_id: serverInUse[0].id,
        team1_id: queue?.team1id,
        team2_id: queue?.team2id,
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
        is_pug: 0,
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
        await db2.query(sql, [serverInUse[0].id]);
  
        sql = "UPDATE `match` SET plugin_version = ? WHERE id = ?";
        let get5Version = await newServer.getGet5Version();
        await db2.query(sql, [get5Version, insertMatch[0].insertId]);
        if (
          !(await newServer.prepareGet5Match(
            config.get("server.apiURL") +
              "/matches/" +
              insertMatch[0].insertId +
              "/config",
            apiKey
          ))
        ) {
          // Delete the match as it does not belong in the database.
          sql = "DELETE FROM `match` WHERE id = ?";
          await db2.query(sql, [insertMatch[0].insertId]);
  
          sql = "UPDATE game_server SET in_use = 0 WHERE id = ?";
          await db2.query(sql, [serverInUse[0].id]);
          throw "Please check server logs, as something was not set properly. You may cancel the match and server status is not updated.";
        }
        return insertMatch[0].insertId;
      }
  }
}

let queueManager = new QueueManager();

export { queueManager };
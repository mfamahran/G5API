// queueManager.js
let playerQueue = [];
let team1 = [];
let team2 = [];


const startMatchIfPossible = (message) => {
  if (playerQueue.length >= 10) {
    // Simulate match creation logic
    console.log("MATCH FOUND");
    const playersForMatch = playerQueue.slice(0, 10);
    // Pick captains randomly
    const captains = playersForMatch
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    console.log(`Captains picked: ${captains.map(player => player.name).join(', ')}`);

    const check = process.send({
      action: 'MATCH_FOUND',
      captains: captains,
      playersMatch: playersForMatch
    });
    console.log(check);
    // const playersForMatch = playerQueue.slice(0, 10);
    // console.log(`Match started with players: ${playersForMatch.join(', ')}`);
    // // Remove players from the queue
    // playerQueue = playerQueue.slice(10);
    // process.send({ type: 'MATCH_STARTED', players: playersForMatch });
  }
};

process.on('message', (message) => {
  if (message.action === 'JOIN_QUEUE') {
    playerQueue.push(message.player);
    console.log(`Player ${message.player.name} joined the queue. Queue size: ${playerQueue.length}`);
    startMatchIfPossible(message);
  } else if (message.action === 'LEAVE_QUEUE') {
    playerQueue = playerQueue.filter(player => player.steam_id !== message.player.steam_id);
    console.log(`Player ${message.player.name} left the queue. Queue size: ${playerQueue.length}`);
  } else if (message.action === 'PICK') {
    team1 = message.team1;
    team2 = message.team2;

    if (team1.length === 4 && team2.length === 4) {
      process.send({ action: 'TEAMS_PICKED', team1: team1, team2: team2 });
    }
  } else if (message.action === 'RESET_QUEUE') {
    playerQueue = [];
    team1 = [];
    team2 = [];
  }
});
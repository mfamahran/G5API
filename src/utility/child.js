// queueManager.js
let playerQueue = [];


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
  } else if (message.action === 'RESET_QUEUE') {
    playerQueue = [];
  }
});
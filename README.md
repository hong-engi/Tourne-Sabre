# Tourne Sabre

Tourne Sabre is a shared arena game. Enter a name, move with **W/A/S/D**, and use your automatically rotating sword to hit other players. Collect items to gain experience.

## Run locally

Run the following from the repository root with Node.js and npm.

```sh
npm ci --prefix backend
npm ci --prefix frontend
NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend
npm start --prefix backend
```

Open `http://localhost:8080`. The build flag supports the repository's webpack 4 configuration on current Node.js versions. The same process serves the client and the WebSocket endpoint. Set `PORT` to change the server port. For frontend development, run `NODE_OPTIONS=--openssl-legacy-provider REACT_APP_GAME_SERVER=http://localhost:8080 npm start --prefix frontend` alongside the backend.

## Multiplayer

- The Node.js server runs a 30 Hz simulation in memory. It owns movement, the sword, collisions, HP, experience, and item respawns. A spatial grid limits item collision checks to nearby cells.
- The browser opens one Socket.IO WebSocket. It sends the key mask and a sequence number when the pressed keys change. The server applies the latest mask at each tick.
- The server streams player snapshots about 15 times per second. It can skip a stale snapshot when the transport is busy. Joining sends the initial world state, and subsequent item messages contain only items that changed.
- The browser predicts local movement and corrects its position from server snapshots. Other players are interpolated behind a 100 ms buffer. The canvas renders independently of the network.
- Match state is local to a single server process and resets on restart. Disconnect removes the player's character. After reconnecting, a player can use the entry form to start a new character.

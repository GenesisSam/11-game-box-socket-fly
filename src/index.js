const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");
const { createObjectCsvWriter } = require("csv-writer");
const fs = require("fs");
const csv = require("csv-parser");

const CORS = [
  "http://localhost:4710",
  "http://appbuild.canlab.co:4711",
  "http://appbuild.canlab.co:4710",
  "https://11plus.vingle.network",
  "https://admin.socket.io",
];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS,
    credentials: true,
  },
});

instrument(io, {
  auth: false,
  mode: "development",
});

const openedGamesCsvWriter = createObjectCsvWriter({
  path: "openedGames.csv",
  header: [
    { id: "gameId", title: "gameId" },
    { id: "fixtureId", title: "fixtureId" },
    { id: "type", title: "type" },
    { id: "content", title: "content" },
    { id: "timeout", title: "timeout" },
    { id: "options", title: "options" },
    { id: "createAt", title: "createAt" },
  ],
  append: fs.existsSync("openedGames.csv"),
  writeHeaders: !fs.existsSync("openedGames.csv"),
});

const userResponseCsvWriter = createObjectCsvWriter({
  path: "userResponse.csv",
  header: [
    { id: "gameId", title: "gameId" },
    { id: "fixtureId", title: "fixtureId" },
    { id: "userId", title: "userId" },
    { id: "userName", title: "userName" },
    { id: "answer", title: "answer" },
    { id: "timestamp", title: "timestamp" },
  ],
  append: fs.existsSync("userResponse.csv"),
  writeHeaders: !fs.existsSync("userResponse.csv"),
});

const readCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

io.on("connection", (socket) => {
  socket.on("gameOpen", async (payload) => {
    const game = {
      gameId: payload.gameId,
      fixtureId: payload.fixtureId,
      type: payload.type,
      content: payload.content,
      content: `"${payload.content.replace(/"/g, '""')}"`,
      timeout: payload.timeout,
      options: payload.options,
      createAt: new Date().toISOString(),
    };

    await openedGamesCsvWriter.writeRecords([game]);
    socket.emit("gameOpenResponse", game);
    io.emit("gameOpen", game);
  });

  socket.on("gameResponse", async (response) => {
    await userResponseCsvWriter.writeRecords([
      {
        gameId: response.gameId,
        fixtureId: response.fixtureId,
        userId: response.userId,
        userName: response.userName,
        answer: response.answer,
        timestamp: new Date().toISOString(),
      },
    ]);
  });

  socket.on("requestGameList", async () => {
    const games = await readCsvFile("openedGames.csv");
    socket.emit("gameListResponse", games);
  });

  socket.on("requestResponseList", async () => {
    const responses = await readCsvFile("userResponse.csv");
    socket.emit("responseListResponse", responses);
  });

  socket.on("gameStatus", async (gameId) => {
    try {
      // 1. Get game object from openedGames.csv
      const games = await readCsvFile("openedGames.csv");
      const gameObject = games.find((game) => game.gameId === gameId);

      if (!gameObject) {
        throw new Error("Game not found");
      }

      // 2. Validate game type
      const validTypes = ["vote", "poll-single", "poll-multiple"];
      if (!validTypes.includes(gameObject.type)) {
        throw new Error("Invalid game type");
      }

      // 3. Collect and analyze responses
      const responses = await readCsvFile("userResponse.csv");
      const gameResponses = responses.filter(
        (response) => response.gameId === gameId
      );

      const stats = {
        gameId,
        totalResponses: gameResponses.length,
        uniqueUsers: new Set(gameResponses.map((r) => r.userId)).size,
        optionCounts: {},
      };

      // Parse options if they exist
      const options = gameObject.options ? JSON.parse(gameObject.options) : [];

      // Calculate option statistics
      gameResponses.forEach((response) => {
        const answer = response.answer;
        stats.optionCounts[answer] = (stats.optionCounts[answer] || 0) + 1;
      });

      socket.emit("gameStatusResponse", stats);
    } catch (error) {
      socket.emit("gameStatusError", { error: error.message });
    }
  });
});

const PORT = process.env.PORT || 4710;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Multer setup for asset uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Database setup
const DB_PATH = path.join(__dirname, "db.json");

interface Database {
  users: Record<string, any>;
  games: any[];
}

function readDB(): Database {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB: Database = {
      users: {},
      games: [
        { id: '1', title: 'Voxel City RP', creator: 'VoxelSphere', thumbnail: 'https://picsum.photos/seed/city/768/432', likes: '94%', playing: 450000, mapData: undefined },
        { id: '2', title: 'Tower of Voxels', creator: 'User123', thumbnail: 'https://picsum.photos/seed/tower/768/432', likes: '88%', playing: 12000, mapData: undefined }
      ]
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDB(db: Database) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function startServer() {
  const app = express();
  app.use(express.json()); // Enable JSON body parsing

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // API Routes
  app.use("/uploads", express.static(UPLOADS_DIR));

  app.post("/api/upload", upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.get("/api/games", (req, res) => {
    const db = readDB();
    res.json(db.games);
  });

  app.post("/api/games", (req, res) => {
    const db = readDB();
    const gameData = req.body;
    
    // Check if game already exists (update)
    const existingIndex = db.games.findIndex(g => g.id === gameData.id);
    
    if (existingIndex !== -1) {
      const oldGame = db.games[existingIndex];
      // Save current state as a version before updating
      const version = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        mapData: oldGame.mapData,
        skybox: oldGame.skybox
      };
      
      const updatedGame = {
        ...oldGame,
        ...gameData,
        versions: [version, ...(oldGame.versions || [])]
      };
      
      db.games[existingIndex] = updatedGame;
      writeDB(db);
      res.json(updatedGame);
    } else {
      // New game
      const newGame = {
        ...gameData,
        id: gameData.id || Date.now().toString(),
        versions: []
      };
      db.games.unshift(newGame);
      writeDB(db);
      res.json(newGame);
    }
  });

  app.delete("/api/games/:id", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.games = db.games.filter(g => g.id !== id);
    writeDB(db);
    res.json({ success: true });
  });

  app.post("/api/login", (req, res) => {
    const { username } = req.body;
    const db = readDB();
    if (!db.users[username]) {
      db.users[username] = {
        username,
        displayName: username,
        robux: 1540,
        friends: [],
        avatarConfig: {
          bodyColors: {
            head: '#F5CD30', torso: '#0047AB', leftArm: '#F5CD30', rightArm: '#F5CD30', leftLeg: '#A2C429', rightLeg: '#A2C429'
          },
          faceTextureUrl: null,
          accessories: { hatModelUrl: null, shirtTextureUrl: null },
          hideFace: false
        },
        settings: { language: 'es', backgroundColor: '#1a1b1e' }
      };
      writeDB(db);
    }
    res.json(db.users[username]);
  });

  app.post("/api/user/:username/avatar", (req, res) => {
    const { username } = req.params;
    const avatarConfig = req.body;
    const db = readDB();
    if (db.users[username]) {
      db.users[username].avatarConfig = avatarConfig;
      writeDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/user/:username/settings", (req, res) => {
    const { username } = req.params;
    const settings = req.body;
    const db = readDB();
    if (db.users[username]) {
      db.users[username].settings = settings;
      writeDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.get("/api/user/:username/studio", (req, res) => {
    const { username } = req.params;
    const db = readDB();
    if (db.users[username]) {
      res.json(db.users[username].studioMap || { title: "Mi Experiencia Voxel", map: [], skybox: "Day" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/user/:username/studio", (req, res) => {
    const { username } = req.params;
    const studioMap = req.body;
    const db = readDB();
    if (db.users[username]) {
      db.users[username].studioMap = studioMap;
      writeDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Store game state (in-memory for real-time)
  const rooms: Record<string, {
    players: Record<string, any>;
    mapObjects: any[];
  }> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId, userData) => {
      socket.join(roomId);
      if (!rooms[roomId]) {
        rooms[roomId] = { players: {}, mapObjects: [] };
      }
      
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        ...userData,
        position: [0, 2, 0],
        rotation: [0, 0, 0],
        isMoving: false,
        isJumping: false,
        isTalking: false
      };

      // Send current state to the new player
      socket.emit("room-state", rooms[roomId]);
      
      // Notify others
      socket.to(roomId).emit("player-joined", rooms[roomId].players[socket.id]);
    });

    socket.on("update-player", (roomId, data) => {
      if (rooms[roomId] && rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id] = {
          ...rooms[roomId].players[socket.id],
          ...data
        };
        socket.to(roomId).emit("player-updated", rooms[roomId].players[socket.id]);
      }
    });

    socket.on("update-map", (roomId, mapObjects) => {
      if (rooms[roomId]) {
        rooms[roomId].mapObjects = mapObjects;
        socket.to(roomId).emit("map-updated", mapObjects);
      }
    });

    socket.on("voice-data", (roomId, audioData) => {
      // Broadcast voice data to others in the room (Legacy Socket.io fallback)
      socket.to(roomId).emit("remote-voice", socket.id, audioData);
    });

    // --- WebRTC Signaling ---
    socket.on("webrtc-signal", (roomId, targetId, signal) => {
      // Forward signal (offer, answer, or ice-candidate) to the specific target
      socket.to(targetId).emit("webrtc-signal", socket.id, signal);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const roomId in rooms) {
        if (rooms[roomId].players[socket.id]) {
          delete rooms[roomId].players[socket.id];
          io.to(roomId).emit("player-left", socket.id);
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`VoxelSphere Server is starting...`);
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

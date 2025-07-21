const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const routes = require('./routes/index');
const { reinitializeClients } = require('./services/whatsapp');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Important: Make io accessible to routes
app.set('socketio', io);

// --- Database Connection ---
// NOTE: "whatsapp-panel" ko apni database ke naam se badal dein.
const MONGO_URI = 'mongodb://localhost:27017/whatsapp-panel'; 
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));

// --- Middleware ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'my-super-secret-key-change-it', // Isko production me zaroor badlein
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI })
}));

// --- Routes ---
app.use('/', routes);

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
    console.log('A user connected to Socket.IO');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Re-initialize clients on server start
    reinitializeClients(io);
});

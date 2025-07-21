const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Device = require('../models/Device');
const Keyword = require('../models/Keyword');
const { initializeClient, getClient, activeClients } = require('../services/whatsapp');

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
router.get('/', (req, res) => res.render('index'));
router.get('/login', (req, res) => res.render('login'));
router.get('/register', (req, res) => res.render('register'));

// Register POST
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.redirect('/login');
});

// Login POST
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user._id;
        res.redirect('/dashboard');
    } else {
        res.send('Invalid credentials');
    }
});

// Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
    const devices = await Device.find({ user: req.session.userId });
    res.render('dashboard', { devices, activeClients });
});

// Add Device
router.post('/add-device', isAuthenticated, async (req, res) => {
    const { deviceName } = req.body;
    const device = new Device({ user: req.session.userId, name: deviceName });
    await device.save();
    const io = req.app.get('socketio');
    initializeClient(device._id.toString(), io);
    res.redirect('/dashboard');
});

// Manage Device Page
router.get('/device/:id', isAuthenticated, async (req, res) => {
    const device = await Device.findById(req.params.id);
    if (!device || device.user.toString() !== req.session.userId) {
        return res.status(404).send('Device not found');
    }
    const keywords = await Keyword.find({ device: req.params.id });
    res.render('manage-device', { device, keywords, saved: req.query.saved });
});

// Add Keyword
router.post('/device/:id/add-keyword', isAuthenticated, async (req, res) => {
    const { keyword, reply } = req.body;
    const newKeyword = new Keyword({ device: req.params.id, keyword, reply });
    await newKeyword.save();
    res.redirect(`/device/${req.params.id}`);
});

// Delete Keyword
router.post('/device/:id/delete-keyword/:keywordId', isAuthenticated, async (req, res) => {
    await Keyword.findByIdAndDelete(req.params.keywordId);
    res.redirect(`/device/${req.params.id}`);
});

// Update Device Features
router.post('/device/:id/update-features', isAuthenticated, async (req, res) => {
    const { autoRead, alwaysOnline, rejectCalls } = req.body;
    await Device.findByIdAndUpdate(req.params.id, {
        autoRead: !!autoRead,
        alwaysOnline: !!alwaysOnline,
        rejectCalls: !!rejectCalls
    });
    res.redirect(`/device/${req.params.id}?saved=true`);
});

// Disconnect Device
router.post('/device/:id/disconnect', isAuthenticated, async (req, res) => {
    const client = getClient(req.params.id);
    if (client) {
        await client.logout();
    }
    res.redirect('/dashboard');
});

// Delete Device
router.post('/device/:id/delete', isAuthenticated, async (req, res) => {
    const client = getClient(req.params.id);
    if (client) {
        await client.destroy();
        activeClients.delete(req.params.id);
    }
    await Device.findByIdAndDelete(req.params.id);
    await Keyword.deleteMany({ device: req.params.id });
    res.redirect('/dashboard');
});

// --- YEH NAYA ROUTE HAI RECONNECT KE LIYE ---
router.post('/device/:id/reconnect', isAuthenticated, async (req, res) => {
    const deviceId = req.params.id;
    const client = getClient(deviceId);
    if (!client) { // Sirf tab hi reconnect karein jab client active na ho
        const io = req.app.get('socketio');
        initializeClient(deviceId, io);
    }
    res.redirect('/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;

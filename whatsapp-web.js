const { Client, LocalAuth } = require('whatsapp-web.js');
const Device = require('../models/Device');
const Keyword = require('../models/Keyword');

const activeClients = new Map();

function initializeClient(deviceId, io) {
    console.log(`Initializing client for device: ${deviceId}`);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: deviceId }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        console.log(`QR received for ${deviceId}`);
        io.emit('qr', { deviceId, qr });
    });

    client.on('ready', () => {
        console.log(`Client is ready for ${deviceId}!`);
        io.emit('status', { deviceId, message: 'Connected' });
        activeClients.set(deviceId, client);
    });

    client.on('disconnected', (reason) => {
        console.log(`Client was logged out for ${deviceId}: ${reason}`);
        io.emit('status', { deviceId, message: 'Disconnected' });
        activeClients.delete(deviceId);
        // Optional: Yahan se client ko destroy kar sakte hain
        // client.destroy();
    });
    
    // Message listener for auto-reply
    client.on('message', async (message) => {
        const device = await Device.findById(deviceId);
        if (!device) return;

        // Auto-read feature
        if (device.autoRead) {
            const chat = await message.getChat();
            chat.sendSeen();
        }

        const keywords = await Keyword.find({ device: deviceId });
        for (const item of keywords) {
            if (message.body.toLowerCase().includes(item.keyword.toLowerCase())) {
                message.reply(item.reply);
                break; // Ek keyword match hone par reply bhej kar loop rok dein
            }
        }
    });

    // Reject Calls Feature
    client.on('call', async (call) => {
        const device = await Device.findById(deviceId);
        if (device && device.rejectCalls) {
            console.log(`Rejecting call from ${call.from} for device ${deviceId}`);
            await call.reject();
        }
    });

    client.initialize();
    return client;
}

async function reinitializeClients(io) {
    const devices = await Device.find();
    devices.forEach(device => {
        // Sirf un devices ko start karein jinke paas session ho
        if (device.session) {
           console.log(`Re-initializing client for device: ${device._id}`);
           initializeClient(device._id.toString(), io);
        }
    });
}

function getClient(deviceId) {
    return activeClients.get(deviceId);
}

module.exports = { initializeClient, reinitializeClients, getClient, activeClients };

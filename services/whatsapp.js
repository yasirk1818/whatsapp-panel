const { Client, LocalAuth } = require('whatsapp-web.js');
const Device = require('../models/Device');
const Keyword = require('../models/Keyword');

const activeClients = new Map();
const presenceIntervals = new Map();

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

    client.on('ready', async () => {
        console.log(`Client is ready for ${deviceId}!`);
        io.emit('status', { deviceId, message: 'Connected' });
        activeClients.set(deviceId.toString(), client);

        try {
            const phoneNumber = client.info.wid.user;
            await Device.findByIdAndUpdate(deviceId, { phoneNumber: phoneNumber });
            console.log(`Saved phone number ${phoneNumber} for device ${deviceId}`);
        } catch (err) {
            console.error(`Failed to save phone number for ${deviceId}:`, err);
        }

        if (presenceIntervals.has(deviceId)) {
            clearInterval(presenceIntervals.get(deviceId));
        }

        const interval = setInterval(async () => {
            try {
                const device = await Device.findById(deviceId);
                if (device && device.alwaysOnline) {
                    const currentClient = getClient(deviceId);
                    if (currentClient) {
                        await currentClient.sendPresenceAvailable();
                        console.log(`Presence sent for ${deviceId}`);
                    }
                }
            } catch (err) {
                console.error(`Error sending presence for ${deviceId}:`, err);
            }
        }, 50000);

        presenceIntervals.set(deviceId, interval);
    });

    client.on('disconnected', (reason) => {
        console.log(`Client was logged out for ${deviceId}: ${reason}`);
        io.emit('status', { deviceId, message: 'Disconnected' });
        activeClients.delete(deviceId.toString());
        
        if (presenceIntervals.has(deviceId)) {
            clearInterval(presenceIntervals.get(deviceId));
            presenceIntervals.delete(deviceId);
            console.log(`Cleared presence interval for ${deviceId}`);
        }
    });
    
    // YAHAN PAR BEHTAR BANAYA GAYA HAI
    client.on('message', async (message) => {
        const device = await Device.findById(deviceId);
        if (!device) return;

        // Auto-read feature
        if (device.autoRead) {
            // Ek chota sa delay add karein taake race condition na ho
            setTimeout(async () => {
                try {
                    const chat = await message.getChat();
                    await chat.sendSeen();
                } catch (err) {
                    console.error(`Failed to send seen for ${deviceId} after delay:`, err);
                }
            }, 1000); // 1000 milliseconds = 1 second ka delay
        }

        // Keyword based auto-reply
        const keywords = await Keyword.find({ device: deviceId });
        for (const item of keywords) {
            if (message.body.toLowerCase().includes(item.keyword.toLowerCase())) {
                message.reply(item.reply);
                break;
            }
        }
    });

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
    try {
        const devices = await Device.find();
        devices.forEach(device => {
           console.log(`Re-initializing client for device: ${device._id}`);
           initializeClient(device._id.toString(), io);
        });
    } catch(err) {
        console.error("Error reinitializing clients:", err);
    }
}

function getClient(deviceId) {
    return activeClients.get(deviceId.toString());
}

module.exports = { initializeClient, reinitializeClients, getClient, activeClients };

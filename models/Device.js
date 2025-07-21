const mongoose = require('mongoose');
const deviceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    session: { type: String },
    phoneNumber: { type: String }, // Yeh field add hui hai
    // --- Feature Toggles ---
    autoRead: { type: Boolean, default: false },
    alwaysOnline: { type: Boolean, default: false },
    rejectCalls: { type: Boolean, default: false },
});
module.exports = mongoose.model('Device', deviceSchema);

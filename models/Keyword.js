const mongoose = require('mongoose');
const keywordSchema = new mongoose.Schema({
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    keyword: { type: String, required: true },
    reply: { type: String, required: true }
});
module.exports = mongoose.model('Keyword', keywordSchema);

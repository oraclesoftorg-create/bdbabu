// models/MenuGame.js - Updated model
const mongoose = require('mongoose');

const menuGameSchema = new mongoose.Schema({
    uuid: {
        type: String,
        unique: true,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    categoryname: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    gameId: {
        type: String,
        required: true,
        trim: true
    },
    provider: {
        type: String,
        required: true,
        trim: true
    },
    serial: {  // NEW FIELD FOR ORDERING
        type: Number,
        default: 0
    },
    status: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create index for efficient sorting
menuGameSchema.index({ serial: 1 });
menuGameSchema.index({ status: 1, serial: 1 });

const MenuGame = mongoose.model('MenuGame', menuGameSchema);

module.exports = MenuGame;
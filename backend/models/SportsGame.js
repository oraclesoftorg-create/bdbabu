// models/SportsGame.js

const mongoose = require('mongoose');

const sportsGameSchema = new mongoose.Schema({
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
    serial: {
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
sportsGameSchema.index({ serial: 1 });
sportsGameSchema.index({ status: 1, serial: 1 });

const SportsGame = mongoose.model('SportsGame', sportsGameSchema);

module.exports = SportsGame;
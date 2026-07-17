// models/PromotionalPopup.js
const mongoose = require("mongoose");

const promotionalPopupSchema = new mongoose.Schema({
    image: {
        type: String,
        required: [true, "Image is required"]
    },
    link: {
        type: String,
        trim: true,
        default: ""
    },
    status: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin"
    }
}, {
    timestamps: true
});

// Index for better query performance
promotionalPopupSchema.index({ status: 1 });

// Static method to get active popups
promotionalPopupSchema.statics.getActivePopups = async function() {
    return this.find({ status: true })
        .sort({ createdAt: -1 })
        .lean();
};

const PromotionalPopup = mongoose.model("PromotionalPopup", promotionalPopupSchema);

module.exports = PromotionalPopup;
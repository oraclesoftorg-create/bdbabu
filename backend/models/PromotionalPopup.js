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
    deviceType: {
        type: String,
        enum: ['computer', 'mobile', 'both'],
        default: 'both',
        required: [true, "Device type is required"]
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
promotionalPopupSchema.index({ deviceType: 1 });

// Static method to get active popups
promotionalPopupSchema.statics.getActivePopups = async function(deviceType = null) {
    const filter = { status: true };
    
    // If deviceType is specified, filter by device type
    if (deviceType) {
        filter.deviceType = { $in: [deviceType, 'both'] };
    }
    
    return this.find(filter)
        .sort({ createdAt: -1 })
        .lean();
};

// Static method to get active popups for specific device
promotionalPopupSchema.statics.getActivePopupsForDevice = async function(deviceType) {
    return this.getActivePopups(deviceType);
};

const PromotionalPopup = mongoose.model("PromotionalPopup", promotionalPopupSchema);

module.exports = PromotionalPopup;
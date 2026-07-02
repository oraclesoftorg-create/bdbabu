const express = require("express");
const axios = require("axios");
const { User } = require("../models/User");

module.exports = function opayApi(settingsCollection) {
  const router = express.Router();

  const SETTINGS_KEY = "opay";
  const BASE_URL = "https://api.oraclepay.org";
  const VALIDATE_URL = `${BASE_URL}/api/external/key/validate`;
  const GENERATE_URL = `${BASE_URL}/api/external/generate`;
  const SUPPORT_URL = `${BASE_URL}/api/external/support-number`;

  // Cache for validation results
  let validationCache = {
    data: null,
    timestamp: null,
    ttl: 60000 // 1 minute cache
  };

  const getAllowedDomain = () => {
    return process.env.DOMAIN || null;
  };

  const getSettings = async () => {
    if (!settingsCollection) return null;
    return await settingsCollection.findOne({ key: SETTINGS_KEY });
  };

  const saveSettings = async (doc) => {
    if (!settingsCollection) return;
    await settingsCollection.updateOne(
      { key: SETTINGS_KEY },
      { $set: { ...doc, key: SETTINGS_KEY, updatedAt: new Date() } },
      { upsert: true }
    );
  };

  // Helper: perform external validation + domain check (with caching)
  const performValidation = async (apiKey, persistOnMismatch = true, useCache = true) => {
    // Check cache first
    if (useCache && validationCache.data && validationCache.timestamp) {
      const now = Date.now();
      if (now - validationCache.timestamp < validationCache.ttl) {
        console.log("Using cached validation result");
        return validationCache.data;
      }
    }

    try {
      console.log("Validating API key against OraclePay...");
      
      const response = await axios.get(VALIDATE_URL, {
        headers: { 
          "X-API-Key": apiKey,
          "User-Agent": "Opay-Integration/1.0"
        },
        timeout: 10000, // Reduced timeout for faster response
      });
      
      console.log("Validation response status:", response.status);
      const payload = response.data || {};
      
      const allowed = getAllowedDomain();
      if (allowed) {
        const domains = Array.isArray(payload.domains) ? payload.domains : [];
        const primary = payload.primaryDomain || "";
        const match = domains.includes(allowed) || primary === allowed;
        
        if (!match) {
          const result = {
            status: 400,
            body: {
              success: false,
              valid: false,
              reason: "DOMAIN_MISMATCH",
              message: "Your domain is not whitelisted for this API key",
              allowedDomain: allowed,
              domains,
              primaryDomain: primary,
            },
          };
          
          if (persistOnMismatch) {
            await saveSettings({ 
              apiKey, 
              validation: result.body
            });
          }
          
          // Cache the result
          validationCache = {
            data: result,
            timestamp: Date.now()
          };
          
          return result;
        }
      }
      
      const result = { 
        status: 200, 
        body: { 
          ...payload, 
          success: true,
          valid: true 
        } 
      };
      
      await saveSettings({ 
        apiKey, 
        validation: result.body
      });
      
      // Cache the result
      validationCache = {
        data: result,
        timestamp: Date.now()
      };
      
      return result;
      
    } catch (err) {
      console.error("External validation error:", err.message);
      
      let errorResponse = {
        status: 500,
        body: {
          success: false,
          valid: false,
          reason: "REQUEST_FAILED",
          message: "Failed to validate API key with OraclePay",
        }
      };
      
      if (err.response) {
        errorResponse.status = err.response.status;
        errorResponse.body = {
          ...err.response.data,
          success: false,
          valid: false,
          reason: err.response.data?.reason || "UPSTREAM_ERROR"
        };
      } else if (err.code === 'ECONNABORTED') {
        errorResponse.body = {
          success: false,
          valid: false,
          reason: "TIMEOUT",
          message: "OraclePay API timeout - please try again"
        };
      } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        errorResponse.body = {
          success: false,
          valid: false,
          reason: "NETWORK_ERROR",
          message: "Cannot connect to OraclePay API - check your internet connection"
        };
      }
      
      if (persistOnMismatch) {
        await saveSettings({ 
          apiKey, 
          validation: errorResponse.body,
          lastError: new Date()
        });
      }
      
      // Cache the error result
      validationCache = {
        data: errorResponse,
        timestamp: Date.now()
      };
      
      return errorResponse;
    }
  };

  // NEW: Generate payment page
  router.post("/generate-payment", async (req, res) => {
    try {
      const { methods, amount, userIdentifyAddress } = req.body || {};

      if (!methods) {
        return res.status(400).json({
          success: false,
          reason: "MISSING_METHODS",
          message: "Payment methods are required (e.g., 'bkash,nagad,rocket,upay')"
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          reason: "INVALID_AMOUNT",
          message: "Amount must be greater than 0"
        });
      }

      if (!userIdentifyAddress) {
        return res.status(400).json({
          success: false,
          reason: "MISSING_USER_IDENTIFY_ADDRESS",
          message: "User identify address (order ID) is required"
        });
      }

      const saved = await getSettings();
      const apiKey = saved?.apiKey;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          reason: "MISSING_API_KEY",
          message: "API key not configured. Please set up your API key first."
        });
      }

      const validationResult = await performValidation(apiKey, true, true);
      if (!validationResult.body.valid) {
        return res.status(validationResult.status).json(validationResult.body);
      }

      console.log("Generating payment page for:", { methods, amount, userIdentifyAddress });

      const response = await axios.get(GENERATE_URL, {
        params: {
          methods: methods,
          amount: amount,
          userIdentifyAddress: userIdentifyAddress
        },
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'Opay-Integration/1.0'
        },
        timeout: 15000
      });

      console.log("Payment page generated successfully");

      return res.status(200).json({
        success: true,
        payment_page_url: response.data.payment_page_url || response.data.url,
        data: response.data
      });

    } catch (err) {
      console.error("Generate payment error:", err.message);
      
      let errorResponse = {
        success: false,
        reason: "GENERATION_FAILED",
        message: "Failed to generate payment page"
      };

      if (err.response) {
        errorResponse = {
          ...err.response.data,
          success: false
        };
        return res.status(err.response.status).json(errorResponse);
      } else if (err.code === 'ECONNABORTED') {
        errorResponse.message = "Request timeout - please try again";
        return res.status(408).json(errorResponse);
      } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        errorResponse.message = "Cannot connect to OraclePay API - check your internet connection";
        return res.status(503).json(errorResponse);
      }

      return res.status(500).json(errorResponse);
    }
  });

  // NEW: Get support number
  router.get("/support-number", async (req, res) => {
    try {
      const saved = await getSettings();
      const apiKey = saved?.apiKey;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          reason: "MISSING_API_KEY",
          message: "API key not configured"
        });
      }

      const response = await axios.get(SUPPORT_URL, {
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'Opay-Integration/1.0'
        },
        timeout: 10000
      });

      return res.status(200).json({
        success: true,
        supportNumber: response.data.supportNumber || response.data.support_number,
        data: response.data
      });

    } catch (err) {
      console.error("Get support number error:", err.message);
      
      let errorResponse = {
        success: false,
        reason: "SUPPORT_FETCH_FAILED",
        message: "Failed to fetch support number"
      };

      if (err.response) {
        return res.status(err.response.status).json({
          ...err.response.data,
          success: false
        });
      }

      return res.status(500).json(errorResponse);
    }
  });

  // Return Opay settings - FAST response with cached validation
  router.get("/settings", async (req, res) => {
    try {
      const useCached = req.query.cached === "true";
      const saved = await getSettings();
      let currentValidation = saved?.validation || null;
      
      // Only validate if not cached and API key exists
      if (saved?.apiKey && !useCached) {
        try {
          // Use cached validation if available
          const result = await performValidation(saved.apiKey, false, true);
          currentValidation = result.body;
        } catch (e) {
          console.error("Error refreshing validation:", e.message);
          // Use saved validation if available
          if (saved?.validation) {
            currentValidation = saved.validation;
          }
        }
      }
      
      // Return response immediately
      return res.status(200).json({
        apiKey: saved?.apiKey || "",
        validation: currentValidation || { valid: false },
        updatedAt: saved?.updatedAt || null,
        running: saved?.running === true,
        refreshed: !useCached && !!saved?.apiKey,
        cached: useCached
      });
      
    } catch (err) {
      console.error("Settings error:", err);
      return res.status(500).json({ 
        success: false, 
        reason: "READ_FAILED", 
        message: err.message 
      });
    }
  });

  // Validate API key - with caching
  router.post("/validate", async (req, res) => {
    try {
      let { apiKey } = req.body || {};

      if (!apiKey) {
        const saved = await getSettings();
        apiKey = saved?.apiKey;
      }

      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          valid: false, 
          reason: "MISSING_API_KEY",
          message: "API key is required"
        });
      }

      // Force fresh validation
      validationCache.data = null;
      validationCache.timestamp = null;
      
      const result = await performValidation(apiKey, true, false);
      return res.status(result.status).json(result.body);
      
    } catch (err) {
      console.error("Validate endpoint error:", err);
      return res.status(500).json({ 
        success: false, 
        valid: false, 
        reason: "SERVER_ERROR", 
        message: err.message 
      });
    }
  });

  // Toggle running status
  router.patch("/running", async (req, res) => {
    try {
      const { running } = req.body || {};
      if (typeof running !== "boolean") {
        return res.status(400).json({ 
          success: false, 
          reason: "INVALID_RUNNING_VALUE",
          message: "Running must be a boolean value"
        });
      }
      const saved = (await getSettings()) || {};
      await saveSettings({ ...saved, running });
      return res.status(200).json({ success: true, running });
    } catch (err) {
      console.error("Running update error:", err);
      return res.status(500).json({ 
        success: false, 
        reason: "RUNNING_UPDATE_FAILED", 
        message: err.message 
      });
    }
  });

  // OraclePay Callback webhook endpoint (with coin bonus)
// OraclePay Callback webhook endpoint (with coin bonus)
router.post("/oraclepay-callback", async (req, res) => {
  try {
    const db = req.app.locals?.db;
    if (!db) {
      return res.status(500).json({ success: false, message: "Database not initialized" });
    }

    const payload = req.body || {};
    
    console.log("OraclePay Callback received:", payload);

    // ALWAYS respond with 'OK' first
    res.status(200).send('OK');

    // Collections
    const oraclePayDepositCol = db.collection("OraclePay-deposit");
    const usersCol = db.collection("users");
    const depositsCol = db.collection("deposits");
    const ObjectId = require('mongodb').ObjectId;

    // Ensure unique index on transaction_id
    try {
      await oraclePayDepositCol.createIndex({ trxid: 1 }, { unique: true, sparse: true });
      await oraclePayDepositCol.createIndex({ token: 1 }, { sparse: true });
    } catch (e) {
      // ignore if already exists
    }

    // Map the actual callback data to expected fields
    const {
      success,
      userIdentifyAddress,
      time,
      method,
      token,
      amount,
      from,
      trxid,
      deviceName,
      deviceId,
      bdTimeZone
    } = payload;

    // Only process successful payments
    if (success !== true) {
      console.log(`Payment not successful: ${success}`);
      
      await oraclePayDepositCol.insertOne({
        ...payload,
        receivedAt: new Date(),
        processed: false,
        reason: `PAYMENT_NOT_SUCCESSFUL`
      }).catch(err => {
        if (err.code !== 11000) console.error("Error saving non-successful payload:", err);
      });
      
      return;
    }

    // Validate required fields
    if (!trxid || !userIdentifyAddress || !amount || amount <= 0) {
      console.error("Missing required fields in successful payment:", {
        trxid,
        userIdentifyAddress,
        amount
      });
      
      await oraclePayDepositCol.insertOne({
        ...payload,
        receivedAt: new Date(),
        processed: false,
        reason: "MISSING_REQUIRED_FIELDS"
      }).catch(err => {
        if (err.code !== 11000) console.error("Error saving invalid payload:", err);
      });
      
      return;
    }

    // Check for duplicate transaction
    const existing = await oraclePayDepositCol.findOne({ trxid });
    if (existing && existing.processed === true) {
      console.log(`Duplicate webhook for transaction: ${trxid} - already processed`);
      return;
    }

    // Save incoming payload
    const baseDoc = {
      ...payload,
      receivedAt: new Date(),
      processed: false,
      method: method || 'unknown',
      deviceName: deviceName || 'unknown',
      deviceId: deviceId || 'unknown',
      bdTimeZone: bdTimeZone || new Date().toISOString()
    };

    let insertedId = null;
    try {
      const insertResult = await oraclePayDepositCol.insertOne(baseDoc);
      insertedId = insertResult.insertedId;
      console.log(`Saved OraclePay callback with ID: ${insertedId}`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`Duplicate trxid: ${trxid} - already exists`);
        return;
      }
      console.error("Error saving payload:", err);
      return;
    }

    // Process the payment
    const amountNum = Number(amount);
    let userId = null;
    let user = null;

    // Extract user ID from userIdentifyAddress
    if (userIdentifyAddress && userIdentifyAddress.includes('-')) {
      const parts = userIdentifyAddress.split('-');
      if (parts.length >= 1) {
        const possibleUserId = parts[0];
        try {
          if (ObjectId.isValid(possibleUserId)) {
            user = await usersCol.findOne({ _id: new ObjectId(possibleUserId) });
            if (user) userId = user._id;
          }
        } catch (err) {
          console.log("Error finding user by ID from userIdentifyAddress:", err.message);
        }
      }
    }

    // Try other methods to find user...
    if (!user) {
      // Try to find user by username (if userIdentifyAddress contains username)
      user = await usersCol.findOne({ username: userIdentifyAddress });
      if (user) userId = user._id;
    }

    if (!user) {
      user = await usersCol.findOne({ email: userIdentifyAddress });
      if (user) userId = user._id;
    }

    if (!user) {
      user = await usersCol.findOne({ phone: userIdentifyAddress });
      if (user) userId = user._id;
    }

    if (!user) {
      console.error(`User not found for userIdentifyAddress: ${userIdentifyAddress}`);
      
      await oraclePayDepositCol.updateOne(
        { _id: insertedId },
        { 
          $set: { 
            processed: false, 
            reason: "USER_NOT_FOUND",
            userIdentifyAddress: userIdentifyAddress,
            checkedAt: new Date() 
          } 
        }
      );
      
      return;
    }

    console.log(`Found user: ${user.username} (${user._id})`);

    // Find the original deposit record by token or userIdentifyAddress
    let originalDeposit = null;
    
    if (token) {
      originalDeposit = await depositsCol.findOne({
        userId: user._id,
        status: "pending",
        oraclePayToken: token
      });
    }

    if (!originalDeposit) {
      originalDeposit = await depositsCol.findOne({
        userId: user._id,
        status: "pending",
        oraclePaySessionCode: token
      });
    }

    if (!originalDeposit) {
      originalDeposit = await depositsCol.findOne({
        userId: user._id,
        status: "pending",
        'checkoutItems.userIdentifyAddress': userIdentifyAddress
      });
    }

    if (!originalDeposit) {
      originalDeposit = await depositsCol.findOne({
        userId: user._id,
        status: "pending",
        'checkoutItems.userId': user._id.toString()
      });
    }

    if (!originalDeposit) {
      originalDeposit = await depositsCol.findOne({
        userId: user._id,
        status: "pending"
      }, {
        sort: { createdAt: -1 }
      });
    }

    // Extract bonus information
    let bonusInfo = {
      bonusType: 'none',
      bonusCode: '',
      bonusAmount: 0,
      wageringRequirement: 0,
      method: method || 'oraclepay'
    };

    if (originalDeposit) {
      if (originalDeposit.checkoutItems && originalDeposit.checkoutItems.selectedBonus) {
        const selectedBonus = originalDeposit.checkoutItems.selectedBonus;
        bonusInfo = {
          bonusType: selectedBonus.type || selectedBonus.bonusType || 'none',
          bonusCode: selectedBonus.code || selectedBonus.bonusCode || '',
          bonusAmount: Number(selectedBonus.calculatedAmount) || 0,
          wageringRequirement: Number(selectedBonus.wageringRequirement) || 0,
          method: originalDeposit.checkoutItems.method || method || 'oraclepay'
        };
      } else {
        bonusInfo = {
          bonusType: originalDeposit.bonusType || 'none',
          bonusCode: originalDeposit.bonusCode || '',
          bonusAmount: Number(originalDeposit.bonusAmount) || 0,
          wageringRequirement: Number(originalDeposit.wageringRequirement) || 0,
          method: originalDeposit.method || method || 'oraclepay'
        };
      }
    }

    // Calculate total credit with bonus
    const totalCredit = amountNum + bonusInfo.bonusAmount;

    // Calculate coin bonus based on deposit amount
    let coinBonus = 0;
    if (amountNum >= 10000) {
      coinBonus = 1500;
    } else if (amountNum >= 5000) {
      coinBonus = 500;
    } else if (amountNum >= 1000) {
      coinBonus = 100;
    }
    
    if (coinBonus > 0) {
      console.log(`🎉 User ${user.username} will receive ${coinBonus} coins for deposit of ${amountNum} BDT`);
    }

    // Prepare deposit record
    const depositRecord = {
      method: bonusInfo.method,
      amount: amountNum,
      status: 'completed',
      transactionId: trxid,
      sessionCode: token,
      token: token,
      from: from || '',
      time: time || new Date().toLocaleTimeString(),
      bdTimeZone: bdTimeZone || new Date().toISOString(),
      deviceName: deviceName || '',
      deviceId: deviceId || '',
      method: method,
      bonusApplied: bonusInfo.bonusAmount > 0,
      bonusType: bonusInfo.bonusType,
      bonusAmount: bonusInfo.bonusAmount,
      bonusCode: bonusInfo.bonusCode,
      wageringRequirement: bonusInfo.wageringRequirement,
      orderId: `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      playerbalance: originalDeposit?.playerbalance || user.balance || 0,
      coinBonus: coinBonus,
      processedAt: new Date(),
      completedAt: new Date(),
      createdAt: new Date()
    };

    // Update User model if available
    const matchedUser = await User.findById(user._id);
    
    if (matchedUser) {
      matchedUser.depositamount = amountNum;
      matchedUser.waigeringneed = bonusInfo.wageringRequirement;
      matchedUser.total_bet = 0;
      matchedUser.affiliatedeposit = (matchedUser.affiliatedeposit || 0) + amountNum;
      await matchedUser.save();
    }

    // Prepare transaction record
    const transactionRecord = {
      type: 'deposit',
      amount: amountNum,
      balanceBefore: user.balance || 0,
      balanceAfter: (user.balance || 0) + totalCredit,
      description: `Deposit via OraclePay (${method})${bonusInfo.bonusAmount > 0 ? ` with ${bonusInfo.bonusType} bonus` : ''}`,
      referenceId: trxid,
      sessionCode: token,
      metadata: {
        method,
        from,
        time,
        deviceName,
        deviceId,
        bdTimeZone
      },
      createdAt: new Date()
    };

    // Build update operations
    const updateOperations = {
      $inc: {
        balance: totalCredit,
        total_deposit: amountNum,
        lifetime_deposit: amountNum
      },
      $push: {
        transactionHistory: transactionRecord
      }
    };

    // Add coin bonus
    if (coinBonus > 0) {
      if (!updateOperations.$inc) {
        updateOperations.$inc = {};
      }
      updateOperations.$inc.coinBalance = coinBonus;
      updateOperations.$push.coinHistory = {
        amount: coinBonus,
        reason: `deposit_bonus_${amountNum}_BDT`,
        date: new Date(),
        metadata: {
          depositAmount: amountNum,
          transactionId: trxid,
          sessionCode: token,
          method: method
        }
      };
      
      updateOperations.$push.transactionHistory = {
        type: "coin_bonus",
        amount: coinBonus,
        balanceBefore: user.coinBalance || 0,
        balanceAfter: (user.coinBalance || 0) + coinBonus,
        description: `Deposit bonus: ${coinBonus} coins for depositing ${amountNum} BDT via ${method}`,
        referenceId: trxid,
        metadata: {
          depositAmount: amountNum,
          sessionCode: token,
          method: method
        },
        createdAt: new Date()
      };
    }

    // Handle bonus
    if (bonusInfo.bonusAmount > 0) {
      updateOperations.$inc.bonusBalance = bonusInfo.bonusAmount;

      const bonusActivityLog = {
        bonusType: bonusInfo.bonusType,
        bonusAmount: bonusInfo.bonusAmount,
        depositAmount: amountNum,
        sessionCode: token,
        transactionId: trxid,
        activatedAt: new Date(),
        status: 'active'
      };
      
      if (bonusInfo.bonusCode) {
        bonusActivityLog.bonusCode = bonusInfo.bonusCode;
      }
      
      if (!updateOperations.$push.bonusActivityLogs) {
        updateOperations.$push.bonusActivityLogs = [];
      }
      updateOperations.$push.bonusActivityLogs = bonusActivityLog;

      const activeBonusRecord = {
        bonusType: bonusInfo.bonusType,
        amount: bonusInfo.bonusAmount,
        originalAmount: bonusInfo.bonusAmount,
        wageringRequirement: bonusInfo.wageringRequirement > 0 ? bonusInfo.wageringRequirement : 
                            bonusInfo.bonusType === 'first_deposit' ? 30 : 
                            bonusInfo.bonusType === 'special_bonus' ? 30 : 3,
        amountWagered: 0,
        sessionCode: token,
        transactionId: trxid,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      };
      
      if (bonusInfo.bonusCode) {
        activeBonusRecord.bonusCode = bonusInfo.bonusCode;
      }
      
      if (!user.bonusInfo || !user.bonusInfo.activeBonuses) {
        updateOperations.$set = updateOperations.$set || {};
        updateOperations.$set["bonusInfo.activeBonuses"] = [];
      }
      
      if (!updateOperations.$push["bonusInfo.activeBonuses"]) {
        updateOperations.$push["bonusInfo.activeBonuses"] = [];
      }
      updateOperations.$push["bonusInfo.activeBonuses"] = activeBonusRecord;

      if (bonusInfo.bonusType === 'first_deposit') {
        updateOperations.$set = updateOperations.$set || {};
        updateOperations.$set["bonusInfo.firstDepositBonusClaimed"] = true;
      }
    }

    // Execute the update
    const updateResult = await usersCol.updateOne(
      { _id: user._id },
      updateOperations
    );

    if (updateResult.modifiedCount === 0) {
      throw new Error("Failed to update user record");
    }

    console.log(`✅ User balance updated: +${totalCredit} (${amountNum} + ${bonusInfo.bonusAmount} bonus)`);
    if (coinBonus > 0) {
      console.log(`✅ Added ${coinBonus} coins to user ${user.username} for deposit of ${amountNum} BDT`);
    }

    // Update deposit record
    if (originalDeposit && originalDeposit._id) {
      await depositsCol.updateOne(
        { _id: originalDeposit._id },
        {
          $set: {
            status: "completed",
            transactionId: trxid,
            sessionCode: token,
            token: token,
            method: method,
            from: from || '',
            time: time || new Date().toLocaleTimeString(),
            bdTimeZone: bdTimeZone || new Date().toISOString(),
            deviceName: deviceName || '',
            deviceId: deviceId || '',
            coinBonus: coinBonus,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
      console.log(`Updated deposit record: ${originalDeposit._id}`);
    }

    // Update user's depositHistory
    await usersCol.updateOne(
      { 
        _id: user._id,
        "depositHistory.status": "pending"
      },
      {
        $set: {
          "depositHistory.$[elem].status": "completed",
          "depositHistory.$[elem].transactionId": trxid,
          "depositHistory.$[elem].sessionCode": token,
          "depositHistory.$[elem].token": token,
          "depositHistory.$[elem].method": method,
          "depositHistory.$[elem].from": from || '',
          "depositHistory.$[elem].coinBonus": coinBonus,
          "depositHistory.$[elem].completedAt": new Date(),
          "depositHistory.$[elem].processedAt": new Date()
        }
      },
      {
        arrayFilters: [{ "elem.status": "pending" }],
        multi: false,
        sort: { "elem.createdAt": -1 }
      }
    );

    // Add the new completed deposit to history
    await usersCol.updateOne(
      { _id: user._id },
      {
        $push: {
          depositHistory: {
            $each: [depositRecord],
            $position: 0,
            $slice: 20
          }
        }
      }
    );

    // Mark as processed in OraclePay collection
    await oraclePayDepositCol.updateOne(
      { _id: insertedId },
      {
        $set: {
          processed: true,
          processedAt: new Date(),
          userId: user._id,
          username: user.username,
          amount: amountNum,
          bonusAmount: bonusInfo.bonusAmount,
          coinBonus: coinBonus,
          totalCredit: totalCredit,
          method: method,
          from: from || '',
          time: time || new Date().toLocaleTimeString(),
          bdTimeZone: bdTimeZone || new Date().toISOString(),
          deviceName: deviceName || '',
          deviceId: deviceId || '',
          userData: {
            previousBalance: user.balance || 0,
            newBalance: (user.balance || 0) + totalCredit,
            previousBonusBalance: user.bonusBalance || 0,
            newBonusBalance: (user.bonusBalance || 0) + bonusInfo.bonusAmount,
            previousCoinBalance: user.coinBalance || 0,
            newCoinBalance: (user.coinBalance || 0) + coinBonus
          },
          bonusDetails: bonusInfo
        }
      }
    );

    console.log(`✅ Successfully processed OraclePay payment for user ${user.username}: ${amountNum} ${method} + ${coinBonus} coins`);

  } catch (err) {
    console.error("OraclePay callback processing error:", err);
  }
});
  // List OraclePay deposits
  router.get("/oraclepay-deposits", async (req, res) => {
    try {
      const db = req.app.locals?.db;
      if (!db) {
        return res.status(500).json({ success: false, message: "Database not initialized" });
      }
      
      const { username, bank, processed, transaction_id, session_code } = req.query;
      const { dateFrom, dateTo, page = "1", limit = "20" } = req.query;

      const col = db.collection("OraclePay-deposit");
      const filter = {};

      if (username) {
        filter.$or = [
          { username },
          { user_identity: username }
        ];
      }
      
      if (bank) {
        filter.bank = bank;
      }
      
      if (typeof processed !== "undefined") {
        filter.processed = String(processed).toLowerCase() === "true";
      }
      
      if (transaction_id) {
        filter.transaction_id = transaction_id;
      }
      
      if (session_code) {
        filter.session_code = session_code;
      }
      
      if (dateFrom || dateTo) {
        filter.receivedAt = {};
        if (dateFrom) {
          const start = new Date(dateFrom);
          if (!isNaN(start.getTime())) filter.receivedAt.$gte = start;
        }
        if (dateTo) {
          const end = new Date(dateTo);
          if (!isNaN(end.getTime())) {
            const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
            filter.receivedAt.$lt = endExclusive;
          }
        }
      }

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      const sort = { processedAt: -1, receivedAt: -1 };

      const pipeline = [
        { $match: filter },
        { $sort: sort },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo"
          }
        },
        {
          $unwind: {
            path: "$userInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            "userInfo.password": 0,
            "userInfo.twoFactorSecret": 0
          }
        }
      ];

      const [items, total] = await Promise.all([
        col.aggregate(pipeline).toArray(),
        col.countDocuments(filter)
      ]);

      return res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
          hasMore: skip + items.length < total
        }
      });
      
    } catch (err) {
      console.error("Error fetching OraclePay deposits:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch deposits",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // Get OraclePay deposit by identifier
  router.get("/oraclepay-deposit/:identifier", async (req, res) => {
    try {
      const db = req.app.locals?.db;
      if (!db) {
        return res.status(500).json({ success: false, message: "Database not initialized" });
      }

      const { identifier } = req.params;
      const col = db.collection("OraclePay-deposit");

      const deposit = await col.findOne({
        $or: [
          { transaction_id: identifier },
          { session_code: identifier }
        ]
      });

      if (!deposit) {
        return res.status(404).json({ 
          success: false, 
          message: "Deposit not found" 
        });
      }

      let userInfo = null;
      if (deposit.userId) {
        const usersCol = db.collection("users");
        userInfo = await usersCol.findOne(
          { _id: deposit.userId },
          { projection: { password: 0, twoFactorSecret: 0 } }
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          ...deposit,
          userInfo
        }
      });

    } catch (err) {
      console.error("Error fetching OraclePay deposit:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch deposit",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  return router;
};
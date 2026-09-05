// api/index.js - Vercel serverless entry point
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// 📦 Configuration
// ============================================
const config = {
    baseURL: process.env.AIRTEL_API_URL || 'https://sandbox.airtel.africa',
    clientId: process.env.AIRTEL_CLIENT_ID,
    clientSecret: process.env.AIRTEL_CLIENT_SECRET,
    apiKey: process.env.AIRTEL_API_KEY,
    businessName: 'Pay Now Malawi',
    country: 'MWI',
    currency: 'MWK'
};

// ============================================
// 🔐 Get Access Token
// ============================================
const getAccessToken = async () => {
    try {
        const response = await axios.post(
            `${config.baseURL}/auth/oauth/token`,
            {
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'client_credentials'
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Token Error:', error.response?.data || error.message);
        throw error;
    }
};

// ============================================
// 💳 Initiate Payment
// ============================================
const initiatePayment = async (phoneNumber, amount, reference) => {
    try {
        const token = await getAccessToken();
        const transactionId = `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const payload = {
            reference: reference || transactionId,
            subscriber: {
                country: config.country,
                currency: config.currency,
                msisdn: phoneNumber
            },
            transaction: {
                amount: amount.toString(),
                id: transactionId,
                type: 'PAYMENT'
            },
            service: {
                id: 'PAY_NOW',
                name: config.businessName
            },
            payment: {
                type: 'COLLECTION',
                transaction_status: 'PENDING'
            }
        };

        const response = await axios.post(
            `${config.baseURL}/standard/v1/payments`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Country': config.country,
                    'X-Currency': config.currency,
                    'X-API-Key': config.apiKey
                }
            }
        );

        return {
            success: true,
            transactionId: transactionId,
            data: response.data,
            message: `Payment request sent to ${phoneNumber}`
        };
    } catch (error) {
        console.error('❌ Payment Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || 'Payment failed',
            details: error.response?.data
        };
    }
};

// ============================================
// 🌐 API Endpoints
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        name: 'Pay Now Malawi',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            'POST /api/payment': 'Initiate payment',
            'GET /api/status/:id': 'Check transaction',
            'POST /api/webhook': 'Receive notifications'
        }
    });
});

// Initiate payment
app.post('/api/payment', async (req, res) => {
    const { phoneNumber, amount, reference } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({
            success: false,
            error: 'Phone number and amount required'
        });
    }

    // Format phone number
    const cleanNumber = phoneNumber.replace('+', '').replace(/^0/, '');
    const formattedNumber = cleanNumber.startsWith('265') ? cleanNumber : `265${cleanNumber}`;

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Amount must be a positive number'
        });
    }

    const result = await initiatePayment(formattedNumber, amount, reference);
    res.json(result);
});

// Check transaction status
app.get('/api/status/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const token = await getAccessToken();
        const response = await axios.get(
            `${config.baseURL}/standard/v1/payments/${id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Country': config.country
                }
            }
        );
        res.json({
            success: true,
            status: response.data.transaction?.status || 'UNKNOWN',
            data: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response?.data?.message || 'Status check failed'
        });
    }
});

// Webhook endpoint
app.post('/api/webhook', (req, res) => {
    console.log('📨 Webhook Received:', req.body);
    // Process webhook data here
    res.status(200).json({ success: true });
});

// ============================================
// 🚀 Export for Vercel
// ============================================
module.exports = app;

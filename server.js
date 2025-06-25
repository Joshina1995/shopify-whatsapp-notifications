// server.js - Shopify to WhatsApp Notification Server
const express = require('express');
const bodyParser = require('body-parser');
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// Your WhatsApp number (replace with actual number)
const COMPANY_WHATSAPP = '918606532458'; // Replace with your actual WhatsApp number

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize WhatsApp client (simplified for Railway)
const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// WhatsApp client events
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, {small: true});
    console.log('Scan the QR code above with your WhatsApp to connect');
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

client.on('auth_failure', msg => {
    console.error('Authentication failed', msg);
});

// Initialize WhatsApp client
client.initialize();

// Function to send WhatsApp message
async function sendWhatsAppMessage(message) {
    try {
        await client.sendMessage(COMPANY_WHATSAPP, message);
        console.log('WhatsApp message sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return false;
    }
}

// Webhook endpoint for Shopify orders
app.post('/webhook/orders/create', async (req, res) => {
    try {
        const order = req.body;
        
        // Extract order information
        const orderNumber = order.order_number || order.name;
        const customerName = order.customer ? 
            `${order.customer.first_name} ${order.customer.last_name}` : 
            'Guest Customer';
        const totalPrice = order.total_price;
        const currency = order.currency;
        const orderDate = new Date(order.created_at).toLocaleString();
        
        // Get order items
        let itemsList = '';
        if (order.line_items && order.line_items.length > 0) {
            itemsList = order.line_items.map(item => 
                `• ${item.title} (Qty: ${item.quantity}) - ${currency} ${item.price}`
            ).join('\n');
        }
        
        // Create WhatsApp message
        const whatsappMessage = `
🛍️ *NEW ORDER RECEIVED!*

📝 *Order:* #${orderNumber}
👤 *Customer:* ${customerName}
💰 *Total:* ${currency} ${totalPrice}
📅 *Date:* ${orderDate}

*Items:*
${itemsList}

---
Shopify Notification System
        `.trim();
        
        // Send WhatsApp message
        const messageSent = await sendWhatsAppMessage(whatsappMessage);
        
        if (messageSent) {
            console.log(`Order notification sent for order #${orderNumber}`);
            res.status(200).json({ 
                success: true, 
                message: 'Notification sent successfully' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to send WhatsApp notification' 
            });
        }
        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing order notification' 
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Server is running',
        message: 'Shopify to WhatsApp notification service is active'
    });
});

// Test endpoint
app.get('/test', async (req, res) => {
    const testMessage = '🧪 Test message from Shopify notification system';
    const sent = await sendWhatsAppMessage(testMessage);
    
    res.json({
        success: sent,
        message: sent ? 'Test message sent!' : 'Failed to send test message'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Webhook URL will be: https://your-app-name.herokuapp.com/webhook/orders/create`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    client.destroy();
    process.exit(0);
});

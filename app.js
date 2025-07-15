// Telegram Bot for Decentralized ROSCA with MySQL Integration
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const mysql = require('mysql2/promise');

console.log('ethers:', typeof ethers);
console.log('ethers.utils:', typeof ethers.utils);
console.log('ethers.utils.verifyMessage:', typeof ethers.utils.verifyMessage);

const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(bodyParser.json());

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

// MySQL pool
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
});

// 1. Serve wallet auth page
app.get('/auth/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  res.send(`
    <html>
      <head>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
            background: #f7f7f7;
          }
          h2 { margin-bottom: 32px; }
          #metamask-section, #install-section {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          #metamask-section button {
            padding: 18px 40px;
            font-size: 1.3rem;
            background: #f6851b;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-top: 16px;
            transition: background 0.2s;
          }
          #metamask-section button:hover { background: #e2761b; }
          #install-section a {
            margin-top: 12px;
            font-size: 1.1rem;
            color: #f6851b;
            text-decoration: none;
            font-weight: bold;
          }
          #install-section a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h2>Wallet Authentication</h2>
        <div id="metamask-section" style="display:none;">
          <button onclick="authenticate()">Connect Wallet</button>
        </div>
        <div id="install-section" style="display:none;">
          <p><b>MetaMask is not installed.</b></p>
          <a href="https://metamask.io/download.html" target="_blank">Install MetaMask</a>
        </div>
        <script>
          window.addEventListener('DOMContentLoaded', function() {
            if (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask) {
              document.getElementById('metamask-section').style.display = 'flex';
            } else {
              document.getElementById('install-section').style.display = 'flex';
            }
          });
          async function authenticate() {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const account = accounts[0];
            const message = 'Link this wallet to Telegram ID: ${telegramId}';
            const signature = await window.ethereum.request({
              method: 'personal_sign',
              params: [message, account],
            });
            fetch('/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telegramId: '${telegramId}', account, signature, message }),
            }).then(() => {
              document.body.innerHTML = '<h3>✅ Wallet linked successfully! You can return to Telegram.</h3>';
            });
          }
        </script>
      </body>
    </html>
  `);
});

// 1a. Redirect
app.get('/auth-redirect/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  const dappUrl = `${PUBLIC_BASE_URL.replace(/^https?:\/\//, '')}/auth/${telegramId}`;
  const ua = req.headers['user-agent'] || '';
  const isMobile = /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(ua);
  if (isMobile) {
    res.redirect(`https://metamask.app.link/dapp/${dappUrl}`);
  } else {
    res.redirect(`${PUBLIC_BASE_URL}/auth/${telegramId}`);
  }
});

// 2. Callback endpoint
app.post('/auth/callback', async (req, res) => {
  const { telegramId, account, signature, message } = req.body;
  if (!telegramId || !account || !signature || !message) return res.status(400).send('Missing fields');
  try {
    const recovered = ethers.utils.verifyMessage(message, signature);
    console.log("Recovered:", recovered);
    console.log("Account:", account);
    if (recovered.toLowerCase() !== account.toLowerCase()) return res.status(400).send('Signature verification failed');

    const [userRows] = await db.execute('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
    let userId;
    if (userRows.length > 0) {
      userId = userRows[0].id;
      await db.execute('UPDATE users SET wallet_address = ? WHERE id = ?', [account, userId]);
    } else {
      const [result] = await db.execute('INSERT INTO users (telegram_id, wallet_address) VALUES (?, ?)', [telegramId, account]);
      userId = result.insertId;
    }

    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await db.execute('INSERT INTO auth_sessions (user_id, message, signature, expires_at) VALUES (?, ?, ?, ?)', [userId, message, signature, expires]);

    bot.sendMessage(telegramId, "✅ Your wallet has been successfully linked! You can now join the ROSCA.");
    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send('Internal error: ' + err.message);
  }
});

app.listen(3000, () => console.log('Express server running on port 3000'));

// --- Telegram Commands ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const redirectLink = `${PUBLIC_BASE_URL}/auth-redirect/${chatId}`;
  bot.sendMessage(
    chatId,
    "👋 Welcome to the Decentralized ROSCA!\n\nTo participate, please authenticate your wallet:\n\n" +
      "• On mobile: If you have MetaMask installed, this will open MetaMask for authentication. If not, you'll be prompted to install it.\n" +
      "• On desktop: This will open the dapp in your browser.",
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Authenticate Wallet", url: redirectLink }]],
      },
    }
  );
});

bot.onText(/\/join/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'You have requested to join the ROSCA group. (Stub)');
});

bot.onText(/\/contribute/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Your contribution is being processed. (Stub)');
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Your current status: (Stub)');
});

bot.onText(/\/history/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Transaction history: (Stub)');
});

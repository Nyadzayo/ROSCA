// Telegram Bot for Decentralized ROSCA
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
// Integration layer (to be implemented in integration/rosca.js)
// const rosca = require('./integration/rosca');

const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers'); // Correct import

console.log('ethers:', typeof ethers); // should print 'object'
console.log('ethers.utils:', typeof ethers.utils); // should print 'object'
console.log('ethers.utils.verifyMessage:', typeof ethers.utils.verifyMessage); // should print 'function'
const app = express();
app.use(bodyParser.json());

// In-memory mapping: telegramId -> walletAddress
const userWallets = {};

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

// 1. Endpoint to serve wallet authentication page/link
app.get('/auth/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  // In production, serve a real HTML page with wallet connect logic
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
          h2 {
            margin-bottom: 32px;
          }
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
          #metamask-section button:hover {
            background: #e2761b;
          }
          #install-section a {
            margin-top: 12px;
            font-size: 1.1rem;
            color: #f6851b;
            text-decoration: none;
            font-weight: bold;
          }
          #install-section a:hover {
            text-decoration: underline;
          }
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
          // Detect MetaMask
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
            // Send to backend for verification
            fetch('/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telegramId: '${telegramId}', account, signature, message }),
            }).then(() => {
              document.body.innerHTML = '<h3>Wallet linked! You can return to Telegram.</h3>';
            });
          }
        </script>
      </body>
    </html>
  `);
});

// 1a. Redirect endpoint for platform detection
app.get('/auth-redirect/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  // Remove protocol for MetaMask deep link
  const dappUrl = `${PUBLIC_BASE_URL.replace(/^https?:\/\//, '')}/auth/${telegramId}`;
  const metamaskDeepLink = `https://metamask.app.link/dapp/${dappUrl}`;
  const normalLink = `${PUBLIC_BASE_URL}/auth/${telegramId}`;
  const ua = req.headers['user-agent'] || '';
  const isMobile = /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(ua);
  if (isMobile) {
    res.redirect(metamaskDeepLink);
  } else {
    res.redirect(normalLink);
  }
});

// 2. Endpoint to verify signature and link wallet
app.post('/auth/callback', (req, res) => {
  console.log("Callback hit. Body:", req.body);
  const { telegramId, account, signature, message } = req.body;
  if (!telegramId || !account || !signature || !message) {
    res.status(400).send('Missing required fields');
    return;
  }
  try {
    const recovered = ethers.utils.verifyMessage(message, signature);
    console.log("Recovered:", recovered);
    console.log("Account:", account);
    if (recovered.toLowerCase() === account.toLowerCase()) {
      userWallets[telegramId] = account;
      res.sendStatus(200);
      bot.sendMessage(telegramId, "✅ Your wallet has been successfully linked! You can now join the ROSCA.")
        .catch(err => console.error("Telegram sendMessage error:", err));
    } else {
      res.status(400).send('Signature verification failed');
    }
  } catch (err) {
    console.error("Internal error:", err);
    res.status(500).send('Internal error: ' + err.message);
  }
});

app.listen(3000, () => console.log('Express server running on port 3000'));


// --- Command: /start ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const redirectLink = `${PUBLIC_BASE_URL}/auth-redirect/${chatId}`;
  bot.sendMessage(
    chatId,
    "Welcome to the Decentralized ROSCA!\n\nTo participate, please authenticate your wallet:\n\n" +
    "• On mobile: If you have MetaMask installed, this will open MetaMask for authentication. If not, you'll be prompted to install it.\n" +
    "• On desktop: This will open the dapp in your browser.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Authenticate Wallet", url: redirectLink }
          ]
        ]
      }
    }
  );
});

// --- Command: /join ---
bot.onText(/\/join/, async (msg) => {
  const chatId = msg.chat.id;
  // TODO: Call integration layer to register user in ROSCA group
  // await rosca.joinGroup(chatId);
  bot.sendMessage(chatId, 'You have requested to join the ROSCA group. (Stub)');
});

// --- Command: /contribute ---
bot.onText(/\/contribute/, async (msg) => {
  const chatId = msg.chat.id;
  // TODO: Trigger contribution transaction via integration layer
  // await rosca.contribute(chatId);
  bot.sendMessage(chatId, 'Your contribution is being processed. (Stub)');
});

// --- Command: /status ---
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  // TODO: Fetch user/group status from integration layer
  // const status = await rosca.getStatus(chatId);
  bot.sendMessage(chatId, 'Your current status: (Stub)');
});

// --- Command: /history ---
bot.onText(/\/history/, async (msg) => {
  const chatId = msg.chat.id;
  // TODO: Fetch/export transaction history from integration layer
  // const history = await rosca.getHistory(chatId);
  bot.sendMessage(chatId, 'Transaction history: (Stub)');
});

// --- KYC & Reputation (Basic) ---
// In production, collect phone/email and verify via Telegram
// Store minimal info for KYC and reputation tracking

// --- Notifications ---
// Use bot.sendMessage(chatId, ...) to notify users of events (contribution due, payout, missed payment)

// --- Integration Points ---
// All contract and Hedera logic should be implemented in integration/rosca.js (to be created)

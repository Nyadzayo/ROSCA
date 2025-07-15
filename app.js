// Telegram Bot for Decentralized ROSCA
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
// Integration layer (to be implemented in integration/rosca.js)
// const rosca = require('./integration/rosca');

const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// --- Command: /start ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to the Decentralized ROSCA! Use /join to participate.');
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

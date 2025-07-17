require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');


const factoryArtifact = require('./artifacts/contracts/ROSCAFactory.sol/ROSCAFactory.json');
const groupArtifact = require('./artifacts/contracts/ROSCAFactory.sol/ROSCAGroup.json');

const FACTORY_ABI = factoryArtifact.abi;
const GROUP_ABI = groupArtifact.abi;

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
app.use(bodyParser.json());

// Database setup
const db = new sqlite3.Database('./rosca_bot.db');

// Initialize database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        telegram_id TEXT PRIMARY KEY,
        wallet_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS user_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        group_id INTEGER,
        wallet_address TEXT,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users (telegram_id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Blockchain configuration
const provider = new ethers.providers.JsonRpcProvider(process.env.TESTNET_ENDPOINT || 'http://localhost:8545');
const factoryAddress = process.env.FACTORY_ADDRESS || ''; // Deploy and set this
const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);

// In-memory user states for conversation flows
const userStates = {};

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

// Utility functions
const formatEther = (wei) => ethers.utils.formatEther(wei);
const parseEther = (ether) => ethers.utils.parseEther(ether);
const normalizeAddress = (addr) => (addr ? addr.toLowerCase() : addr);

// Helper to normalize all addresses in an array
const normalizeAddresses = (arr) => arr.map(normalizeAddress);

// Database helper functions
const getUser = (telegramId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE telegram_id = ?", [telegramId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const saveUser = (telegramId, walletAddress) => {
    return new Promise((resolve, reject) => {
        db.run("INSERT OR REPLACE INTO users (telegram_id, wallet_address) VALUES (?, ?)", 
            [telegramId, walletAddress], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
    });
};

const getUserGroups = (telegramId) => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM user_groups WHERE telegram_id = ?", [telegramId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const saveUserGroup = (telegramId, groupId, walletAddress) => {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO user_groups (telegram_id, group_id, wallet_address) VALUES (?, ?, ?)", 
            [telegramId, groupId, walletAddress], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
    });
};

// Web endpoints for wallet authentication
app.get('/auth/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ROSCA Wallet Authentication</title>
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    color: #333;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 16px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                }
                h2 {
                    color: #333;
                    margin-bottom: 24px;
                    font-size: 24px;
                }
                p {
                    color: #666;
                    margin-bottom: 32px;
                    line-height: 1.6;
                }
                button {
                    padding: 16px 32px;
                    font-size: 16px;
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: 600;
                    width: 100%;
                }
                button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                }
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .status {
                    margin-top: 16px;
                    padding: 12px;
                    border-radius: 8px;
                    font-weight: 500;
                }
                .success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                .error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
                .install-link {
                    display: inline-block;
                    margin-top: 16px;
                    padding: 12px 24px;
                    background: #f6851b;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    transition: background 0.3s ease;
                }
                .install-link:hover {
                    background: #e2761b;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🔐 Wallet Authentication</h2>
                <p>Connect your wallet to participate in ROSCA groups</p>
                
                <div id="metamask-section" style="display:none;">
                    <button onclick="authenticate()">Connect MetaMask</button>
                </div>
                
                <div id="install-section" style="display:none;">
                    <p><strong>MetaMask is not installed</strong></p>
                    <a href="https://metamask.io/download.html" target="_blank" class="install-link">Install MetaMask</a>
                </div>
                
                <div id="status"></div>
            </div>
            
            <script>
                const statusDiv = document.getElementById('status');
                
                function showStatus(message, type = 'info') {
                    statusDiv.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
                }
                
                window.addEventListener('DOMContentLoaded', function() {
                    if (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask) {
                        document.getElementById('metamask-section').style.display = 'block';
                    } else {
                        document.getElementById('install-section').style.display = 'block';
                    }
                });

                async function authenticate() {
                    const button = document.querySelector('button');
                    button.disabled = true;
                    button.textContent = 'Connecting...';
                    
                    try {
                        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                        const account = accounts[0];
                        const message = 'Link this wallet to Telegram ID: ${telegramId}';
                        
                        showStatus('Please sign the message in MetaMask...', 'info');
                        
                        const signature = await window.ethereum.request({
                            method: 'personal_sign',
                            params: [message, account],
                        });
                        
                        showStatus('Verifying signature...', 'info');
                        
                        const response = await fetch('/auth/callback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                telegramId: '${telegramId}', 
                                account, 
                                signature, 
                                message 
                            }),
                        });
                        
                        if (response.ok) {
                            showStatus('✅ Wallet linked successfully! You can return to Telegram.', 'success');
                        } else {
                            const error = await response.text();
                            showStatus('❌ Error: ' + error, 'error');
                        }
                    } catch (error) {
                        showStatus('❌ Error: ' + error.message, 'error');
                    } finally {
                        button.disabled = false;
                        button.textContent = 'Connect MetaMask';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/auth-redirect/:telegramId', (req, res) => {
    const { telegramId } = req.params;
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

app.post('/auth/callback', async (req, res) => {
    const { telegramId, account, signature, message } = req.body;
    
    if (!telegramId || !account || !signature || !message) {
        return res.status(400).send('Missing required fields');
    }
    
    try {
        const recovered = ethers.utils.verifyMessage(message, signature);
        
        if (recovered.toLowerCase() === account.toLowerCase()) {
            await saveUser(telegramId, account);
            res.sendStatus(200);
            
            bot.sendMessage(telegramId, 
                "✅ Your wallet has been successfully linked!\n\n" +
                `📱 Wallet: ${account.slice(0, 6)}...${account.slice(-4)}\n\n` +
                "You can now:\n" +
                "• Create new ROSCA groups\n" +
                "• Join existing groups\n" +
                "• Participate in contributions\n\n" +
                "Use /help to see all available commands"
            ).catch(err => console.error("Telegram sendMessage error:", err));
        } else {
            res.status(400).send('Signature verification failed');
        }
    } catch (err) {
        console.error("Internal error:", err);
        res.status(500).send('Internal error: ' + err.message);
    }
});

app.listen(3000, () => console.log('Express server running on port 3000'));

// Telegram Bot Commands

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId.toString());
    
    if (user && user.wallet_address) {
        bot.sendMessage(chatId, 
            "🎉 Welcome back to ROSCA!\n\n" +
            `Your wallet: ${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}\n\n` +
            "What would you like to do?",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📋 Browse Groups", callback_data: "browse_groups" },
                            { text: "➕ Create Group", callback_data: "create_group" }
                        ],
                        [
                            { text: "👥 My Groups", callback_data: "my_groups" },
                            { text: "💰 Contribute", callback_data: "contribute_menu" }
                        ],
                        [
                            { text: "📊 Status", callback_data: "status" },
                            { text: "❓ Help", callback_data: "help" }
                        ]
                    ]
                }
            }
        );
    } else {
        const redirectLink = `${PUBLIC_BASE_URL}/auth-redirect/${chatId}`;
        bot.sendMessage(chatId,
            "🔐 Welcome to Decentralized ROSCA!\n\n" +
            "ROSCA (Rotating Savings and Credit Association) allows groups to pool money and take turns receiving payouts.\n\n" +
            "To get started, please connect your wallet:",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🔗 Connect Wallet", url: redirectLink }
                        ]
                    ]
                }
            }
        );
    }
});

// Help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        "🤖 ROSCA Bot Commands:\n\n" +
        "🔐 /start - Connect wallet and main menu\n" +
        "📋 /browse - Browse available groups\n" +
        "➕ /create - Create a new ROSCA group\n" +
        "👥 /mygroups - View your groups\n" +
        "💰 /contribute - Make contributions\n" +
        "📊 /status - Check your status\n" +
        "📈 /history - View transaction history\n" +
        "❓ /help - Show this help\n\n" +
        "💡 How ROSCA works:\n" +
        "1. Join a group with fixed contribution amount\n" +
        "2. Everyone contributes each cycle\n" +
        "3. One person receives all contributions (payout)\n" +
        "4. Continues until everyone has received a payout\n\n" +
        "Questions? Contact @your_support_handle"
    );
});

// Browse groups command
bot.onText(/\/browse/, async (msg) => {
    const chatId = msg.chat.id;
    await showAvailableGroups(chatId);
});

// Create group command
bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId.toString());
    
    if (!user || !user.wallet_address) {
        bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
        return;
    }
    
    userStates[chatId] = { action: 'create_group', step: 'name' };
    bot.sendMessage(chatId, 
        "🎯 Let's create a new ROSCA group!\n\n" +
        "Step 1/5: What's the name of your group?\n" +
        "Example: 'Monthly Savings Circle'"
    );
});

// My groups command
bot.onText(/\/mygroups/, async (msg) => {
    const chatId = msg.chat.id;
    await showMyGroups(chatId);
});

// Contribute command
bot.onText(/\/contribute/, async (msg) => {
    const chatId = msg.chat.id;
    await showContributeMenu(chatId);
});

// Status command
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    await showUserStatus(chatId);
});

// History command
bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    await showUserHistory(chatId);
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    
    bot.answerCallbackQuery(callbackQuery.id);
    
    switch (data) {
        case 'browse_groups':
            await showAvailableGroups(chatId);
            break;
        case 'create_group':
            const user = await getUser(chatId.toString());
            if (!user || !user.wallet_address) {
                bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
                return;
            }
            userStates[chatId] = { action: 'create_group', step: 'name' };
            bot.sendMessage(chatId, 
                "🎯 Let's create a new ROSCA group!\n\n" +
                "Step 1/5: What's the name of your group?\n" +
                "Example: 'Monthly Savings Circle'"
            );
            break;
        case 'my_groups':
            await showMyGroups(chatId);
            break;
        case 'contribute_menu':
            await showContributeMenu(chatId);
            break;
        case 'status':
            await showUserStatus(chatId);
            break;
        case 'help':
            bot.sendMessage(chatId, 
                "🤖 ROSCA Bot Commands:\n\n" +
                "🔐 /start - Connect wallet and main menu\n" +
                "📋 /browse - Browse available groups\n" +
                "➕ /create - Create a new ROSCA group\n" +
                "👥 /mygroups - View your groups\n" +
                "💰 /contribute - Make contributions\n" +
                "📊 /status - Check your status\n" +
                "📈 /history - View transaction history\n" +
                "❓ /help - Show this help"
            );
            break;
        default:
            if (data.startsWith('join_group_')) {
                const groupId = data.replace('join_group_', '');
                await handleJoinGroup(chatId, groupId);
            } else if (data.startsWith('group_details_')) {
                const groupId = data.replace('group_details_', '');
                await showGroupDetails(chatId, groupId);
            } else if (data.startsWith('contribute_')) {
                const groupId = data.replace('contribute_', '');
                await handleContribute(chatId, groupId);
            } else if (data.startsWith('group_status_')) {
                const groupId = data.replace('group_status_', '');
                await showGroupStatus(chatId, groupId);
            }
    }
});

// Handle text messages for conversation flows
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const userState = userStates[chatId];
    if (!userState) return;
    
    if (userState.action === 'create_group') {
        await handleCreateGroupFlow(chatId, text, userState);
    }
});

// Helper functions
async function showAvailableGroups(chatId) {
    try {
        const groups = await factoryContract.getActiveGroups(0, 10);
        
        if (groups.length === 0) {
            bot.sendMessage(chatId, 
                "📋 No active groups found.\n\n" +
                "Be the first to create one! Use /create"
            );
            return;
        }
        
        let message = "📋 Available ROSCA Groups:\n\n";
        const keyboard = [];
        
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const contributionETH = formatEther(group.contributionAmount);
            const durationDays = Math.floor(group.cycleDuration / 86400);
            
            message += `${i + 1}. ${group.name}\n`;
            message += `    💰 ${contributionETH} ETH per cycle\n`;
            message += `    👥 ${group.currentParticipants}/${group.maxParticipants} members\n`;
            message += `    ⏰ ${durationDays} days per cycle\n\n`;
            
            keyboard.push([
                { text: `Join ${group.name}`, callback_data: `join_group_${i}` },
                { text: `📄 Details`, callback_data: `group_details_${i}` }
            ]);
        }
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        bot.sendMessage(chatId, "❌ Error fetching groups. Please try again.");
    }
}

async function showMyGroups(chatId) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const userGroups = await getUserGroups(chatId.toString());
        
        if (userGroups.length === 0) {
            bot.sendMessage(chatId, 
                "👥 You haven't joined any groups yet.\n\n" +
                "Browse available groups with /browse"
            );
            return;
        }
        
        let message = "👥 Your ROSCA Groups:\n\n";
        const keyboard = [];
        
        for (const userGroup of userGroups) {
            try {
                const groupMetadata = await factoryContract.getGroupMetadata(userGroup.group_id);
                const contributionETH = formatEther(groupMetadata.contributionAmount);
                
                message += `📊 ${groupMetadata.name}\n`;
                message += `    💰 ${contributionETH} ETH per cycle\n`;
                message += `    Status: ${groupMetadata.isActive ? '🟢 Active' : '🔴 Completed'}\n\n`;
                
                keyboard.push([
                    { text: `📊 ${groupMetadata.name} Status`, callback_data: `group_status_${userGroup.group_id}` },
                    { text: `💰 Contribute`, callback_data: `contribute_${userGroup.group_id}` }
                ]);
            } catch (error) {
                console.error(`Error fetching group ${userGroup.group_id}:`, error);
            }
        }
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (error) {
        console.error('Error showing my groups:', error);
        bot.sendMessage(chatId, "❌ Error fetching your groups. Please try again.");
    }
}

async function showContributeMenu(chatId) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const userGroups = await getUserGroups(chatId.toString());
        
        if (userGroups.length === 0) {
            bot.sendMessage(chatId, 
                "💰 You haven't joined any groups yet.\n\n" +
                "Browse available groups with /browse"
            );
            return;
        }
        
        let message = "💰 Select a group to contribute to:\n\n";
        const keyboard = [];
        
        for (const userGroup of userGroups) {
            try {
                const groupMetadata = await factoryContract.getGroupMetadata(userGroup.group_id);
                if (groupMetadata.isActive) {
                    const contributionETH = formatEther(groupMetadata.contributionAmount);
                    
                    message += `💳 ${groupMetadata.name} - ${contributionETH} ETH\n`;
                    
                    keyboard.push([
                        { text: `💰 Contribute to ${groupMetadata.name}`, callback_data: `contribute_${userGroup.group_id}` }
                    ]);
                }
            } catch (error) {
                console.error(`Error fetching group ${userGroup.group_id}:`, error);
            }
        }
        
        if (keyboard.length === 0) {
            bot.sendMessage(chatId, "💰 No active groups to contribute to.");
            return;
        }
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (error) {
        console.error('Error showing contribute menu:', error);
        bot.sendMessage(chatId, "❌ Error fetching contribution options. Please try again.");
    }
}

async function showUserStatus(chatId) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const userGroups = await getUserGroups(chatId.toString());
        
        let message = "📊 Your ROSCA Status:\n\n";
        message += `👤 Wallet: ${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}\n`;
        message += `👥 Groups: ${userGroups.length}\n\n`;
        
        if (userGroups.length === 0) {
            message += "No groups joined yet.";
        } else {
            for (const userGroup of userGroups) {
                try {
                    const groupMetadata = await factoryContract.getGroupMetadata(userGroup.group_id);
                    const groupContract = new ethers.Contract(groupMetadata.groupAddress, GROUP_ABI, provider);
                    const userStatus = await groupContract.getUserStatus(user.wallet_address);
                    
                    message += `📊 ${groupMetadata.name}:\n`;
                    message += `    Status: ${groupMetadata.isActive ? '🟢 Active' : '🔴 Completed'}\n`;
                    message += `    Contributed this cycle: ${userStatus._hasContributedThisCycle ? '✅' : '❌'}\n`;
                    message += `    Total contributions: ${userStatus._totalContributions}\n`;
                    message += `    Received payout: ${userStatus._hasReceivedPayout ? '✅' : '❌'}\n\n`;
                } catch (error) {
                    console.error(`Error fetching status for group ${userGroup.group_id}:`, error);
                }
            }
        }
        
        bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error showing user status:', error);
        bot.sendMessage(chatId, "❌ Error fetching your status. Please try again.");
    }
}

async function showUserHistory(chatId) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const userGroups = await getUserGroups(chatId.toString());
        
        let message = "📈 Your Transaction History:\n\n";
        
        if (userGroups.length === 0) {
            message += "No transaction history yet.";
        } else {
            for (const userGroup of userGroups) {
                try {
                    const groupMetadata = await factoryContract.getGroupMetadata(userGroup.group_id);
                    const groupContract = new ethers.Contract(groupMetadata.groupAddress, GROUP_ABI, provider);
                    const payoutHistory = (await groupContract.getPayoutHistory()).map(payout => ({
                        ...payout,
                        recipient: normalizeAddress(payout.recipient)
                    }));
                    
                    message += `📊 ${groupMetadata.name}:\n`;
                    
                    if (payoutHistory.length === 0) {
                        message += "    No payouts yet\n\n";
                    } else {
                        for (const payout of payoutHistory) {
                            const date = new Date(payout.timestamp * 1000).toLocaleDateString();
                            const amount = formatEther(payout.amount);
                            const isYou = normalizeAddress(payout.recipient) === normalizeAddress(user.wallet_address);
                            
                            message += `    ${isYou ? '💰 Received' : '📤 Payout'}: ${amount} ETH (${date})\n`;
                        }
                        message += "\n";
                    }
                } catch (error) {
                    console.error(`Error fetching history for group ${userGroup.group_id}:`, error);
                }
            }
        }
        
        bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error showing user history:', error);
        bot.sendMessage(chatId, "❌ Error fetching your history. Please try again.");
    }
}

async function handleCreateGroupFlow(chatId, text, userState) {
    switch (userState.step) {
        case 'name':
            userState.groupData = { name: text };
            userState.step = 'description';
            bot.sendMessage(chatId, 
                "Step 2/5: Provide a brief description of your group\n" +
                "Example: 'Monthly savings for young professionals'"
            );
            break;
            
        case 'description':
            userState.groupData.description = text;
            userState.step = 'amount';
            bot.sendMessage(chatId, 
                "Step 3/5: What's the contribution amount per cycle? (in ETH)\n" +
                "Example: 0.1"
            );
            break;
            
        case 'amount':
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                bot.sendMessage(chatId, "❌ Please enter a valid amount greater than 0");
                return;
            }
            userState.groupData.amount = amount;
            userState.step = 'duration';
            bot.sendMessage(chatId, 
                "Step 4/5: How many days should each cycle last?\n" +
                "Example: 30 (for monthly cycles)"
            );
            break;
            
        case 'duration':
            const days = parseInt(text);
            if (isNaN(days) || days <= 0) {
                bot.sendMessage(chatId, "❌ Please enter a valid number of days greater than 0");
                return;
            }
            userState.groupData.duration = days * 86400; // Convert to seconds
            userState.step = 'participants';
            bot.sendMessage(chatId, 
                "Step 5/5: Maximum number of participants? (2-50)\n" +
                "Example: 10"
            );
            break;
            
        case 'participants':
            const maxParticipants = parseInt(text);
            if (isNaN(maxParticipants) || maxParticipants < 2 || maxParticipants > 50) {
                bot.sendMessage(chatId, "❌ Please enter a number between 2 and 50");
                return;
            }
            userState.groupData.maxParticipants = maxParticipants;
            
            // Show summary and create group
            const { name, description, amount: grpAmount, duration, maxParticipants: maxP } = userState.groupData;
            const durationDays = duration / 86400;
            
            bot.sendMessage(chatId, 
                "📋 Group Summary:\n\n" +
                `📝 Name: ${name}\n` +
                `📄 Description: ${description}\n` +
                `💰 Contribution: ${grpAmount} ETH per cycle\n` +
                `⏰ Duration: ${durationDays} days per cycle\n` +
                `👥 Max Participants: ${maxP}\n\n` +
                "Creating group... Please wait."
            );
            
            await createGroup(chatId, userState.groupData);
            delete userStates[chatId];
            break;
    }
}

async function createGroup(chatId, groupData) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Wallet not connected");
            return;
        }
        
        const { name, description, amount, duration, maxParticipants } = groupData;
        
        // Generate transaction instructions
        const amountWei = parseEther(amount.toString());
        const factoryInterface = new ethers.utils.Interface(FACTORY_ABI);
        const calldata = factoryInterface.encodeFunctionData('createGroup', [
            amountWei,
            duration,
            maxParticipants,
            name,
            description
        ]);
        
        const message = 
            "🚀 Group creation transaction ready!\n\n" +
            "📋 Transaction Details:\n" +
            `📍 Contract: ${factoryAddress}\n` +
            `💰 Value: ${amount} ETH (your initial contribution)\n` +
            `⛽ Gas: ~200,000 units\n\n` +
            "📱 Instructions:\n" +
            "1. Copy the transaction data below\n" +
            "2. Open MetaMask\n" +
            "3. Send transaction to the contract address\n" +
            "4. Use the provided data\n\n" +
            `📊 Transaction Data:\n` +
            `\`${calldata}\`\n\n` +
            `⚠️ Make sure to include exactly ${amount} ETH as the transaction value!`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        // You could also integrate with a wallet service here
        // For now, we'll provide manual instructions
        
    } catch (error) {
        console.error('Error creating group:', error);
        bot.sendMessage(chatId, "❌ Error creating group. Please try again.");
    }
}

async function handleJoinGroup(chatId, groupIndex) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const groups = await factoryContract.getActiveGroups(0, 10);
        const groupIdx = parseInt(groupIndex);
        
        if (groupIdx >= groups.length) {
            bot.sendMessage(chatId, "❌ Invalid group selection");
            return;
        }
        
        const group = groups[groupIdx];
        const contributionETH = formatEther(group.contributionAmount);
        
        // Generate transaction instructions
        const factoryInterface = new ethers.utils.Interface(FACTORY_ABI);
        const calldata = factoryInterface.encodeFunctionData('joinGroup', [groupIdx + 1]); // Group IDs start from 1
        
        const message = 
            `🎯 Join "${group.name}"\n\n` +
            "📋 Transaction Details:\n" +
            `📍 Contract: ${factoryAddress}\n` +
            `💰 Value: ${contributionETH} ETH\n` +
            `⛽ Gas: ~150,000 units\n\n` +
            "📱 Instructions:\n" +
            "1. Copy the transaction data below\n" +
            "2. Open MetaMask\n" +
            "3. Send transaction to the contract address\n" +
            "4. Use the provided data\n\n" +
            `📊 Transaction Data:\n` +
            `\`${calldata}\`\n\n` +
            `⚠️ Make sure to include exactly ${contributionETH} ETH as the transaction value!`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Error joining group:', error);
        bot.sendMessage(chatId, "❌ Error joining group. Please try again.");
    }
}

async function handleContribute(chatId, groupId) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const groupMetadata = await factoryContract.getGroupMetadata(groupId);
        const groupContract = new ethers.Contract(groupMetadata.groupAddress, GROUP_ABI, provider);
        const userStatus = await groupContract.getUserStatus(user.wallet_address);
        
        if (!userStatus._isEnrolled) {
            bot.sendMessage(chatId, "❌ You are not a member of this group");
            return;
        }
        
        if (userStatus._hasContributedThisCycle) {
            bot.sendMessage(chatId, "✅ You have already contributed to this cycle");
            return;
        }
        
        const contributionETH = formatEther(groupMetadata.contributionAmount);
        
        // Generate transaction instructions
        const groupInterface = new ethers.utils.Interface(GROUP_ABI);
        const calldata = groupInterface.encodeFunctionData('contribute', []);
        
        const message = 
            `💰 Contribute to "${groupMetadata.name}"\n\n` +
            "📋 Transaction Details:\n" +
            `📍 Contract: ${groupMetadata.groupAddress}\n` +
            `💰 Value: ${contributionETH} ETH\n` +
            `⛽ Gas: ~100,000 units\n\n` +
            "📱 Instructions:\n" +
            "1. Copy the transaction data below\n" +
            "2. Open MetaMask\n" +
            "3. Send transaction to the contract address\n" +
            "4. Use the provided data\n\n" +
            `📊 Transaction Data:\n` +
            `\`${calldata}\`\n\n` +
            `⚠️ Make sure to include exactly ${contributionETH} ETH as the transaction value!`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Error contributing:', error);
        bot.sendMessage(chatId, "❌ Error processing contribution. Please try again.");
    }
}

async function showGroupDetails(chatId, groupIndex) {
    try {
        const groups = await factoryContract.getActiveGroups(0, 10);
        const groupIdx = parseInt(groupIndex);
        
        if (groupIdx >= groups.length) {
            bot.sendMessage(chatId, "❌ Invalid group selection");
            return;
        }
        
        const group = groups[groupIdx];
        group.creator = normalizeAddress(group.creator);
        const contributionETH = formatEther(group.contributionAmount);
        const durationDays = Math.floor(group.cycleDuration / 86400);
        const createdDate = new Date(group.createdAt * 1000).toLocaleDateString();
        
        const user = await getUser(chatId.toString());
        const creatorDisplay = normalizeAddress(group.creator) === normalizeAddress(user?.wallet_address)
            ? `${group.creator.slice(0, 6)}...${group.creator.slice(-4)} (You)`
            : `${group.creator.slice(0, 6)}...${group.creator.slice(-4)}`;
        const message = 
            `📋 Group Details\n\n` +
            `📝 Name: ${group.name}\n` +
            `📄 Description: ${group.description}\n` +
            `💰 Contribution: ${contributionETH} ETH per cycle\n` +
            `⏰ Cycle Duration: ${durationDays} days\n` +
            `👥 Participants: ${group.currentParticipants}/${group.maxParticipants}\n` +
            `👤 Creator: ${creatorDisplay}\n` +
            `📅 Created: ${createdDate}\n` +
            `🔗 Contract: ${group.groupAddress.slice(0, 6)}...${group.groupAddress.slice(-4)}`;
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Join ${group.name}`, callback_data: `join_group_${groupIndex}` }]
                ]
            }
        });
        
    } catch (error) {
        console.error('Error showing group details:', error);
        bot.sendMessage(chatId, "❌ Error fetching group details. Please try again.");
    }
}

async function showGroupStatus(chatId, groupId) {
    try {
        const user = await getUser(chatId.toString());
        if (!user || !user.wallet_address) {
            bot.sendMessage(chatId, "❌ Please connect your wallet first using /start");
            return;
        }
        
        const groupMetadata = await factoryContract.getGroupMetadata(groupId);
        const groupContract = new ethers.Contract(groupMetadata.groupAddress, GROUP_ABI, provider);
        const groupInfo = await groupContract.getGroupInfo();
        const cycleInfo = await groupContract.getCurrentCycleInfo();
        const participants = normalizeAddresses(await groupContract.getParticipants());
        
        const contributionETH = formatEther(groupInfo[1]); // contributionAmount
        const maxParticipants = groupInfo[3]; // maxParticipants from the specific group contract
        const currentCycle = cycleInfo[0].toString(); // currentCycleNumber
        const balance = formatEther(cycleInfo[1]); // currentBalance
        const contributionsThisCycle = cycleInfo[2].toString(); // contributionsThisCycle
        const recipient = cycleInfo[4]; // currentRecipient
        const timeRemainingSec = Number(cycleInfo[5].toString()); // timeRemaining
        
        let timeRemainingStr;
        if (timeRemainingSec > 0) {
            const days = Math.floor(timeRemainingSec / 86400);
            const hours = Math.floor((timeRemainingSec % 86400) / 3600);
            const minutes = Math.floor((timeRemainingSec % 3600) / 60);
            timeRemainingStr = `${days}d ${hours}h ${minutes}m`;
        } else {
            timeRemainingStr = "Cycle Ended";
        }

        const recipientDisplay = recipient === ethers.constants.AddressZero 
            ? "Not determined yet" 
            : `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;

        const participantsList = participants.map((p, index) => 
            `  ${index + 1}. ${p.slice(0, 8)}...${p.slice(-6)} ${normalizeAddress(p) === normalizeAddress(user.wallet_address) ? '(You)' : ''}`
        ).join('\n');
            
        const message = 
            `📊 *Group Status: ${groupMetadata.name}*\n\n` +
            `🔹 *Status*: ${groupMetadata.isActive ? '🟢 Active' : '🔴 Completed'}\n` +
            `🔄 *Current Cycle*: ${currentCycle} / ${maxParticipants}\n` +
            `💰 *Current Pot*: ${balance} ETH\n` +
            `📥 *Contributions*: ${contributionsThisCycle} of ${participants.length} made\n` +
            `⏰ *Time Remaining*: ${timeRemainingStr}\n` +
            `🏆 *Payout Recipient*: ${recipientDisplay}\n\n` +
            `👥 *Participants (${participants.length}/${maxParticipants})*:\n` +
            `${participantsList}\n\n` +
            `🔗 *Contract*: \`${groupMetadata.groupAddress}\``;
            
        bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: `💰 Contribute (${contributionETH} ETH)`, callback_data: `contribute_${groupId}` }
                    ],
                    [
                        { text: '⬅️ Back to My Groups', callback_data: 'my_groups' }
                    ]
                ]
            }
        });
        
    } catch (error) {
        console.error('Error showing group status:', error);
        bot.sendMessage(chatId, "❌ Error fetching group status. The group might be inactive or there was a network issue. Please try again.");
    }
}

// Mini admin frontend to visualize database data
app.get('/admin', async (req, res) => {
  db.serialize(() => {
      db.all('SELECT * FROM users', (err, users) => {
          if (err) return res.status(500).send('Error fetching users');
          db.all('SELECT * FROM user_groups', (err2, userGroups) => {
              if (err2) return res.status(500).send('Error fetching user_groups');
              res.send(`
                  <html>
                  <head>
                      <title>ROSCA Bot Admin</title>
                      <style>
                          body { font-family: sans-serif; margin: 40px; background: #f7f7f7; }
                          h1 { color: #333; }
                          table { border-collapse: collapse; margin-bottom: 40px; width: 100%; background: #fff; }
                          th, td { border: 1px solid #ccc; padding: 8px 12px; }
                          th { background: #eee; }
                      </style>
                  </head>
                  <body>
                      <h1>Users</h1>
                      <table>
                          <tr><th>telegram_id</th><th>wallet_address</th><th>created_at</th></tr>
                          ${users.map(u => `<tr><td>${u.telegram_id}</td><td>${u.wallet_address}</td><td>${u.created_at}</td></tr>`).join('')}
                      </table>
                      <h1>User Groups</h1>
                      <table>
                          <tr><th>id</th><th>telegram_id</th><th>group_id</th><th>wallet_address</th><th>joined_at</th></tr>
                          ${userGroups.map(g => `<tr><td>${g.id}</td><td>${g.telegram_id}</td><td>${g.group_id}</td><td>${g.wallet_address}</td><td>${g.joined_at}</td></tr>`).join('')}
                      </table>
                  </body>
                  </html>
              `);
          });
      });
  });
});

// Temporary admin route to link all users' wallet addresses to group_id 1 in user_groups
app.get('/admin/link-wallets-to-group1', async (req, res) => {
  db.all('SELECT telegram_id, wallet_address FROM users', (err, users) => {
      if (err) return res.status(500).send('Error fetching users');
      let inserted = 0, skipped = 0, errors = 0;
      const groupId = 1;
      const checkAndInsert = (user, cb) => {
          db.get('SELECT * FROM user_groups WHERE telegram_id = ? AND group_id = ?', [user.telegram_id, groupId], (err2, row) => {
              if (err2) { errors++; return cb(); }
              if (row) { skipped++; return cb(); }
              db.run('INSERT INTO user_groups (telegram_id, group_id, wallet_address) VALUES (?, ?, ?)', [user.telegram_id, groupId, user.wallet_address], (err3) => {
                  if (err3) errors++; else inserted++;
                  cb();
              });
          });
      };
      let i = 0;
      function next() {
          if (i >= users.length) {
              res.send(`<h2>Linking complete</h2><p>Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}</p><a href='/admin'>Back to admin</a>`);
              return;
          }
          checkAndInsert(users[i++], next);
      }
      next();
  });
});
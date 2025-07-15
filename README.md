<img width="1233" height="357" alt="image" src="https://github.com/user-attachments/assets/7578fb53-56cc-4041-ae8b-62a43b74bd60" />
# ROSCA Telegram Bot Quickstart

This project implements a decentralized Rotating Savings and Credit Association (ROSCA) bot for Telegram, powered by Hedera smart contracts and wallet authentication via MetaMask.

---

## 🚀 Features

- 🔐 Wallet authentication via MetaMask (with signature verification)
- 🤖 Telegram bot for user interaction (`/start`, `/join`, `/contribute`, etc.)
- 💾 MySQL database integration for storing users, ROSCA groups, and sessions
- ⚡️ Hedera smart contract interaction layer (planned in `integration/rosca.js`)

---

## ✅ Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** (comes with Node.js)
- **MySQL** (Community Edition)
- **Telegram bot token** — [Get one via @BotFather](https://core.telegram.org/bots#6-botfather)
- **(Optional)** Hedera Testnet credentials: Operator ID and Private Key

---

## 🛠️ Installation Steps

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd uzh_telegram
```

### 2. Install dependencies

```bash
npm install
```

If you encounter dependency issues, try:

```bash
npm install --legacy-peer-deps
```

### 3. Install MySQL

#### Ubuntu/Debian:

```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### 4. Set up the database and user

Open MySQL:

```bash
sudo mysql -u root -p
```

Run the following SQL commands:

```sql
-- Create database and user
CREATE DATABASE rosca_db;
CREATE USER 'rosca_user'@'localhost' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON rosca_db.* TO 'rosca_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Replace `'your-strong-password'` with a secure password.

---

## 📦 Database Schema

Log back into MySQL and run:

```bash
mysql -u rosca_user -p rosca_db
```

Then create the tables:

```sql
-- 1. Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  wallet_address VARCHAR(42),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. ROSCA groups
CREATE TABLE rosca_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. User ↔ Group memberships
CREATE TABLE user_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  group_id INT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (group_id) REFERENCES rosca_groups(id),
  UNIQUE KEY ux_user_group (user_id, group_id)
);

-- 4. Auth sessions (signature handshakes)
CREATE TABLE auth_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  signature TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX ix_user_expires (user_id, expires_at)
);
```

## Expected output: 
<img width="1233" height="357" alt="image" src="https://github.com/user-attachments/assets/d4ce96e3-d349-4ec5-a050-0271b79278e0" />

---

## 🔑 Configure `.env` file

Create a `.env` file in your project root:

```env
TELEGRAM_BOT_TOKEN=your-telegram-token
HEDERA_OPERATOR_ID=0.0.xxxxx
HEDERA_OPERATOR_KEY=0xYourPrivateKeyHere
PUBLIC_BASE_URL=https://your-ngrok-or-domain.com

MYSQL_HOST=localhost
MYSQL_USER=rosca_user
MYSQL_PASSWORD=your-strong-password
MYSQL_DB=rosca_db
```

---

## 🌐 Add Hedera Testnet to MetaMask (optional)

| Field                 | Value                           |
|----------------------|----------------------------------|
| Network Name         | Hedera Testnet                   |
| New RPC URL          | `https://testnet.hashio.io/api`  |
| Chain ID             | `296`                            |
| Currency Symbol      | `HBAR`                           |
| Block Explorer URL   | `https://hashscan.io/testnet`    |

---

## 🧠 Running the Bot

Start your app:

```bash
node app.js
```

You should see logs like:

```bash
ethers: object
ethers.utils: object
ethers.utils.verifyMessage: function
Express server running on port 3000
✅ Bot polling started
```

---

## 💬 Telegram Commands

| Command         | Description                                 |
|-----------------|---------------------------------------------|
| `/start`        | Shows welcome message + wallet auth button  |
| `/join`         | Request to join the ROSCA group             |
| `/contribute`   | Simulates a contribution (stub)             |
| `/status`       | Shows your ROSCA status (stub)              |
| `/history`      | Shows your transaction history (stub)       |

---

## 🗂 Project Structure

```
uzh_telegram/
├── app.js              # Main bot logic
├── .env                # Environment variables
├── package.json
├── integration/
│   └── rosca.js        # (To be implemented) Smart contract interaction layer
└── docs/
    └── architecture.md # (Optional) Design docs
```

---

## 🔐 Security Notes

- Never commit your `.env` file or share your Telegram bot token or Hedera private key.
- Ensure HTTPS is used in production environments.
- Validate wallet addresses and use proper signature expiration and reuse protection.

---

## 📖 References

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [ethers.js Docs](https://docs.ethers.org/)
- [Hedera Portal](https://hedera.com/)
- [MetaMask Docs](https://docs.metamask.io/)

---



# ROSCA Telegram Bot Quickstart

This project is a decentralized Rotating Savings and Credit Association (ROSCA) bot for Telegram, powered by Hedera smart contracts.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A Telegram bot token ([How to get one](https://core.telegram.org/bots#6-botfather))
- (Optional) Hedera testnet/mainnet account and operator keys for contract interaction

## Installation

1. **Clone the repository:**

   ```bash
   git clone <your-repo-url>
   cd uzh_telegram
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the project root with the following content:

   ```env
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
   HEDERA_OPERATOR_ID=your-hedera-account-id
   HEDERA_OPERATOR_KEY=your-hedera-private-key
   # Add any other required config here
   ```

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `PUBLIC_BASE_URL`: The public base URL for your backend (e.g., your ngrok URL or production domain). This is used to generate authentication links for users. Example:
  - For local development with ngrok: `PUBLIC_BASE_URL=https://your-ngrok-subdomain.ngrok-free.app`
  - For production: `PUBLIC_BASE_URL=https://yourdomain.com`

**Make sure to update this variable whenever your ngrok URL changes!**

## Running the Bot

Start the bot with:

```bash
node app.js
```

Or, if you prefer using `npm` scripts (if defined):

```bash
npm start
```

The bot will connect to Telegram and listen for commands such as `/start`, `/join`, `/contribute`, `/status`, and `/history`.

## Project Structure

- `app.js` — Main entry point for the Telegram bot
- `integration/rosca.js` — Integration logic between the bot and Hedera smart contracts
- `contracts/` — Solidity smart contracts
- `test/` — Test scripts
- `docs/architecture.md` — Detailed architecture and design documentation

## Further Information

- For detailed architecture, see [`docs/architecture.md`](docs/architecture.md)
- For the Telegram Bot API, see [https://core.telegram.org/bots/api](https://core.telegram.org/bots/api)

## Security Note

Keep your bot token and Hedera keys secure. Anyone with access to these can control your bot and interact with your contracts.

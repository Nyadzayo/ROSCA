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
3. **Add Hedera Testnet to MetaMask:**

Follow these steps to add the Hedera Testnet to your MetaMask wallet:

   A. Open MetaMask
   - Click the MetaMask extension in your browser.

   B. Click the Network Dropdown
   - This is located at the top of MetaMask where it displays "Ethereum Mainnet" or another network name.

   C. Select “Add network” or “Add a network manually”
   - Scroll to the bottom of the network list and click **Add a network manually**.

   D. Enter the Hedera Testnet Network Info

   Fill in the fields with the following information:

   | Field               | Value                          |
   |---------------------|--------------------------------|
   | **Network Name**     | Hedera Testnet                 |
   | **New RPC URL**      | `https://testnet.hashio.io/api`|
   | **Chain ID**         | `296`                          |
   | **Currency Symbol**  | `HBAR`                         |
   | **Block Explorer URL**| `https://hashscan.io/testnet` |

   E. Click Save
   - MetaMask will now connect to the Hedera Testnet network.


4. **Configure environment variables:**

   Create a `.env` file in the project root with the following content:

   ```env
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
   HEDERA_OPERATOR_ID=your-hedera-account-id (Account ID)
   HEDERA_OPERATOR_KEY=your-hedera-private-key (HEX Encoded Private Key)
   # Add any other required config here
   ```

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

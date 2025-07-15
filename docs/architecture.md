# Decentralized ROSCA on Hedera & Telegram

## Overview

This project implements a decentralized Rotating Savings and Credit Association (ROSCA) using the Hedera Hashgraph network for smart contracts and token flow, and a Telegram bot as the user interface. The system is modular, separating the Telegram interface, smart contract logic, and integration layer.

---

## Architecture Diagram

```
[User (Telegram)]
      |
      v
[Telegram Bot (Node.js/TypeScript)]
      |
      v
[Hedera SDK Integration Layer]
      |
      v
[Hedera Smart Contracts (Solidity/HTS)]
      |
      v
[Hedera Network]
```

---

## Components

### 1. Telegram Bot Layer

- **Purpose:** User interface for all ROSCA interactions.
- **Tech:** Node.js, node-telegram-bot-api, TypeScript
- **Logic:**
  - Handles commands: `/start`, `/join`, `/contribute`, `/status`, `/history`
  - Collects basic KYC (phone/email via Telegram)
  - Notifies users of events (contribution due, payout, missed payment)
  - Forwards user actions to the integration layer

### 2. Integration Layer

- **Purpose:** Bridges Telegram bot and Hedera smart contracts.
- **Tech:** TypeScript, @hashgraph/sdk
- **Logic:**
  - Receives requests from the bot
  - Signs and sends transactions to Hedera contracts
  - Handles contract responses and errors
  - Generates exportable logs (CSV/JSON)

### 3. Smart Contract Layer

- **Purpose:** Enforces ROSCA rules and token flow on Hedera.
- **Tech:** Solidity, Hedera Token Service (HTS)
- **Logic:**
  - Group creation and member registration
  - Periodic contributions and automatic payout
  - Penalty/missed payment logic
  - Role-based access (admin, member)
  - Emits events for off-chain tracking

### 4. Reporting/Export

- **Purpose:** Allow users to export transaction logs and group history.
- **Tech:** CSV/JSON generation, Telegram file delivery
- **Logic:**
  - Integration layer compiles logs from contract events
  - Telegram bot delivers files to users on request

### 5. (Future) Onboarding Extensions

- **Purpose:** Support low-tech onboarding (USSD, WhatsApp, web UI)
- **Logic:**
  - Modular interface for new channels
  - Reuse integration and contract logic

---

## Component Logic Details

### 1. Telegram Bot Layer (`app.js`)

- **/start**: Greets the user and provides instructions.
- **/join**: Calls `rosca.joinGroup(chatId)` to register the user in the ROSCA group via the integration layer.
- **/contribute**: Calls `rosca.contribute(chatId)` to process the user's contribution for the current round.
- **/status**: Calls `rosca.getStatus(chatId)` to fetch the user's/group's current status.
- **/history**: Calls `rosca.getHistory(chatId)` to fetch/export the user's transaction history.
- **KYC & Reputation**: (Planned) Collects minimal info (phone/email) for basic KYC and tracks user reputation based on contract events.
- **Notifications**: Sends reminders and updates to users about contributions, payouts, and missed payments.
- **Integration Points**: All contract logic is delegated to the integration layer (`integration/rosca.js`).

### 2. Integration Layer (`integration/rosca.js`)

- **joinGroup(chatId)**: Registers the user in the ROSCA group by calling the smart contract's `register()` function. Handles duplicate registration and group size checks.
- **contribute(chatId)**: Triggers the smart contract's `contribute()` function, ensuring the user sends the correct amount and hasn't already contributed this round.
- **getStatus(chatId)**: Queries the contract for the user's status, including current round, next payout, and user position.
- **getHistory(chatId)**: Fetches contract events/logs for the user, returning them as an array or exportable CSV/JSON.
- **Security**: All contract interactions are signed and sent via the Hedera SDK. User keys or a secure signing mechanism should be used to avoid centralized custody.

### 3. Smart Contract Layer (`contracts/ROSCA.sol`)

- **register()**: Allows a new user to join the group if not already registered and if the group is not full. Emits `MemberRegistered` event.
- **contribute()**: Accepts the required contribution amount from a registered member, marks them as having contributed for the round, and emits a `Contribution` event.
- **payout()**: (Admin only) After the round duration, pays out the pot to the eligible member (round-robin), resets contribution flags, and emits a `Payout` event.
- **checkMissedPayments()**: (Admin only) Checks for members who missed their contribution, increments their missed payment count, reduces reputation, and emits a `MissedPayment` event.
- **getMembers() / getMemberInfo()**: View functions to fetch group and member details.
- **Security**: Role-based access for admin/member functions. All state changes are logged via events for off-chain tracking and reporting.

---

## Flow Example

1. **User sends /join in Telegram**

   - Bot calls `rosca.joinGroup(chatId)`
   - Integration layer calls `register()` on the smart contract
   - Contract adds user if eligible, emits `MemberRegistered`
   - Bot notifies user of success/failure

2. **User sends /contribute**

   - Bot calls `rosca.contribute(chatId)`
   - Integration layer calls `contribute()` on the contract, sending the required amount
   - Contract marks contribution, emits `Contribution`
   - Bot confirms contribution

3. **Admin triggers payout**

   - Integration layer (or admin bot) calls `payout()`
   - Contract pays out to the next eligible member, emits `Payout`
   - Bot notifies group of payout

4. **Missed payment check**
   - Admin calls `checkMissedPayments()`
   - Contract updates missed payment counts, emits `MissedPayment`
   - Bot notifies affected users

---

## Security & Decentralization Notes

- Users should ideally sign their own transactions (non-custodial wallets or delegated signing)
- Minimal off-chain storage; all critical state and logs are on-chain
- KYC and reputation are tracked via contract events and can be exported for compliance or analytics

---

## Next Steps

- Implement contract deployment and integration logic in `integration/rosca.js`
- Connect Telegram bot to real contract functions
- Add export/reporting features
- Expand onboarding options (USSD, WhatsApp, web UI)

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  defaultNetwork: "testnet",
  networks: {
    testnet: {
      url: process.env.TESTNET_ENDPOINT,
      accounts: [process.env.TESTNET_OPERATOR_PRIVATE_KEY],
      
    },
    
  },
  settings: { optimizer: { enabled: true, runs: 200 } }
};
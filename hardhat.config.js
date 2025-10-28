// File: hardhat.config.js
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
// Remove or comment out task import if it exists:
// import "./scripts/deploy-airdrop.js";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20", // Matches updated contract and OpenZeppelin deps
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Mainnet network config
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 56,
    },
    // Testnet network config
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 97,
    },
  },
  etherscan: {
    // Your single API key from BscScan/Etherscan, read from .env
    apiKey: process.env.BSCSCAN_API_KEY,

    // Add this to map your networks to BscScan
    customChains: [
      {
        network: "bscMainnet",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com",
        },
      },
    ],
  },
};
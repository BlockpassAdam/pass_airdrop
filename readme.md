# **PASS Token Airdrop (Simple On-Chain Validation)**

This project implements a simple, one-time airdrop system for distributing PASS tokens. This version uses **on-chain validation** to verify a user's eligibility when they try to claim.

This version is simplified and **does not** include any monthly caps, tapering rewards, or claim periods. The only rule is: **one claim per attested address, ever.**

## **Project Components**

1.  **AirdropSimple.sol**: The Solidity smart contract (updated to `pragma solidity 0.8.20+`) that lives on the blockchain. It holds the tokens, checks user attestations, and distributes the tokens.
2.  **index.html**: A front-end "dApp" (Decentralized Application) that allows eligible users to connect their wallets and claim their tokens. This dApp is network-aware and supports both BSC Mainnet and Testnet.
3.  **scripts/deploy-airdrop.js**: A Hardhat script wizard to deploy a new airdrop contract or fund an existing one on either network.

## **How It Works**

1.  **On-Chain**: The project owner uses the `deploy-airdrop.js` script to deploy the `AirdropSimple.sol` contract **twice**: once to BSC Mainnet and once to BSC Testnet.
2.  **On-Chain**: The owner uses the `deploy-airdrop.js` script's **Fund** option to transfer the airdrop tokens into *each* deployed contract (real tokens for Mainnet, test tokens for Testnet).
3.  **Off-Chain**: The owner edits `index.html` to add the two new contract addresses obtained during deployment.
4.  **On-Chain**: A user visits the `index.html` dApp.
5.  **On-Chain**: The dApp prompts the user to connect their wallet and checks their network (Mainnet or Testnet).
6.  **On-Chain**: The user clicks "Claim Your Tokens".
7.  **On-Chain**: This calls the `claim()` function on the correct smart contract. The contract performs these checks *live*:
    1.  Calls the BAS Registry contract to ask, "Does this user (`msg.sender`) have the `humanSchemaId` attestation?"
    2.  Checks the `hasClaimed` mapping: "Has this user (`msg.sender`) already claimed?"
8.  **On-Chain**: If the user is attested AND has not claimed, the contract sends the fixed `CLAIM_AMOUNT` of PASS tokens (in base units) and marks the user as claimed.

## **Project Components**

### **1\. AirdropSimple.sol (Smart Contract)**

This is the simplified on-chain "vault" and rule-keeper. **Note:** Requires `pragma solidity 0.8.20` or higher due to dependencies.

**Key Features:**

* **BAS Integration**: Directly calls the `isAttested` function on the official BAS Registry contract.
* **One-Time Claim**: Uses a simple `mapping(address => bool) public hasClaimed` to ensure each address can only claim once.
* **Fixed Reward**: A single, constant `CLAIM_AMOUNT` (in token base units) is set at deployment.
* **Owner-Managed**: The owner can withdraw any leftover tokens after the campaign.

**How to Deploy:**

(Using the `scripts/deploy-airdrop.js` wizard is **highly recommended** as it handles parameters, checksums, and verification)

1.  **IMPORTANT**: Ensure the contract uses `pragma solidity 0.8.20;` (or higher matching your `hardhat.config.js`).
2.  Install dependencies: `npm install`
3.  Compile the contract: `npx hardhat compile`
4.  Run the deployment wizard:
    * For Testnet: `npx hardhat run scripts/deploy-airdrop.js --network bscTestnet` (Choose **Deploy**)
    * For Mainnet: `npx hardhat run scripts/deploy-airdrop.js --network bscMainnet` (Choose **Deploy**)
5.  Follow the wizard prompts, including entering the claim amount (e.g., `50`). The wizard uses the correct decimals for the network.
6.  The wizard will output the deployed contract address after successful deployment and verification.
7.  **CRITICAL**: After deployment, use the wizard again to **Fund** the contract:
    * For Testnet: `npx hardhat run scripts/deploy-airdrop.js --network bscTestnet` (Choose **Fund**)
    * For Mainnet: `npx hardhat run scripts/deploy-airdrop.js --network bscMainnet` (Choose **Fund**)
    * Enter the deployed contract address and the total amount of tokens to send.

*Manual Deployment Arguments (if not using wizard):*

* **Deploy to BSC Testnet** (ChainID 97):
    * `_tokenAddress`: `0x1f7c2af1203dbC4b030a3450727C9B4C99337140` (Testnet PASS, **6 decimals**)
    * `_basRegistryAddress`: `0x242d13567d1C2293311E6a9A3f26D07F81393669` (Testnet BAS Registry)
    * `_humanSchemaId`: `0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539`
    * `_claimAmount`: Claim amount in **base units (6 decimals)**. E.g., for 50 tokens: `50000000`.
* **Deploy to BSC Mainnet** (ChainID 56):
    * `_tokenAddress`: `0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57` (Mainnet PASS, **18 decimals assumed**)
    * `_basRegistryAddress`: `0x085105151557a6908EAD812053A4700f13d8032e` (Mainnet BAS Registry)
    * `_humanSchemaId`: `0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539`
    * `_claimAmount`: Claim amount in **base units (18 decimals)**. E.g., for 50 tokens: `50000000000000000000`.

### **2\. index.html (Claiming dApp)**

This is the user-facing website.

**How to Use:**

1.  **Edit the file**: Open `index.html` and find the `networkConfigs` object:
    ```javascript
    const networkConfigs = {
      '56': { // BSC Mainnet
        // ...
        contractAddress: 'YOUR_MAINNET_AIRDROP_CONTRACT_ADDRESS_HERE', // <-- PASTE DEPLOYED ADDRESS
        // ...
      },
      '97': { // BSC Testnet
        // ...
        contractAddress: 'YOUR_TESTNET_AIRDROP_CONTRACT_ADDRESS_HERE', // <-- PASTE DEPLOYED ADDRESS
        // ...
      },
    };
    ```
    Replace the placeholder addresses with the *actual addresses* of your deployed `AirdropSimple.sol` contracts obtained from the deployment wizard.
2.  **Host the file**: See the testing section below.

### **How to Test the dApp (Using Netlify)**

This is the simplest way to get a live, shareable HTTPS link for testing.

1.  Go to [https://app.netlify.com/drop](https://app.netlify.com/drop).
2.  Log in with your GitHub or email.
3.  Drag your **edited** `index.html` file (with your contract addresses) onto the page.
4.  Netlify will instantly upload it and give you a public test URL (e.g., `https://random-name-123.netlify.app`).
5.  You can now open this URL in your browser or phone to test the dApp.

**NOTE:** This is for the **testing phase only**. The test site on Netlify should be taken down after testing is complete. The final production dApp should be deployed to **passtoken.org**.

## **How to Verify & Test on BSCScan**

### **Part 1: Contract Verification (with Hardhat)**

(The `deploy-airdrop.js` script handles verification automatically)

1.  **Get API Key**: Get a free API key from your BscScan profile (an Etherscan.io V2 key works too). Store it in `.env` as `BSCSCAN_API_KEY`.
2.  **Install Plugin**: `npm install --save-dev @nomicfoundation/hardhat-verify` (already included in `@nomicfoundation/hardhat-toolbox`).
3.  **Configure `hardhat.config.js`**:
    Make sure your `solidity.version` matches the one in the contract (e.g., `0.8.20`).
    ```javascript
    // File: hardhat.config.js
    import "@nomicfoundation/hardhat-toolbox";
    import "dotenv/config";

    /** @type import('hardhat/config').HardhatUserConfig */
    export default {
      solidity: {
        version: "0.8.20", // This MUST match the version in your contract
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      networks: {
         bscMainnet: {
           url: "[https://bsc-dataseed.binance.org/](https://bsc-dataseed.binance.org/)", // Primary RPC
           accounts: [process.env.PRIVATE_KEY || ""],
           chainId: 56,
         },
         bscTestnet: {
           url: "[https://data-seed-prebsc-1-s1.binance.org:8545/](https://data-seed-prebsc-1-s1.binance.org:8545/)", // Primary RPC
           accounts: [process.env.PRIVATE_KEY || ""],
           chainId: 97,
         },
      },
      etherscan: {
        // Your single API key from BscScan/Etherscan
        apiKey: process.env.BSCSCAN_API_KEY || "YOUR_BSCSCAN_API_KEY", // Fallback added

        customChains: [
          {
            network: "bscMainnet",
            chainId: 56,
            urls: {
              apiURL: "[https://api.bscscan.com/api](https://api.bscscan.com/api)",
              browserURL: "[https://bscscan.com](https://bscscan.com)",
            },
          },
          {
            network: "bscTestnet",
            chainId: 97,
            urls: {
              apiURL: "[https://api-testnet.bscscan.com/api](https://api-testnet.bscscan.com/api)",
              browserURL: "[https://testnet.bscscan.com](https://testnet.bscscan.com)",
            },
          },
        ],
      },
    };
    ```

4.  **Run Manual Verification Command (if needed)**:
    Replace constructor arguments based on network and decimals.
    ```bash
    # Example for Testnet (6 decimals, 50 token claim amount = 50000000):
    npx hardhat verify --network bscTestnet YOUR_DEPLOYED_CONTRACT_ADDRESS \
      "0x1f7c2af1203dbC4b030a3450727C9B4C99337140" \
      "0x242d13567d1C2293311E6a9A3f26D07F81393669" \
      "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539" \
      "50000000"

    # Example for Mainnet (18 decimals assumed, 50 token claim amount = 50...00):
    npx hardhat verify --network bscMainnet YOUR_DEPLOYED_CONTRACT_ADDRESS \
      "0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57" \
      "0x085105151557a6908EAD812053A4700f13d8032e" \
      "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539" \
      "50000000000000000000"
    ```

### **Part 2: Testing Directly on BSCScan (After Verification)**

1.  **Go to Your Contract**: Open your deployed airdrop contract's address on BscScan (Mainnet or Testnet).
2.  **Find the "Contract" Tab**: Click it.
3.  **Use "Read Contract"**:
    * Click the "Read Contract" button.
    * You can check `CLAIM_AMOUNT` to see the reward in base units.
    * You can enter your wallet address into `hasClaimed` (enter address, click "Query") to see if it returns `true` or `false`.
4.  **Use "Write Contract" to Claim**:
    * Click the "Write Contract" button.
    * Click **"Connect to Web3"**.
    * Scroll down to the `claim` function.
    * Click the **"Write"** button.
    * Approve the transaction in your wallet.

If you are attested and haven't claimed, it will succeed. If you try again, it will fail with the error `Airdrop: Already claimed`.
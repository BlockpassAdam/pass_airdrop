# **PASS Token Airdrop (Simple On-Chain Validation)**

This project implements a simple, one-time airdrop system for distributing PASS tokens. This version uses **on-chain validation** to verify a user's eligibility when they try to claim.

This version is simplified and **does not** include any monthly caps, tapering rewards, or claim periods. The only rule is: **one claim per attested address, ever.**

## **Project Components**

1.  **AirdropSimple.sol**: The Solidity smart contract that lives on the blockchain. It holds the tokens, checks user attestations, and distributes the tokens.
2.  **index.html**: A front-end "dApp" (Decentralized Application) that allows eligible users to connect their wallets and claim their tokens. This dApp is network-aware and supports both BSC Mainnet and Testnet.

## **How It Works**

1.  **On-Chain**: The project owner deploys the `AirdropSimple.sol` contract **twice**: once to BSC Mainnet and once to BSC Testnet.
2.  **On-Chain**: The owner transfers the airdrop tokens into *each* deployed contract (real tokens for Mainnet, test tokens for Testnet).
3.  **Off-Chain**: The owner edits `index.html` to add the two new contract addresses.
4.  **On-Chain**: A user visits the `index.html` dApp.
5.  **On-Chain**: The dApp prompts the user to connect their wallet and checks their network (Mainnet or Testnet).
6.  **On-Chain**: The user clicks "Claim Your Tokens".
7.  **On-Chain**: This calls the `claim()` function on the correct smart contract. The contract performs these checks *live*:
    1.  Calls the BAS Registry contract to ask, "Does this user (`msg.sender`) have the `humanSchemaId` attestation?"
    2.  Checks the `hasClaimed` mapping: "Has this user (`msg.sender`) already claimed?"
8.  **On-Chain**: If the user is attested AND has not claimed, the contract sends the fixed `CLAIM_AMOUNT` of PASS tokens and marks the user as claimed.

## **Project Components**

### **1\. AirdropSimple.sol (Smart Contract)**

This is the simplified on-chain "vault" and rule-keeper.

**Key Features:**

* **BAS Integration**: Directly calls the `isAttested` function on the official BAS Registry contract.
* **One-Time Claim**: Uses a simple `mapping(address => bool) public hasClaimed` to ensure each address can only claim once.
* **Fixed Reward**: A single, constant `CLAIM_AMOUNT` is set at deployment.
* **Owner-Managed**: The owner can withdraw any leftover tokens after the campaign.

**How to Deploy:**

(Using the `scripts/deploy-airdrop.js` wizard is recommended)

1.  Install dependencies: `npm install @openzeppelin/contracts`
2.  Compile the contract: `npx hardhat compile`
3.  **Deploy to BSC Testnet** (ChainID 97), passing these arguments:
    * `_tokenAddress`: `0x1f7c2af1203dbC4b030a3450727C9B4C99337140` (The Testnet PASS token)
    * `_basRegistryAddress`: The **Testnet** BAS Registry: `0x242D13567d1C2293311E6a9A3f26D07F81393669`
    * `_humanSchemaId`: `0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539`
    * `_claimAmount`: The fixed reward in *wei* (e.g., `50000000000000000000` for 50 tokens).
4.  **Deploy to BSC Mainnet** (ChainID 56), passing these arguments:
    * `_tokenAddress`: `0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57` (The official PASS Token)
    * `_basRegistryAddress`: The **Mainnet** BAS Registry: `0x085105151557a6908EAD812053A4700f13d8032e`
    * `_humanSchemaId`: `0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539`
    * `_claimAmount`: The fixed reward in *wei* (e.g., `50000000000000000000` for 50 tokens).
5.  **CRITICAL**: After deployment, transfer the total supply of airdrop tokens *to each* of the newly deployed contract addresses on their respective networks.

### **2\. index.html (Claiming dApp)**

This is the user-facing website, updated for the simple contract.

**How to Use:**

1.  **Edit the file**: Open `index.html` and find the `networkConfigs` object:
    ```javascript
    const networkConfigs = {
      '56': { // BSC Mainnet
        // ...
        contractAddress: '0x...YOUR_MAINNET_CONTRACT_ADDRESS_HERE',
        // ...
      },
      '97': { // BSC Testnet
        // ...
        contractAddress: '0x...YOUR_TESTNET_CONTRACT_ADDRESS_HERE',
        // ...
      },
    };
    ```
    Replace the placeholder addresses with the *actual addresses* of your deployed `AirdropSimple.sol` contracts.
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

1.  **Get API Key**: Get a free API key from your BscScan profile (an Etherscan.io V2 key works too).
2.  **Install Plugin**: `npm install --save-dev @nomicfoundation/hardhat-verify`
3.  **Configure `hardhat.config.js`**:
    Make sure your `solidity.version` matches the one in the contract (`0.8.19`).
    ```javascript
    // File: hardhat.config.js
    import "@nomicfoundation/hardhat-toolbox";
    import "dotenv/config";

    /** @type import('hardhat/config').HardhatUserConfig */
    export default {
      solidity: {
        version: "0.8.19", // This MUST match the version in your contract
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      networks: {
         bscMainnet: {
           url: "[https://bsc-dataseed.binance.org/](https://bsc-dataseed.binance.org/)",
           accounts: [process.env.PRIVATE_KEY],
           chainId: 56,
         },
         bscTestnet: {
           url: "[https://data-seed-prebsc-1-s1.binance.org:8545/](https://data-seed-prebsc-1-s1.binance.org:8545/)",
           accounts: [process.env.PRIVATE_KEY],
           chainId: 97,
         },
      },
      etherscan: {
        // Your single API key from BscScan/Etherscan
        apiKey: process.env.BSCSCAN_API_KEY,
        
        // Add this to map your networks to BscScan
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

4.  **Run the Verification Command**:
    (Note: The `deploy-airdrop.js` script does this for you automatically)
    ```bash
    # Example for Testnet:
    npx hardhat verify --network bscTestnet YOUR_DEPLOYED_CONTRACT_ADDRESS \
      "0x1f7c2af1203dbC4b030a3450727C9B4C99337140" \
      "0x242D13567d1C2293311E6a9A3f26D07F81393669" \
      "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539" \
      "50000000000000000000"

    # Example for Mainnet:
    npx hardhat verify --network bscMainnet YOUR_DEPLOYED_CONTRACT_ADDRESS \
      "0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57" \
      "0x085105151557a6908EAD812053A4700f13d8032e" \
      "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539" \
      "50000000000000000000"
    ```

### **Part 2: Testing Directly on BSCScan (After Verification)**

1.  **Go to Your Contract**: Open your contract's address on BSCScan.
2.  **Find the "Contract" Tab**: Click it.
3.  **Use "Read Contract"**:
    * Click the "Read Contract" button.
    * You can check `CLAIM_AMOUNT` to see the reward.
    * You can enter your wallet address into `hasClaimed` (enter your address and click "Query") to see if it returns `true` or `false`.
4.  **Use "Write Contract" to Claim**:
    * Click the "Write Contract" button.
    * Click **"Connect to Web3"**.
    * Scroll down to the `claim` function.
    * Click the **"Write"** button.
    * Approve the transaction in your wallet.

If you are attested and haven't claimed, it will succeed. If you try again, it will fail with the error `Airdrop: Already claimed`.
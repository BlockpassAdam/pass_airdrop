# **PASS Token Airdrop (On-Chain Validation)**

This project implements an airdrop system for distributing PASS tokens. This version uses **on-chain validation**, meaning the smart contract directly checks the BSC Attestation Service (BAS) to verify a user's eligibility when they try to claim.

This approach is different from a Merkle tree as it does not require any off-chain proof generation. The eligibility check happens live during the claim transaction.

## **Project Components**

1. **AirdropOnChain.sol**: The Solidity smart contract that lives on the blockchain. It holds the tokens, checks user attestations, and distributes the tokens.  
2. **index-on-chain.html**: A front-end "dApp" (Decentralized Application) that allows eligible users to connect their wallets and claim their tokens.

## **How It Works**

1. **On-Chain**: The project owner deploys the AirdropOnChain.sol contract. During deployment, the owner provides the contract with:  
   * The PASS Token address.  
   * The BAS Registry contract address.  
   * The schemaId for the "Human" attestation.  
   * The monthly token payout cap.  
   * The initial claim amount (e.g., 50 tokens).  
2. **On-Chain**: The owner transfers the airdrop tokens into the deployed contract.  
3. **On-Chain**: A user (who holds the "Human" attestation) visits the index-on-chain.html dApp.  
4. **On-Chain**: The user connects their wallet and clicks "Claim Your Tokens".  
5. **On-Chain**: This calls the claim() function on the smart contract. The contract performs these checks *live*:  
   1. Calls the BAS Registry contract to ask, "Does this user (msg.sender) have the humanSchemaId attestation?"  
   2. Checks if the user has already claimed in the current period.  
   3. Checks if the monthly payout cap has been exceeded.  
6. **On-Chain**: If all checks pass, the contract transfers the currentClaimAmount of PASS tokens to the user.

## **Project Components**

### **1\. AirdropOnChain.sol (Smart Contract)**

This is the on-chain "vault" and rule-keeper.

**Key Features:**

* **BAS Integration**: Directly calls the isAttested function on the official BAS Registry contract.  
* **Owner-Managed**: Key functions are restricted to the owner.  
* **claim()**: The main function for users. It takes *no arguments* and validates eligibility on-chain.  
* **Monthly Payout Limit**: Enforces the monthly cap (e.g., 50,000 PASS) to ensure token stability.  
* **Tapering Rewards**: The owner can call updateClaimPeriod(newAmount) to move to the next "month" and set a new, lower reward amount (e.g., 50, then 25, then 12.5 tokens), matching the original project specification.

**How to Deploy:**

1. Install dependencies (if using a framework like Hardhat): npm install @openzeppelin/contracts  
2. Compile the contract using a tool like Hardhat, Foundry, or Remix.  
3. Deploy to the BSC network, passing these arguments to the constructor:  
   * \_tokenAddress: The address of the PASS ERC20 token.  
   * \_basRegistryAddress: The BAS Registry address.  
     * **Mainnet:** 0x085105151557a6908EAD812053A4700f13d8032e  
     * **Testnet:** 0x242D13567d1C2293311E6a9A3f26D07F81393669  
   * \_humanSchemaId: The schema ID you provided.  
     * 0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539  
   * \_monthlyPayoutLimit: The limit in *wei* (e.g., 50000 \+ 18 zeros for 50,000 tokens).  
   * \_initialClaimAmount: The reward for Period 1 (e.g., 50 \+ 18 zeros for 50 tokens).  
4. **CRITICAL**: After deployment, transfer the total supply of airdrop tokens (or at least the monthly cap) *to the deployed contract address*.

### **2\. index-on-chain.html (Claiming dApp)**

This is the user-facing website.

**How to Use:**

1. **Edit the file**: Open index-on-chain.html and find this line:  
   const contractAddress \= "0x...YOUR\_NEW\_CONTRACT\_ADDRESS\_HERE";

   Replace the placeholder with the *actual address* of your deployed AirdropOnChain.sol contract.  
2. **Host the file**: You can open this file directly in your browser or host it on any static website provider (like GitHub Pages, Netlify, or Vercel).  
3. **User Flow**:  
   * A user visits the page and clicks "Connect Wallet".  
   * The dApp will show them the current claim amount.  
   * The user clicks "Claim Your Tokens".  
   * MetaMask (or another wallet) pops up, asking them to approve the transaction.  
   * If their attestation is valid (and they haven't claimed), the transaction succeeds. If not, the contract will revert and the dApp will show an error (e.g., "Airdrop: Not attested").
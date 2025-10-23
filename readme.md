# **PASS Token Merkle Airdrop**

This project implements a gas-efficient and secure Merkle airdrop system for distributing PASS tokens. It consists of three main components:

1. **Airdrop.sol**: The Solidity smart contract that lives on the blockchain, secures the tokens, and validates claims.  
2. **merkle-generator.mjs**: An off-chain Node.js script used by the project owner to generate the cryptographic proof (a Merkle root) from a list of eligible claimants.  
3. **index.html**: A front-end "dApp" (Decentralized Application) that allows eligible users to connect their wallets and claim their tokens.

## **How It Works: The Merkle Airdrop**

Instead of the project owner paying gas to send tokens to thousands of addresses (a "push" airdrop), this system uses a "pull" method.

1. **Off-Chain**: The project owner generates a list of all eligible addresses and their corresponding token amounts (e.g., user\_A gets 50 tokens, user\_B gets 25 tokens).  
2. **Off-Chain**: This list is fed into the merkle-generator.mjs script. This script compresses the entire list into a single, unique 32-byte string called a **Merkle Root**.  
3. **On-Chain**: The project owner deploys the Airdrop.sol contract, providing it with the Merkle Root and the total token supply for the airdrop.  
4. **On-Chain**: A user who wants to claim their tokens visits the index.html dApp.  
5. **Off-Chain**: To prove they are on the list, the user needs two things: their amount and a special password called a **Merkle Proof**. (In a real-world setup, the project would provide a simple API like getProof(myAddress) for users to fetch their specific proof).  
6. **On-Chain**: The user submits their amount and proof to the claim function on the smart contract.  
7. **On-Chain**: The contract uses the proof to mathematically verify that the user's address and amount combination was part of the original list used to create the Merkle Root.

If the proof is valid (and other conditions like the monthly cap are met), the contract sends the tokens to the user. This is highly secure and saves the project enormous amounts in gas fees.

## **Project Components**

### **1\. Airdrop.sol (Smart Contract)**

This is the on-chain "vault" and rule-keeper.

**Key Features:**

* **Ownable**: A project owner manages key functions.  
* **Merkle Root**: Stores the main merkleRoot to validate proofs against.  
* **claim(amount, proof)**: The main function for users. It checks the proof, the monthly payout limit, and that the user hasn't already claimed.  
* **Monthly Payout Limit**: Enforces the $5,000 (50,000 PASS) monthly cap specified in the project document to ensure token stability.  
* **Claim Periods**: The owner can update the Merkle root for new claim periods (e.g., for Month 2, Month 3, etc.) using updateClaimPeriod().

**How to Deploy:**

1. Install dependencies: npm install @openzeppelin/contracts  
2. Compile the contract using a tool like Hardhat or Foundry.  
3. Deploy to the BSC network, passing these arguments to the constructor:  
   * \_tokenAddress: The address of the PASS ERC20 token.  
   * \_initialMerkleRoot: The root generated from merkle-generator.mjs.  
   * \_monthlyPayoutLimit: The limit in *wei* (e.g., 50000 followed by 18 zeros for 50,000 tokens).

### **2\. merkle-generator.mjs (Merkle Tree Generator)**

This is an **owner-only** script for preparing the airdrop.

**How to Use:**

1. Install Node.js dependencies: npm install ethers merkletreejs keccak256  
2. Open the file and edit the claimants array to include all eligible addresses and their claim amounts (in wei).  
   const claimants \= \[  
     { address: '0x...', amount: parseUnits("50", 18\) },  
     { address: '0x...', amount: parseUnits("25", 18\) },  
     // ... all other users  
   \];

3. Run the script from your terminal: node merkle-generator.mjs  
4. **Output:**  
   * **Merkle Root**: A single 0x... hash. This is the \_initialMerkleRoot you need for deploying the contract.  
   * **Example Proof**: The script also prints an example proof for the first user. In a real system, you would save all proofs and provide them to users so they can claim.

### **3\. index.html (Claiming dApp)**

This is the user-facing website.

**How to Use:**

1. **Edit the file**: Open index.html and find this line:  
   const contractAddress \= "0x...YOUR\_CONTRACT\_ADDRESS\_HERE";

   Replace the placeholder with the *actual address* of your deployed Airdrop.sol contract.  
2. **Host the file**: You can open this file directly in your browser or host it on any static website provider.  
3. **User Flow**:  
   * A user visits the page and clicks "Connect Wallet" (which uses MetaMask).  
   * The user must find their specific amount (in wei) and their Merkle Proof (the JSON array) that you generated for them in the generator step.  
   * They paste these two values into the form.  
   * They click "Claim Tokens".  
   * MetaMask pops up, asking them to approve the transaction.  
   * If successful, the smart contract validates their proof and sends them their tokens. The dApp will show a success message. If it fails, it will show an error (e.g., "Already claimed", "Invalid Merkle proof").

## **Step-by-Step Workflow (Start to Finish)**

1. **Phase 1: Preparation (Owner)**  
   1. Get the final list of all eligible attestation holders and their Month 1 reward amounts (e.g., 50 PASS tokens).  
   2. Update the claimants array in merkle-generator.mjs.  
   3. Run node merkle-generator.mjs and securely save the output.  
   4. Copy the **Merkle Root**.  
2. **Phase 2: Deployment (Owner)**  
   1. Compile and deploy Airdrop.sol.  
   2. When deploying, provide the PASS token address, the **Merkle Root** from Step 1, and the monthly payout limit (e.g., 50000000000000000000000).  
   3. Copy the new contract address.  
   4. **CRITICAL**: Transfer the total supply of airdrop tokens (or at least the monthly cap) *to the deployed contract address*. The contract needs to hold the tokens to distribute them.  
3. **Phase 3: dApp Setup (Owner)**  
   1. Open index.html and update the contractAddress variable with the address from Step 2\.  
   2. Host index.html on a public URL.  
   3. Set up a way for users to get their individual Merkle Proofs (e.g., a simple API, or by pre-generating all proofs and uploading them to a server).  
4. **Phase 4: Claiming (User)**  
   1. A user visits your index.html page.  
   2. They connect their wallet.  
   3. They get their amount and proof from your system.  
   4. They paste the values into the form and click "Claim".  
   5. They approve the transaction and receive their tokens.
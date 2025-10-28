// File: scripts/deploy-airdrop.js
import hre from "hardhat";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// --- Helper Functions ---
const rl = readline.createInterface({ input, output });
const prompt = (query) => rl.question(query);
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// --- Constants ---
const VERIFICATION_MAX_RETRIES = 5;
const VERIFICATION_RETRY_DELAY_MS = 30000; // 30 seconds

// Network-specific parameters from your readme.md
const DEPLOY_PARAMS = {
  "56": { // bscMainnet
    networkName: "BSC Mainnet",
    tokenAddress: "0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57",
    basRegistryAddress: "0x085105151557a6908EAD812053A4700f13d8032e",
    humanSchemaId: "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539",
  },
  "97": { // bscTestnet
    networkName: "BSC Testnet",
    tokenAddress: "0x1f7c2af1203dbC4b030a3450727C9B4C99337140",
    basRegistryAddress: "0x242D13567d1C2293311E6a9A3f26D07F81393669",
    humanSchemaId: "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539",
  }
};

async function main() {
  console.log("🚀 Starting AirdropSimple deployment wizard...");

  // --- 1. Network and Parameter Setup ---
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;
  const params = DEPLOY_PARAMS[chainId];

  if (!params) {
    throw new Error(`Unsupported network: ${network} (ChainID: ${chainId}). Please add parameters to DEPLOY_PARAMS.`);
  }

  console.log(`\n--- Deployment Configuration for ${params.networkName} ---`);
  console.log(`   Network:         ${network} (ChainID: ${chainId})`);
  console.log(`   PASS Token:      ${params.tokenAddress}`);
  console.log(`   BAS Registry:    ${params.basRegistryAddress}`);
  console.log(`   Human Schema ID: ${params.humanSchemaId}`);

  // --- 2. Wizard: Get Claim Amount ---
  const claimAmountInEther = await prompt("\n❓ Enter the claim amount in ETHER (e.g., '50'): ");
  let claimAmountInWei;
  try {
    claimAmountInWei = hre.ethers.parseEther(claimAmountInEther);
    if (claimAmountInWei === 0n) throw new Error("Amount must be greater than 0");
  } catch (e) {
    throw new Error("Invalid input. Claim amount must be a number greater than 0.");
  }
  
  const constructorArgs = [
    params.tokenAddress,
    params.basRegistryAddress,
    params.humanSchemaId,
    claimAmountInWei
  ];

  // --- 3. Final Confirmation ---
  console.log("\n--- Review Transaction ---");
  console.log(`   Deploying:       AirdropSimple`);
  console.log(`   To Network:      ${params.networkName}`);
  console.log(`   Claim Amount:    ${claimAmountInEther} PASS (${claimAmountInWei.toString()} wei)`);

  const confirm = await prompt("   Type 'deploy' to confirm and start deployment: ");
  if (confirm.toLowerCase() !== 'deploy') {
    console.log("Deployment cancelled by user.");
    process.exit(0);
  }

  // --- 4. Deployment ---
  console.log("\nDeploying AirdropSimple...");
  const airdrop = await hre.ethers.deployContract("AirdropSimple", constructorArgs);
  await airdrop.waitForDeployment();

  const contractAddress = airdrop.target;
  console.log(`✅ Contract deployed to address: ${contractAddress}`);

  // Wait for 5 block confirmations before proceeding
  console.log("Waiting for 5 block confirmations...");
  await airdrop.deploymentTransaction().wait(5);
  console.log("Confirmed!");

  // --- 5. Verification (Replicated from your example) ---
  console.log("\n--- VERIFICATION ---");
  let isVerified = false;
  for (let i = 0; i < VERIFICATION_MAX_RETRIES; i++) {
    console.log(`Attempting verification (Attempt ${i + 1}/${VERIFICATION_MAX_RETRIES})...`);
    try {
      // Attempt to verify the contract
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs, // Pass the arguments used during deployment
      });
      console.log("✅ Done: Contract verified successfully!");
      isVerified = true;
      break; // Exit the loop on success
    } catch (error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("already verified")) {
        console.log("⚠️  Contract source code is already verified!");
        isVerified = true;
        break; // Exit loop, already verified is a success case
      } else if (errorMessage.includes("does not have bytecode")) {
          console.error(`Attempt ${i + 1} failed: The contract bytecode is not yet available on the block explorer.`);
      } 
      else {
        console.error(`Attempt ${i + 1} failed: ${error.message.split('\n')[0]}`);
      }
      
      if (i < VERIFICATION_MAX_RETRIES - 1) {
        console.log(`Will retry in ${VERIFICATION_RETRY_DELAY_MS / 1000} seconds...`);
        await delay(VERIFICATION_RETRY_DELAY_MS);
      }
    }
  }

  if (!isVerified) {
    console.error("\n❌ FAILED: All verification attempts failed. Please verify the contract manually on BscScan.");
  } else {
    console.log("\n🎉 Deployment and verification complete!");
    console.log("--------------------------------------------------------");
    console.log("   CRITICAL: Don't forget to fund the contract!   ");
    console.log(`   Transfer your PASS tokens to this new contract address:`);
    console.log(`   ${contractAddress}`);
    console.log("--------------------------------------------------------");
  }
}

// Execute the deployment script
main()
  .then(() => {
    rl.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    rl.close();
    process.exitCode = 1;
  });
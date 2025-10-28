// File: scripts/deploy-airdrop.js
import hre from "hardhat";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ethers } from "ethers"; // Import ethers explicitly for provider creation

// --- Helper Functions ---
const rl = readline.createInterface({ input, output });
const prompt = (query) => rl.question(query);
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// --- Constants ---
const VERIFICATION_MAX_RETRIES = 5;
const VERIFICATION_RETRY_DELAY_MS = 30000; // 30 seconds
const PASS_TOKEN_DECIMALS = 6; // <-- *** UPDATED TO 6 ***
const MAX_FUNDING_RETRIES = 3; // Max attempts per RPC URL for transient errors

// Network-specific parameters (using ChainID as the key)
const DEPLOY_PARAMS = {
  "56": { // bscMainnet
    configName: "bscMainnet",
    networkName: "BSC Mainnet",
    chainId: "56",
    rpcUrls: [ // List multiple RPC URLs
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-dataseed1.ninicoin.io/",
        "https://bsc.publicnode.com",
    ],
    tokenAddress: "0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57",
    basRegistryAddress: "0x085105151557a6908EAD812053A4700f13d8032e",
    humanSchemaId: "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539",
    blockExplorerUrls: ["https://bscscan.com"],
  },
  "97": { // bscTestnet
    configName: "bscTestnet",
    networkName: "BSC Testnet",
    chainId: "97",
    rpcUrls: [ // List multiple RPC URLs
        "https://data-seed-prebsc-1-s1.binance.org:8545/",
        "https://data-seed-prebsc-2-s1.binance.org:8545/",
        "https://data-seed-prebsc-1-s2.binance.org:8545/",
        "https://data-seed-prebsc-2-s2.binance.org:8545/",
        "https://bsc-testnet.publicnode.com",
    ],
    tokenAddress: "0x1f7c2af1203dbC4b030a3450727C9B4C99337140",
    basRegistryAddress: "0x242d13567d1C2293311E6a9A3f26D07F81393669",
    humanSchemaId: "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539",
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  }
};

// Minimal ABI for ERC20 transfer and balanceOf
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)" // Added balanceOf
];

// --- Deployment Function ---
// (No changes needed here, uses PASS_TOKEN_DECIMALS)
async function deployNewContract(params) {
  console.log(`\n--- Deploying New Contract on ${params.networkName} ---`);
  console.log(`   (Using default RPC URL from hardhat.config.js for deployment/verification)`);
  console.log(`   Network:         ${hre.network.name} (ChainID: ${hre.network.config.chainId})`);
  console.log(`   PASS Token:      ${params.tokenAddress}`);
  console.log(`   BAS Registry:    ${params.basRegistryAddress}`);
  console.log(`   Human Schema ID: ${params.humanSchemaId}`);

  const claimAmountInEther = await prompt("\n❓ Enter the claim amount per user (e.g., '50'): ");
  let claimAmountInWei;
  try {
    claimAmountInWei = hre.ethers.parseUnits(claimAmountInEther, PASS_TOKEN_DECIMALS); // Uses the updated constant
    if (claimAmountInWei <= 0n) throw new Error("Amount must be positive.");
  } catch (e) {
    throw new Error(`Invalid claim amount: ${e.message}`);
  }

  const tokenAddress = hre.ethers.getAddress(params.tokenAddress.toLowerCase());
  const basRegistryAddress = hre.ethers.getAddress(params.basRegistryAddress.toLowerCase());

  const constructorArgs = [
    tokenAddress,
    basRegistryAddress,
    params.humanSchemaId,
    claimAmountInWei
  ];

  console.log("\n--- Review Deployment Transaction ---");
  console.log(`   Deploying:       AirdropSimple`);
  console.log(`   Claim Amount:    ${claimAmountInEther} PASS (${claimAmountInWei.toString()} base units)`); // Adjusted label

  const confirm = await prompt("   Type 'deploy' to confirm and start deployment: ");
  if (confirm.toLowerCase() !== 'deploy') {
    console.log("Deployment cancelled by user.");
    return;
  }

  console.log("\nDeploying AirdropSimple...");
  const airdrop = await hre.ethers.deployContract("AirdropSimple", constructorArgs);
  await airdrop.waitForDeployment();

  const contractAddress = airdrop.target;
  console.log(`✅ Contract deployed to address: ${contractAddress}`);

  console.log("Waiting for 5 block confirmations...");
  await airdrop.deploymentTransaction().wait(5);
  console.log("Confirmed!");

  console.log("\n--- VERIFICATION ---");
  let isVerified = false;
  for (let i = 0; i < VERIFICATION_MAX_RETRIES; i++) {
    console.log(`Attempting verification (Attempt ${i + 1}/${VERIFICATION_MAX_RETRIES})...`);
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log("✅ Done: Contract verified successfully!");
      isVerified = true;
      break;
    } catch (error) {
       const errorMessage = error.message.toLowerCase();
       if (errorMessage.includes("already verified")) {
         console.log("⚠️  Contract source code is already verified!");
         isVerified = true;
         break;
       } else if (errorMessage.includes("does not have bytecode")) {
           console.error(`Attempt ${i + 1} failed: Contract bytecode not yet available on explorer.`);
       } else if (errorMessage.includes("try enabling optimization")) {
            console.error(`Attempt ${i + 1} failed: Optimizer settings might mismatch. Check hardhat.config.js.`);
            console.error(`   Ensure optimizer is enabled (${hre.config.solidity.compilers[0].settings.optimizer.enabled}) with ${hre.config.solidity.compilers[0].settings.optimizer.runs} runs.`);
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
    console.error("\n❌ FAILED: All verification attempts failed. Verify manually.");
  } else {
    console.log("\n🎉 Deployment and verification complete!");
    console.log("--------------------------------------------------------");
    console.log("   CRITICAL: Now fund the contract using the 'F' option!   ");
    console.log(`   New Airdrop Contract Address: ${contractAddress}`);
    console.log("--------------------------------------------------------");
  }
}


// --- Funding Function with Balance Check Before Confirmation ---
// (Uses PASS_TOKEN_DECIMALS)
async function fundExistingContract(params) {
    console.log(`\n--- Funding Existing Contract on ${params.networkName} ---`);

    const airdropContractAddress = await prompt("❓ Enter the address of the Airdrop contract to fund: ");
    let validatedAirdropAddress;
    try {
        validatedAirdropAddress = hre.ethers.getAddress(airdropContractAddress);
    } catch (e) {
        throw new Error(`Invalid Airdrop contract address provided: ${e.message}`);
    }

    const fundingAmountInPass = await prompt(`❓ Enter the amount of PASS tokens to send to ${validatedAirdropAddress} (e.g., '10000'): `);
    let fundingAmountBaseUnits; // Changed variable name for clarity
    try {
        fundingAmountBaseUnits = hre.ethers.parseUnits(fundingAmountInPass, PASS_TOKEN_DECIMALS); // Uses updated constant
        if (fundingAmountBaseUnits <= 0n) throw new Error("Amount must be positive.");
    } catch (e) {
        throw new Error(`Invalid funding amount: ${e.message}`);
    }

    const passTokenAddress = hre.ethers.getAddress(params.tokenAddress.toLowerCase());
    const configuredPrivateKey = process.env.PRIVATE_KEY;
    if (!configuredPrivateKey) {
        throw new Error("PRIVATE_KEY not found in .env file.");
    }

    const senderWallet = new ethers.Wallet(configuredPrivateKey);
    const senderAddress = senderWallet.address;

    // --- Check Balance BEFORE Confirmation ---
    let currentPassBalanceFormatted = "N/A";
    let currentPassBalanceBaseUnits = -1n; // Changed variable name
    let nativeBalanceFormatted = "N/A";
    try {
        console.log(`\nChecking sender balance using RPC: ${params.rpcUrls[0]}`);
        const tempProvider = new ethers.JsonRpcProvider(params.rpcUrls[0]);
        const passTokenContractCheck = new ethers.Contract(passTokenAddress, ERC20_ABI, tempProvider);
        currentPassBalanceBaseUnits = await passTokenContractCheck.balanceOf(senderAddress);
        currentPassBalanceFormatted = ethers.formatUnits(currentPassBalanceBaseUnits, PASS_TOKEN_DECIMALS); // Uses updated constant

        const nativeBalanceWei = await tempProvider.getBalance(senderAddress);
        nativeBalanceFormatted = ethers.formatEther(nativeBalanceWei);

    } catch (balanceError) {
        console.warn(`   ⚠️ Warning: Could not check sender balance beforehand: ${balanceError.message}`);
    }
    // --- End Balance Check ---


    console.log("\n--- Review Funding Transaction ---");
    console.log(`   Network:          ${params.networkName}`);
    console.log(`   Sender Address:   ${senderAddress}`);
    console.log(`   Sender Balance:   ${currentPassBalanceFormatted} PASS`);
    console.log(`   Sender Gas Bal:   ${nativeBalanceFormatted} Native`);
    console.log(`   Funding Amount:   ${fundingAmountInPass} PASS (${fundingAmountBaseUnits.toString()} base units)`); // Adjusted label
    console.log(`   PASS Token Addr:  ${passTokenAddress}`);
    console.log(`   Recipient Addr:   ${validatedAirdropAddress}`);

    if (currentPassBalanceBaseUnits !== -1n && currentPassBalanceBaseUnits < fundingAmountBaseUnits) {
         console.error("\n❌ ERROR: Sender's PASS balance is less than the amount requested.");
         console.error("   Please check the balance and try again.");
         return;
    }

    const confirm = await prompt("\n   Type 'fund' to confirm and send tokens: ");
    if (confirm.toLowerCase() !== 'fund') {
        console.log("Funding cancelled by user.");
        return;
    }

    // --- Transfer Logic with RPC Fallback ---
    let transferSuccessful = false;
    let finalTxHash = null;
    let finalReceipt = null;

    for (const rpcUrl of params.rpcUrls) {
        console.log(`\nAttempting transfer using RPC: ${rpcUrl}`);
        let provider;
        let signer;
        let attempt = 0;

        while (attempt < MAX_FUNDING_RETRIES) {
            attempt++;
            try {
                provider = new ethers.JsonRpcProvider(rpcUrl);
                signer = new ethers.Wallet(configuredPrivateKey, provider);

                const nativeBalance = await provider.getBalance(signer.address);
                console.log(`   (Debug) Native Balance on this RPC: ${ethers.formatEther(nativeBalance)} native`);
                if (nativeBalance === 0n && attempt === 1) {
                    console.warn(`   Warning: Sender native balance is zero on ${rpcUrl}. Tx likely fail due to gas.`);
                }

                console.log(`   Sending PASS tokens (Attempt ${attempt}/${MAX_FUNDING_RETRIES})...`);
                const passTokenContract = new ethers.Contract(passTokenAddress, ERC20_ABI, signer);

                const tx = await passTokenContract.transfer(validatedAirdropAddress, fundingAmountBaseUnits); // Use correct variable
                console.log(`   Transaction sent: ${tx.hash}`);
                console.log("   Waiting for confirmation...");
                const receipt = await tx.wait(1);

                transferSuccessful = true;
                finalTxHash = receipt.hash;
                finalReceipt = receipt;
                break; // Exit retry loop

            } catch (error) {
                console.error(`   Attempt ${attempt} failed with RPC ${rpcUrl}:`);
                const errorMsg = error.message.toLowerCase();

                // Error handling logic remains the same
                if (errorMsg.includes("insufficient funds")) {
                    console.error("   Error: Insufficient BNB/tBNB for gas.");
                    console.error("   Hint: Check native token balance.");
                    attempt = MAX_FUNDING_RETRIES;
                    break;
                } else if (errorMsg.includes("transfer amount exceeds balance")) {
                    console.error("   Error: Insufficient PASS token balance reported by contract.");
                    console.error("   Hint: This is unexpected if balance check passed. RPC might be out of sync.");
                    if (attempt >= MAX_FUNDING_RETRIES) {
                        console.error(`   Max retries reached for ${rpcUrl}. Trying next RPC...`);
                    } else {
                         console.warn(`   Retrying in 5s...`);
                         await delay(5000);
                    }
                } else if (errorMsg.includes("nonce has already been used") || errorMsg.includes("replacement transaction underpriced")) {
                    console.error("   Error: Nonce issue or transaction underpriced. Requires manual intervention.");
                    attempt = MAX_FUNDING_RETRIES;
                    break;
                } else if (errorMsg.includes("timeout") || errorMsg.includes("failed to fetch") || errorMsg.includes("network error") || errorMsg.includes("could not detect network")) {
                     console.warn(`   Network/Timeout error encountered.`);
                    if (attempt >= MAX_FUNDING_RETRIES) {
                        console.error(`   Max retries reached for ${rpcUrl}. Trying next RPC...`);
                    } else {
                         console.warn(`   Retrying in 5s...`);
                         await delay(5000);
                    }
                }
                else {
                    console.error(`   Unhandled Error: ${error.message}`);
                     if (attempt >= MAX_FUNDING_RETRIES) {
                        console.error(`   Max retries reached for ${rpcUrl}. Trying next RPC...`);
                    } else {
                         console.warn(`   Retrying in 5s...`);
                         await delay(5000);
                    }
                }
            } // End catch
        } // End retry loop (while)

        if (transferSuccessful) {
            break; // Exit RPC loop (for) if successful
        }
    } // End RPC loop (for)

    // --- Final Outcome ---
    if (transferSuccessful && finalReceipt) {
        const explorerUrl = params.blockExplorerUrls[0] || '';
        const txUrl = explorerUrl ? `${explorerUrl}/tx/${finalTxHash}` : `Tx Hash: ${finalTxHash}`;
        console.log(`\n✅ Success! Tokens transferred. View on explorer: ${txUrl}`);
    } else {
        console.error("\n❌ FAILED: Token transfer failed after trying all RPC URLs and retries.");
        console.error("   Please check the error messages above, verify balances (PASS and native token for gas), and network connectivity.");
    }
}


// --- Main Execution ---
async function main() {
    console.log("🚀 Starting Airdrop Deployment & Funding Wizard...");

    const networkName = hre.network.name;
    const chainId = hre.network.config.chainId.toString();
    const params = DEPLOY_PARAMS[chainId];

    if (!params) {
        console.error("\n❌ Error: Network not specified or unsupported.");
        console.error("Please run the script with --network bscTestnet or --network bscMainnet");
        console.error("Example: npx hardhat run scripts/deploy-airdrop.js --network bscTestnet");
        process.exit(1);
    }

    console.log(`🎯 Target Network: ${params.networkName} (Using --network ${networkName})`);

    const action = await prompt("\n❓ Do you want to [D]eploy a new Airdrop contract or [F]und an existing one? (D/F): ");

    try {
        if (action.toLowerCase() === 'd') {
            await deployNewContract(params);
        } else if (action.toLowerCase() === 'f') {
            await fundExistingContract(params);
        } else {
            console.log("Invalid choice. Please enter 'D' or 'F'.");
        }
    } catch (error) {
        console.error("\nWizard failed with an error:");
        console.error(error);
        process.exitCode = 1;
    } finally {
        rl.close();
    }
}

// Execute the script
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
// File: scripts/deploy-airdrop.js
import hre from "hardhat";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ethers } from "ethers"; // Import ethers explicitly

// --- Helper Functions ---
const rl = readline.createInterface({ input, output });
const prompt = (query) => rl.question(query);
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// --- Constants ---
const VERIFICATION_MAX_RETRIES = 5;
const VERIFICATION_RETRY_DELAY_MS = 30000; // 30 seconds
const PASS_TOKEN_DECIMALS_TESTNET = 6; // Decimals for Testnet PASS
const PASS_TOKEN_DECIMALS_MAINNET = 18; // Decimals for Mainnet PASS (assumed)
const MAX_FUNDING_RETRIES = 3;

// Network-specific parameters (using ChainID as the key)
// REMOVED basRegistryAddress - will be asked in wizard
const DEPLOY_PARAMS = {
  "56": { // bscMainnet
    configName: "bscMainnet",
    networkName: "BSC Mainnet",
    chainId: "56",
    rpcUrls: [
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-dataseed1.ninicoin.io/",
        "https://bsc.publicnode.com",
    ],
    tokenAddress: "0xe1F07dDeC3DC807a8861396E1c849E5612c8eD57",
    tokenDecimals: PASS_TOKEN_DECIMALS_MAINNET, // Added decimals here
    // basRegistryAddress: "...", // Removed
    humanSchemaId: "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539",
    blockExplorerUrls: ["https://bscscan.com"],
  },
  "97": { // bscTestnet
    configName: "bscTestnet",
    networkName: "BSC Testnet",
    chainId: "97",
    rpcUrls: [
        "https://data-seed-prebsc-1-s1.binance.org:8545/",
        "https://data-seed-prebsc-2-s1.binance.org:8545/",
        "https://data-seed-prebsc-1-s2.binance.org:8545/",
        "https://data-seed-prebsc-2-s2.binance.org:8545/",
        "https://bsc-testnet.publicnode.com",
    ],
    tokenAddress: "0x1f7c2af1203dbC4b030a3450727C9B4C99337140",
    tokenDecimals: PASS_TOKEN_DECIMALS_TESTNET, // Added decimals here
    // basRegistryAddress: "...", // Removed
    humanSchemaId: "0x43e35dc52f67fcde0aafd02b05637e1986242c239ed0bab1bc6ef698ff511539",
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  }
};

// Minimal ABI for ERC20 transfer and balanceOf
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
];

// --- Deployment Function ---
async function deployNewContract(params) {
  console.log(`\n--- Deploying New Contract on ${params.networkName} ---`);
  console.log(`   (Using default RPC URL from hardhat.config.js for deployment/verification)`);
  console.log(`   Network:         ${hre.network.name} (ChainID: ${hre.network.config.chainId})`);
  console.log(`   PASS Token:      ${params.tokenAddress}`);
  // Removed BAS Registry display here, will ask next
  console.log(`   Human Schema ID: ${params.humanSchemaId}`);

  // *** NEW: Ask for BAS Registry Address ***
  const basRegistryAddressInput = await prompt(`\n❓ Enter the BAS Registry contract address for ${params.networkName}: `);
  let basRegistryAddress;
  try {
      basRegistryAddress = hre.ethers.getAddress(basRegistryAddressInput.toLowerCase()); // Checksum it
      console.log(`   Using BAS Registry: ${basRegistryAddress}`);
  } catch (e) {
      throw new Error(`Invalid BAS Registry address provided: ${e.message}`);
  }
  // *** END NEW SECTION ***

  const claimAmountInEther = await prompt("\n❓ Enter the claim amount per user (e.g., '50'): ");
  let claimAmountInWei;
  try {
    // Use tokenDecimals specific to the network
    claimAmountInWei = hre.ethers.parseUnits(claimAmountInEther, params.tokenDecimals);
    if (claimAmountInWei <= 0n) throw new Error("Amount must be positive.");
  } catch (e) {
    throw new Error(`Invalid claim amount: ${e.message}`);
  }

  const tokenAddress = hre.ethers.getAddress(params.tokenAddress.toLowerCase());
  // basRegistryAddress is already checksummed from user input

  const constructorArgs = [
    tokenAddress,
    basRegistryAddress, // Use the user-provided address
    params.humanSchemaId,
    claimAmountInWei
  ];

  console.log("\n--- Review Deployment Transaction ---");
  console.log(`   Deploying:       AirdropSimple`);
  console.log(`   Network:         ${params.networkName}`);
  console.log(`   PASS Token:      ${tokenAddress}`);
  console.log(`   BAS Registry:    ${basRegistryAddress}`); // Show the address being used
  console.log(`   Human Schema ID: ${params.humanSchemaId}`);
  console.log(`   Claim Amount:    ${claimAmountInEther} PASS (${claimAmountInWei.toString()} base units, ${params.tokenDecimals} decimals)`);

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
        constructorArguments: constructorArgs, // Uses the user-provided BAS address
      });
      console.log("✅ Done: Contract verified successfully!");
      isVerified = true;
      break;
    } catch (error) {
       // Error handling remains the same
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

// --- Funding Function ---
// (No changes needed here, uses PASS_TOKEN_DECIMALS based on network)
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
    let fundingAmountBaseUnits;
    try {
        // Use tokenDecimals specific to the network
        fundingAmountBaseUnits = hre.ethers.parseUnits(fundingAmountInPass, params.tokenDecimals);
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
    let currentPassBalanceBaseUnits = -1n;
    let nativeBalanceFormatted = "N/A";
    let firstRpcToCheck = params.rpcUrls[0]; // Use the first available RPC
    try {
        if (!firstRpcToCheck) throw new Error("No RPC URLs configured for balance check.");
        console.log(`\nChecking sender balance using RPC: ${firstRpcToCheck}`);
        const tempProvider = new ethers.JsonRpcProvider(firstRpcToCheck);
        const passTokenContractCheck = new ethers.Contract(passTokenAddress, ERC20_ABI, tempProvider);
        currentPassBalanceBaseUnits = await passTokenContractCheck.balanceOf(senderAddress);
        // Use tokenDecimals specific to the network
        currentPassBalanceFormatted = ethers.formatUnits(currentPassBalanceBaseUnits, params.tokenDecimals);

        const nativeBalanceWei = await tempProvider.getBalance(senderAddress);
        nativeBalanceFormatted = ethers.formatEther(nativeBalanceWei);

    } catch (balanceError) {
        console.warn(`   ⚠️ Warning: Could not check sender balance beforehand using ${firstRpcToCheck}: ${balanceError.message}`);
    }
    // --- End Balance Check ---

    console.log("\n--- Review Funding Transaction ---");
    console.log(`   Network:          ${params.networkName}`);
    console.log(`   Sender Address:   ${senderAddress}`);
    console.log(`   Sender Balance:   ${currentPassBalanceFormatted} PASS`);
    console.log(`   Sender Gas Bal:   ${nativeBalanceFormatted} Native`);
    console.log(`   Funding Amount:   ${fundingAmountInPass} PASS (${fundingAmountBaseUnits.toString()} base units, ${params.tokenDecimals} decimals)`);
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

                // Check PASS balance again just before sending on *this* RPC
                 try {
                    const passTokenContractCheck = new ethers.Contract(passTokenAddress, ERC20_ABI, provider);
                    const currentPassBalance = await passTokenContractCheck.balanceOf(signer.address);
                    console.log(`   (Debug) PASS Balance Check via script (RPC ${rpcUrl}): ${ethers.formatUnits(currentPassBalance, params.tokenDecimals)} PASS`);
                    if (currentPassBalance < fundingAmountBaseUnits) {
                         console.error(`   STOPPING attempt on ${rpcUrl}: Script detected PASS balance (${ethers.formatUnits(currentPassBalance, params.tokenDecimals)}) is less than requested amount (${fundingAmountInPass}).`);
                         attempt = MAX_FUNDING_RETRIES; // Force exit retry loop for this RPC
                         transferSuccessful = false;
                         continue; // Skip to next attempt/RPC
                    }
                } catch (balanceError) {
                    console.error(`   (Debug) Error checking PASS balance via script on ${rpcUrl}: ${balanceError.message}`);
                    console.warn(`   Continuing transfer attempt despite balance check error...`);
                }


                console.log(`   Sending PASS tokens (Attempt ${attempt}/${MAX_FUNDING_RETRIES})...`);
                const passTokenContract = new ethers.Contract(passTokenAddress, ERC20_ABI, signer);

                const tx = await passTokenContract.transfer(validatedAirdropAddress, fundingAmountBaseUnits);
                console.log(`   Transaction sent: ${tx.hash}`);
                console.log("   Waiting for confirmation...");
                const receipt = await tx.wait(1);

                transferSuccessful = true;
                finalTxHash = receipt.hash;
                finalReceipt = receipt;
                break; // Exit retry loop

            } catch (error) {
                // Error handling remains the same
                console.error(`   Attempt ${attempt} failed with RPC ${rpcUrl}:`);
                const errorMsg = error.message.toLowerCase();

                if (errorMsg.includes("insufficient funds")) {
                    console.error("   Error: Insufficient BNB/tBNB for gas.");
                    attempt = MAX_FUNDING_RETRIES;
                    break;
                } else if (errorMsg.includes("transfer amount exceeds balance")) {
                    console.error("   Error: Insufficient PASS token balance reported by contract.");
                    if (attempt >= MAX_FUNDING_RETRIES) {
                        console.error(`   Max retries reached for ${rpcUrl}. Trying next RPC...`);
                    } else { await delay(5000); }
                } else if (errorMsg.includes("nonce") || errorMsg.includes("replacement transaction underpriced")) {
                    console.error("   Error: Nonce/Gas Price issue. Requires manual intervention.");
                    attempt = MAX_FUNDING_RETRIES;
                    break;
                } else if (errorMsg.includes("timeout") || errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("could not detect")) {
                     console.warn(`   Network/Timeout error.`);
                    if (attempt >= MAX_FUNDING_RETRIES) {
                        console.error(`   Max retries reached for ${rpcUrl}. Trying next RPC...`);
                    } else { await delay(5000); }
                }
                else {
                    console.error(`   Unhandled Error: ${error.message}`);
                     if (attempt >= MAX_FUNDING_RETRIES) {
                        console.error(`   Max retries reached for ${rpcUrl}. Trying next RPC...`);
                    } else { await delay(5000); }
                }
            } // End catch
        } // End retry loop (while)

        if (transferSuccessful) {
            break; // Exit RPC loop (for) if successful
        }
    } // End RPC loop (for)

    // Final Outcome remains the same
    if (transferSuccessful && finalReceipt) {
        const explorerUrl = params.blockExplorerUrls[0] || '';
        const txUrl = explorerUrl ? `${explorerUrl}/tx/${finalTxHash}` : `Tx Hash: ${finalTxHash}`;
        console.log(`\n✅ Success! Tokens transferred. View on explorer: ${txUrl}`);
    } else {
        console.error("\n❌ FAILED: Token transfer failed after trying all RPC URLs and retries.");
        console.error("   Please check errors, balances (PASS and native token for gas), and network connectivity.");
    }
}


// --- Main Execution ---
// (Remains the same - relies on --network flag)
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
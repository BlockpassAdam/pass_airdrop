// File: AirdropOnChain.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IBASRegistry
 * @notice Interface for the BSC Attestation Service (BAS) Registry.
 * This allows our contract to call the `isAttested` function.
 * Mainnet: 0x085105151557a6908EAD812053A4700f13d8032e
 * Testnet: 0x242D13567d1C2293311E6a9A3f26D07F81393669
 */
interface IBASRegistry {
    /**
     * @notice Checks if an address holds a valid (non-revoked, non-expired) attestation
     * for a specific schema.
     * @param _attester The address to check.
     * @param _schemaId The schema to check against.
     * @return bool True if the attestation exists and is valid, false otherwise.
     */
    function isAttested(address _attester, bytes32 _schemaId) external view returns (bool);
}

/**
 * @title AirdropOnChain
 * @author Gemini
 * @notice This contract distributes ERC20 tokens to users who hold a specific
 * BAS (BSC Attestation Service) attestation.
 *
 * It validates eligibility *on-chain* by calling the BAS Registry directly.
 * This removes the need for an off-chain Merkle tree.
 *
 * It still includes a monthly payout cap and claim periods to manage token velocity
 * as per the original specification.
 */
contract AirdropOnChain is Ownable {
    // --- State Variables ---

    /// @notice The ERC20 token being distributed.
    IERC20 public immutable passToken;
    
    /// @notice The BAS Registry contract.
    IBASRegistry public immutable basRegistry;
    
    /// @notice The Schema ID for the "Human" attestation.
    bytes32 public immutable humanSchemaId;

    /// @notice The maximum number of tokens that can be claimed in a single month (in wei).
    uint256 public monthlyPayoutLimit;

    /// @notice The total number of tokens paid out in the current monthly cycle.
    uint256 public currentMonthPayout;

    /// @notice The timestamp when the current monthly payout period started.
    uint256 public monthStartTime;

    /// @notice The amount of tokens for a single claim in the current period.
    uint256 public currentClaimAmount;

    /// @notice Tracks claims to prevent double-spending. Maps periodId => userAddress => hasClaimed.
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    
    /// @notice The current claim period ID. Incremented by the owner.
    uint256 public currentPeriod;

    // --- Events ---
    event Claim(address indexed user, uint256 amount, uint256 period);
    event MonthlyLimitReset(uint256 timestamp);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event ClaimPeriodUpdated(uint256 indexed newPeriod, uint256 newClaimAmount);

    // --- Constructor ---

    /**
     * @param _tokenAddress The address of the ERC20 token to be airdropped (PASS).
     * @param _basRegistryAddress The address of the BAS Registry contract.
     * @param _humanSchemaId The schemaId of the "Human" attestation.
     * @param _monthlyPayoutLimit The initial monthly payout limit (in wei).
     * @param _initialClaimAmount The claim amount for the first period (e.g., 50e18 for 50 tokens).
     */
    constructor(
        address _tokenAddress,
        address _basRegistryAddress,
        bytes32 _humanSchemaId,
        uint256 _monthlyPayoutLimit,
        uint256 _initialClaimAmount
    ) Ownable(msg.sender) {
        require(_tokenAddress != address(0), "Airdrop: Token address cannot be zero");
        require(_basRegistryAddress != address(0), "Airdrop: Registry address cannot be zero");
        
        passToken = IERC20(_tokenAddress);
        basRegistry = IBASRegistry(_basRegistryAddress);
        humanSchemaId = _humanSchemaId;
        monthlyPayoutLimit = _monthlyPayoutLimit;
        currentClaimAmount = _initialClaimAmount;
        
        monthStartTime = block.timestamp;
        currentPeriod = 1; // Start with period 1
    }

    // --- Public Claim Function ---

    /**
     * @notice Allows a user to claim their tokens if they hold the required attestation.
     * The contract checks eligibility on-chain.
     */
    function claim() external {
        // Check 1: Validate the user holds the required attestation *right now*.
        require(basRegistry.isAttested(msg.sender, humanSchemaId), "Airdrop: Not attested");

        // Check 2: Ensure the user hasn't already claimed in the current period.
        require(!hasClaimed[currentPeriod][msg.sender], "Airdrop: Already claimed for this period");

        // Check 3: Check if the monthly payout period needs to be reset.
        if (block.timestamp >= monthStartTime + 30 days) {
            _resetMonthlyPayout();
        }

        // Check 4: Ensure the monthly payout limit has not been exceeded.
        uint256 claimAmount = currentClaimAmount; // Use local var for gas
        require(currentMonthPayout + claimAmount <= monthlyPayoutLimit, "Airdrop: Monthly payout limit exceeded");

        // If all checks pass:
        // 1. Mark the user as having claimed.
        hasClaimed[currentPeriod][msg.sender] = true;

        // 2. Update the monthly payout counter.
        currentMonthPayout += claimAmount;

        // 3. Transfer the tokens to the user.
        bool sent = passToken.transfer(msg.sender, claimAmount);
        require(sent, "Airdrop: Token transfer failed");

        // 4. Emit a claim event.
        emit Claim(msg.sender, claimAmount, currentPeriod);
    }

    // --- Owner-Only Functions ---

    /**
     * @notice Updates to a new claim period and sets the reward amount for that period.
     * This allows the owner to taper rewards (e.g., 50, 25, 12.5 tokens).
     * @param _newClaimAmount The new amount of tokens for a single claim.
     */
    function updateClaimPeriod(uint256 _newClaimAmount) external onlyOwner {
        currentPeriod++;
        currentClaimAmount = _newClaimAmount;
        emit ClaimPeriodUpdated(currentPeriod, _newClaimAmount);
    }
    
    /**
     * @notice Allows the owner to update the monthly payout limit.
     * @param _newLimit The new limit in token wei.
     */
    function setMonthlyPayoutLimit(uint256 _newLimit) external onlyOwner {
        monthlyPayoutLimit = _newLimit;
    }

    /**
     * @notice Manually resets the monthly payout counter and start time.
     */
    function resetMonthlyPayout() external onlyOwner {
        _resetMonthlyPayout();
    }

    /**
     * @notice Allows the owner to withdraw any remaining tokens from the contract.
     * @param _to The address to receive the withdrawn tokens.
     */
    function withdrawUnclaimedTokens(address _to) external onlyOwner {
        uint256 balance = passToken.balanceOf(address(this));
        require(balance > 0, "Airdrop: No tokens to withdraw");
        bool sent = passToken.transfer(_to, balance);
        require(sent, "Airdrop: Withdrawal transfer failed");
        emit TokensWithdrawn(address(passToken), _to, balance);
    }
    
    // --- Internal Functions ---

    /**
     * @dev Internal function to reset monthly payout state.
     */
    function _resetMonthlyPayout() internal {
        currentMonthPayout = 0;
        monthStartTime = block.timestamp;
        emit MonthlyLimitReset(block.timestamp);
    }
}


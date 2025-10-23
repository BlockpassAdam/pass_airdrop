// File: AirdropSimple.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IBASRegistry
 * @dev Interface for the BSC Attestation Service (BAS) registry.
 * We only need the isAttested function.
 */
interface IBASRegistry {
    /**
     * @notice Checks if an attestation from a specific schema exists for a subject.
     * @param _subject The address of the subject (the user).
     * @param _schemaId The bytes32 ID of the schema.
     * @return bool True if the attestation exists, false otherwise.
     */
    function isAttested(address _subject, bytes32 _schemaId) external view returns (bool);
}

/**
 * @title AirdropSimple
 * @author (Your Name / Project Name)
 * @notice A simple airdrop contract for PASS tokens.
 *
 * This contract allows users with a specific BAS Attestation (e.g., "Human")
 * to claim a one-time, fixed amount of PASS tokens.
 *
 * Logic:
 * 1. User must hold the required `humanSchemaId` attestation.
 * 2. User must not have claimed tokens before.
 * 3. If both pass, the contract sends a fixed `CLAIM_AMOUNT` of tokens.
 *
 * This contract has NO time-based logic, NO monthly caps, and NO tapering rewards.
 */
contract AirdropSimple is Ownable {
    // --- State Variables ---

    // The ERC20 token being airdropped (PASS Token)
    IERC20 public immutable passToken;
    
    // The BAS Registry contract
    IBASRegistry public immutable basRegistry;
    
    // The Schema ID for the "Human" attestation
    bytes32 public immutable humanSchemaId;
    
    // The fixed, one-time amount of tokens a user can claim
    uint256 public immutable CLAIM_AMOUNT;

    // Mapping to track which addresses have already claimed
    mapping(address => bool) public hasClaimed;

    // --- Events ---

    /**
     * @notice Emitted when a user successfully claims their tokens.
     * @param user The address of the claimant.
     * @param amount The amount of tokens claimed.
     */
    event Claim(address indexed user, uint256 amount);

    /**
     * @notice Emitted when the owner withdraws remaining tokens.
     * @param token The address of the token (PASS).
     * @param to The address receiving the tokens.
     * @param amount The amount of tokens withdrawn.
     */
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);

    // --- Constructor ---

    /**
     * @notice Deploys the AirdropSimple contract.
     * @param _tokenAddress The address of the PASS ERC20 token.
     * @param _basRegistryAddress The address of the BAS Registry contract.
     * @param _humanSchemaId The bytes32 schema ID for the "Human" attestation.
     * @param _claimAmount The fixed amount of tokens (in wei) for each claim.
     */
    constructor(
        address _tokenAddress,
        address _basRegistryAddress,
        bytes32 _humanSchemaId,
        uint256 _claimAmount
    ) Ownable(msg.sender) {
        require(_tokenAddress != address(0), "Airdrop: Invalid token address");
        require(_basRegistryAddress != address(0), "Airdrop: Invalid BAS address");
        require(_humanSchemaId != bytes32(0), "Airdrop: Invalid schema ID");
        require(_claimAmount > 0, "Airdrop: Claim amount must be greater than 0");

        passToken = IERC20(_tokenAddress);
        basRegistry = IBASRegistry(_basRegistryAddress);
        humanSchemaId = _humanSchemaId;
        CLAIM_AMOUNT = _claimAmount;
    }

    // --- Public Functions ---

    /**
     * @notice Public function for users to claim their one-time airdrop.
     *
     * Requirements:
     * 1. The caller (`msg.sender`) must be attested with the `humanSchemaId`.
     * 2. The caller must not have claimed tokens before.
     */
    function claim() external {
        address user = msg.sender;

        // 1. Check attestation
        // This is a live, on-chain call to the BAS contract.
        bool isAttested = basRegistry.isAttested(user, humanSchemaId);
        require(isAttested, "Airdrop: Not attested");

        // 2. Check if user has already claimed
        require(!hasClaimed[user], "Airdrop: Already claimed");

        // 3. Mark as claimed
        // This prevents the user from claiming ever again.
        hasClaimed[user] = true;

        // 4. Transfer the tokens
        bool sent = passToken.transfer(user, CLAIM_AMOUNT);
        require(sent, "Airdrop: Token transfer failed");

        emit Claim(user, CLAIM_AMOUNT);
    }

    // --- Owner Functions ---

    /**
     * @notice Allows the owner to withdraw any remaining tokens from the contract.
     * This is useful after the airdrop campaign has concluded.
     * @param _to The address to receive the withdrawn tokens (e.g., treasury).
     */
    function withdrawUnclaimedTokens(address _to) external onlyOwner {
        require(_to != address(0), "Airdrop: Invalid withdrawal address");
        uint256 balance = passToken.balanceOf(address(this));
        require(balance > 0, "Airdrop: No tokens to withdraw");
        
        bool sent = passToken.transfer(_to, balance);
        require(sent, "Airdrop: Withdrawal transfer failed");
        
        emit TokensWithdrawn(address(passToken), _to, balance);
    }
}

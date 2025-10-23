// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// You will need to install OpenZeppelin contracts:
// npm install @openzeppelin/contracts
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title Airdrop
 * @author Gemini
 * @notice A smart contract for distributing ERC20 tokens via a Merkle tree airdrop.
 * It allows a project owner to set a Merkle root for a specific claim period.
 * Eligible users can then provide a Merkle proof to claim their allotted tokens.
 * The contract enforces a monthly payout cap to control token velocity and allows
 * for the management of multiple claim periods.
 */
contract Airdrop is Ownable {
    // --- State Variables ---

    /// @notice The ERC20 token being distributed.
    IERC20 public immutable passToken;

    /// @notice The Merkle root for the current claim period.
    bytes32 public merkleRoot;

    /// @notice The maximum number of tokens that can be claimed in a single month (in wei).
    uint256 public monthlyPayoutLimit;

    /// @notice The total number of tokens paid out in the current monthly cycle.
    uint256 public currentMonthPayout;

    /// @notice The timestamp when the current monthly payout period started.
    uint256 public monthStartTime;

    /// @notice Tracks claims to prevent double-spending. Maps periodId => userAddress => hasClaimed.
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    
    /// @notice The current claim period ID. Incremented with each new Merkle root.
    uint256 public currentPeriod;

    // --- Events ---
    event Claim(address indexed user, uint256 amount, uint256 period);
    event MerkleRootUpdated(bytes32 indexed newRoot, uint256 indexed period);
    event MonthlyLimitReset(uint256 timestamp);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);


    // --- Constructor ---

    /**
     * @param _tokenAddress The address of the ERC20 token to be airdropped.
     * @param _initialMerkleRoot The Merkle root for the first claim period.
     * @param _monthlyPayoutLimit The initial monthly payout limit in token wei.
     */
    constructor(
        address _tokenAddress,
        bytes32 _initialMerkleRoot,
        uint256 _monthlyPayoutLimit
    ) Ownable(msg.sender) {
        require(_tokenAddress != address(0), "Airdrop: Token address cannot be zero");
        passToken = IERC20(_tokenAddress);
        merkleRoot = _initialMerkleRoot;
        monthlyPayoutLimit = _monthlyPayoutLimit;
        monthStartTime = block.timestamp;
        currentPeriod = 1; // Start with period 1
        emit MerkleRootUpdated(_initialMerkleRoot, currentPeriod);
    }

    // --- Public & External Functions ---

    /**
     * @notice Allows an eligible user to claim their tokens.
     * @param _amount The amount of tokens to claim.
     * @param _merkleProof The Merkle proof verifying the user's eligibility.
     */
    function claim(uint256 _amount, bytes32[] calldata _merkleProof) external {
        // Check if the monthly payout period needs to be reset.
        if (block.timestamp >= monthStartTime + 30 days) {
            _resetMonthlyPayout();
        }

        // Check 1: Ensure the user hasn't already claimed in the current period.
        require(!hasClaimed[currentPeriod][msg.sender], "Airdrop: Already claimed for this period");

        // Check 2: Ensure the monthly payout limit has not been exceeded.
        require(currentMonthPayout + _amount <= monthlyPayoutLimit, "Airdrop: Monthly payout limit exceeded");

        // Check 3: Verify the Merkle proof.
        // The leaf is a hash of the claimant's address and their claim amount.
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Airdrop: Invalid Merkle proof");

        // If all checks pass:
        // 1. Mark the user as having claimed for the current period.
        hasClaimed[currentPeriod][msg.sender] = true;

        // 2. Update the monthly payout counter.
        currentMonthPayout += _amount;

        // 3. Transfer the tokens to the user.
        bool sent = passToken.transfer(msg.sender, _amount);
        require(sent, "Airdrop: Token transfer failed");

        // 4. Emit a claim event.
        emit Claim(msg.sender, _amount, currentPeriod);
    }


    // --- Owner-Only Functions ---

    /**
     * @notice Updates the Merkle root for a new claim period.
     * This invalidates old proofs and starts a new airdrop cycle.
     * @param _newRoot The new Merkle root.
     */
    function updateClaimPeriod(bytes32 _newRoot) external onlyOwner {
        currentPeriod++;
        merkleRoot = _newRoot;
        emit MerkleRootUpdated(_newRoot, currentPeriod);
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
     * The claim function automatically calls this if a month has passed,
     * but this allows for manual override by the owner if needed.
     */
    function resetMonthlyPayout() external onlyOwner {
        _resetMonthlyPayout();
    }

    /**
     * @notice Allows the owner to withdraw any remaining tokens from the contract.
     * This is useful after the airdrop campaign has concluded.
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

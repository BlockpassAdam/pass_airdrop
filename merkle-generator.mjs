/*
 * This is an example Node.js script to generate the Merkle tree.
 *
 * To run this:
 * 1. Install dependencies:
 * npm install ethers merkletreejs keccak256
 * 2. Run the script:
 * node merkle-generator.mjs
 */

import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

// BigInt support for ethers v6
// Use ethers.utils.parseUnits for ethers v5
const parseUnits = ethers.parseUnits;

// 1. Define your list of claimants (address, amount).
// The amount should be in the smallest unit (wei).
// Your script would fetch this from the attestation scan.
// This is based on the table in your document.
const claimants = [
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: parseUnits("50", 18) }, // 50 tokens
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', amount: parseUnits("50", 18) }, // 50 tokens
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', amount: parseUnits("25", 18) }, // 25 tokens (e.g., month 2)
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', amount: parseUnits("12.5", 18) }, // 12.5 tokens
  // ... add all other eligible addresses
];

console.log("Generating Merkle tree...");

// 2. Generate the "leaves" of the tree.
// As per the contract: keccak256(abi.encodePacked(msg.sender, _amount))
const leaves = claimants.map(c => {
  return ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [c.address, c.amount]
  );
});

// 3. Create the Merkle tree.
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

// 4. Get the Merkle root.
const root = tree.getHexRoot();

console.log(`\nMERKLE ROOT (for contract constructor or updateClaimPeriod):`);
console.log(root);

// 5. Generate a proof for a specific user to test.
// Let's generate a proof for the first user:
const testUser = claimants[0];
const testLeaf = ethers.solidityPackedKeccak256(
  ['address', 'uint256'],
  [testUser.address, testUser.amount]
);
const proof = tree.getHexProof(testLeaf);

console.log(`\n--- Example Proof for User ${testUser.address} ---`);
console.log(`Amount (in wei):`, testUser.amount.toString());
console.log(`Merkle Proof (copy this JSON array for the front-end):`);
console.log(JSON.stringify(proof));

// You would run this script, get the Merkle Root for the owner,
// and each user would generate their own proof (or you'd provide
// a service for them to fetch their proof).

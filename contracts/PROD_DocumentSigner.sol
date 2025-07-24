// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentSigner is ReentrancyGuard, Ownable {
    struct Signature {
        address signer;
        uint256 timestamp;
    }

    bytes32 public documentHash;
    string public ipfsCid;  // New: Store IPFS CID for off-chain document
    address[] public requiredSigners;
    mapping(address => bool) public hasSigned;
    Signature[] public signatures;

    event DocumentInitiated(bytes32 indexed docHash, string ipfsCid, address indexed initiator, address[] requiredSigners);
    event DocumentSigned(bytes32 indexed docHash, address indexed signer, uint256 timestamp);

    modifier onlyRequiredSigner() {
        bool isRequired = false;
        for (uint i = 0; i < requiredSigners.length; i++) {
            if (requiredSigners[i] == msg.sender) {
                isRequired = true;
                break;
            }
        }
        require(isRequired, "Not a required signer");
        _;
    }

    constructor(bytes32 _documentHash, string memory _ipfsCid, address[] memory _requiredSigners) {
        documentHash = _documentHash;
        ipfsCid = _ipfsCid;
        requiredSigners = _requiredSigners;
        transferOwnership(msg.sender);  // Initiator owns the contract
        emit DocumentInitiated(_documentHash, _ipfsCid, msg.sender, _requiredSigners);
    }

    function signDocument() public onlyRequiredSigner nonReentrant {
        require(!hasSigned[msg.sender], "Already signed");
        hasSigned[msg.sender] = true;
        signatures.push(Signature(msg.sender, block.timestamp));
        emit DocumentSigned(documentHash, msg.sender, block.timestamp);
    }

    function getSignatures() public view returns (Signature[] memory) {
        return signatures;
    }

    function isFullySigned() public view returns (bool) {
        for (uint i = 0; i < requiredSigners.length; i++) {
            if (!hasSigned[requiredSigners[i]]) {
                return false;
            }
        }
        return true;
    }

    function verifySignature(address signer) public view returns (bool) {
        return hasSigned[signer];
    }

    // Owner can update CID if needed (e.g., for corrections)
    function updateIpfsCid(string memory newCid) public onlyOwner {
        ipfsCid = newCid;
    }
}
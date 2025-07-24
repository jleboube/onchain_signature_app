// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentSigner {
    struct Signature {
        address signer;
        uint256 timestamp;
    }

    mapping(bytes32 => Signature[]) public documentSignatures;

    event DocumentSigned(bytes32 indexed documentHash, address indexed signer, uint256 timestamp);

    function signDocument(bytes32 documentHash) public {
        documentSignatures[documentHash].push(Signature(msg.sender, block.timestamp));
        emit DocumentSigned(documentHash, msg.sender, block.timestamp);
    }

    function getSignatures(bytes32 documentHash) public view returns (Signature[] memory) {
        return documentSignatures[documentHash];
    }

    function verifySignature(bytes32 documentHash, address signer) public view returns (bool) {
        Signature[] memory sigs = documentSignatures[documentHash];
        for (uint i = 0; i < sigs.length; i++) {
            if (sigs[i].signer == signer) {
                return true;
            }
        }
        return false;
    }
}
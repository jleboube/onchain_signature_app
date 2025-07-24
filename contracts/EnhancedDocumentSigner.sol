// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title EnhancedDocumentSigner
 * @dev Enhanced smart contract for blockchain-based document signing with security features
 */
contract EnhancedDocumentSigner is ReentrancyGuard, Ownable, Pausable {
    
    // Custom errors for gas efficiency
    error NotAuthorizedSigner(address signer);
    error AlreadySigned(address signer);
    error DocumentNotFound(bytes32 documentHash);
    error InvalidSigningOrder(uint256 expected, uint256 actual);
    error ContractAlreadyCompleted();
    error InvalidDocumentHash();
    error EmptySignersList();
    error InvalidIPFSCid();
    error SignerNotFound(address signer);
    
    // Enums
    enum SigningStatus {
        INITIATED,
        IN_PROGRESS,
        COMPLETED,
        CANCELLED
    }
    
    // Structs
    struct Signature {
        address signer;
        uint256 timestamp;
        bytes32 documentVersion;
        string metadata;
    }
    
    struct DocumentMetadata {
        string title;
        string description;
        uint256 createdAt;
        address creator;
        bytes32[] versions;
        string[] ipfsCids;
    }
    
    // State variables
    bytes32 public documentHash;
    string public ipfsCid;
    address[] public requiredSigners;
    mapping(address => bool) public hasSigned;
    mapping(address => uint256) public signerIndex;
    Signature[] public signatures;
    SigningStatus public status;
    bool public sequentialSigning;
    uint256 public currentSignerIndex;
    DocumentMetadata public documentMetadata;
    
    // Events
    event DocumentInitiated(
        bytes32 indexed docHash, 
        string ipfsCid, 
        address indexed initiator, 
        address[] requiredSigners,
        bool sequentialSigning
    );
    event DocumentSigned(
        bytes32 indexed docHash, 
        address indexed signer, 
        uint256 timestamp,
        uint256 signerIndex
    );
    event DocumentCompleted(bytes32 indexed docHash, uint256 completedAt);
    event DocumentCancelled(bytes32 indexed docHash, address indexed canceller);
    event SignerReplaced(address indexed oldSigner, address indexed newSigner);
    event IPFSCidUpdated(string oldCid, string newCid);
    
    // Modifiers
    modifier onlyRequiredSigner() {
        if (!_isRequiredSigner(msg.sender)) {
            revert NotAuthorizedSigner(msg.sender);
        }
        _;
    }
    
    modifier notAlreadySigned() {
        if (hasSigned[msg.sender]) {
            revert AlreadySigned(msg.sender);
        }
        _;
    }
    
    modifier contractNotCompleted() {
        if (status == SigningStatus.COMPLETED || status == SigningStatus.CANCELLED) {
            revert ContractAlreadyCompleted();
        }
        _;
    }
    
    modifier validDocumentHash(bytes32 _documentHash) {
        if (_documentHash == bytes32(0)) {
            revert InvalidDocumentHash();
        }
        _;
    }
    
    modifier validIPFSCid(string memory _ipfsCid) {
        if (bytes(_ipfsCid).length == 0) {
            revert InvalidIPFSCid();
        }
        _;
    }
    
    /**
     * @dev Constructor to initialize the document signing contract
     * @param _documentHash Hash of the document to be signed
     * @param _ipfsCid IPFS CID where the document is stored
     * @param _requiredSigners Array of addresses that must sign the document
     * @param _sequentialSigning Whether signers must sign in order
     * @param _title Title of the document
     * @param _description Description of the document
     */
    constructor(
        bytes32 _documentHash,
        string memory _ipfsCid,
        address[] memory _requiredSigners,
        bool _sequentialSigning,
        string memory _title,
        string memory _description
    ) 
        validDocumentHash(_documentHash)
        validIPFSCid(_ipfsCid)
    {
        if (_requiredSigners.length == 0) {
            revert EmptySignersList();
        }
        
        documentHash = _documentHash;
        ipfsCid = _ipfsCid;
        requiredSigners = _requiredSigners;
        sequentialSigning = _sequentialSigning;
        status = SigningStatus.INITIATED;
        
        // Initialize signer indices
        for (uint256 i = 0; i < _requiredSigners.length; i++) {
            signerIndex[_requiredSigners[i]] = i;
        }
        
        // Initialize document metadata
        documentMetadata.title = _title;
        documentMetadata.description = _description;
        documentMetadata.createdAt = block.timestamp;
        documentMetadata.creator = msg.sender;
        documentMetadata.versions.push(_documentHash);
        documentMetadata.ipfsCids.push(_ipfsCid);
        
        _transferOwnership(msg.sender);
        
        emit DocumentInitiated(_documentHash, _ipfsCid, msg.sender, _requiredSigners, _sequentialSigning);
    }
    
    /**
     * @dev Sign the document
     * @param _metadata Optional metadata for the signature
     */
    function signDocument(string memory _metadata) 
        external 
        onlyRequiredSigner 
        notAlreadySigned 
        contractNotCompleted 
        nonReentrant 
        whenNotPaused 
    {
        // Check sequential signing order if enabled
        if (sequentialSigning && signerIndex[msg.sender] != currentSignerIndex) {
            revert InvalidSigningOrder(currentSignerIndex, signerIndex[msg.sender]);
        }
        
        // Mark as signed
        hasSigned[msg.sender] = true;
        
        // Create signature record
        Signature memory newSignature = Signature({
            signer: msg.sender,
            timestamp: block.timestamp,
            documentVersion: documentHash,
            metadata: _metadata
        });
        
        signatures.push(newSignature);
        
        // Update status
        if (status == SigningStatus.INITIATED) {
            status = SigningStatus.IN_PROGRESS;
        }
        
        // Update current signer index for sequential signing
        if (sequentialSigning) {
            currentSignerIndex++;
        }
        
        emit DocumentSigned(documentHash, msg.sender, block.timestamp, signerIndex[msg.sender]);
        
        // Check if fully signed
        if (_isFullySigned()) {
            status = SigningStatus.COMPLETED;
            emit DocumentCompleted(documentHash, block.timestamp);
        }
    }
    
    /**
     * @dev Replace a signer (only owner can do this)
     * @param _oldSigner Address of the signer to replace
     * @param _newSigner Address of the new signer
     */
    function replaceSigner(address _oldSigner, address _newSigner) 
        external 
        onlyOwner 
        contractNotCompleted 
    {
        if (!_isRequiredSigner(_oldSigner)) {
            revert SignerNotFound(_oldSigner);
        }
        
        if (hasSigned[_oldSigner]) {
            revert AlreadySigned(_oldSigner);
        }
        
        // Update the required signers array
        uint256 index = signerIndex[_oldSigner];
        requiredSigners[index] = _newSigner;
        
        // Update signer indices
        signerIndex[_newSigner] = index;
        delete signerIndex[_oldSigner];
        
        emit SignerReplaced(_oldSigner, _newSigner);
    }
    
    /**
     * @dev Cancel the signing process (only owner can do this)
     */
    function cancelSigning() external onlyOwner contractNotCompleted {
        status = SigningStatus.CANCELLED;
        emit DocumentCancelled(documentHash, msg.sender);
    }
    
    /**
     * @dev Update IPFS CID (only owner can do this)
     * @param _newCid New IPFS CID
     */
    function updateIpfsCid(string memory _newCid) 
        external 
        onlyOwner 
        validIPFSCid(_newCid) 
    {
        string memory oldCid = ipfsCid;
        ipfsCid = _newCid;
        
        // Add to document metadata
        documentMetadata.ipfsCids.push(_newCid);
        
        emit IPFSCidUpdated(oldCid, _newCid);
    }
    
    /**
     * @dev Add a new document version
     * @param _newDocumentHash Hash of the new document version
     * @param _newIpfsCid IPFS CID of the new document version
     */
    function addDocumentVersion(bytes32 _newDocumentHash, string memory _newIpfsCid)
        external
        onlyOwner
        validDocumentHash(_newDocumentHash)
        validIPFSCid(_newIpfsCid)
    {
        documentMetadata.versions.push(_newDocumentHash);
        documentMetadata.ipfsCids.push(_newIpfsCid);
        
        // Update current document hash and CID
        documentHash = _newDocumentHash;
        ipfsCid = _newIpfsCid;
    }
    
    /**
     * @dev Pause the contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // View functions
    
    /**
     * @dev Get all signatures
     */
    function getSignatures() external view returns (Signature[] memory) {
        return signatures;
    }
    
    /**
     * @dev Check if the document is fully signed
     */
    function isFullySigned() external view returns (bool) {
        return _isFullySigned();
    }
    
    /**
     * @dev Verify if an address has signed
     * @param _signer Address to check
     */
    function verifySignature(address _signer) external view returns (bool) {
        return hasSigned[_signer];
    }
    
    /**
     * @dev Get required signers
     */
    function getRequiredSigners() external view returns (address[] memory) {
        return requiredSigners;
    }
    
    /**
     * @dev Get signing progress
     */
    function getSigningProgress() external view returns (uint256 signed, uint256 total) {
        signed = signatures.length;
        total = requiredSigners.length;
    }
    
    /**
     * @dev Get next signer (for sequential signing)
     */
    function getNextSigner() external view returns (address) {
        if (!sequentialSigning || currentSignerIndex >= requiredSigners.length) {
            return address(0);
        }
        return requiredSigners[currentSignerIndex];
    }
    
    /**
     * @dev Get document metadata
     */
    function getDocumentMetadata() external view returns (DocumentMetadata memory) {
        return documentMetadata;
    }
    
    // Internal functions
    
    /**
     * @dev Check if address is a required signer
     */
    function _isRequiredSigner(address _signer) internal view returns (bool) {
        for (uint256 i = 0; i < requiredSigners.length; i++) {
            if (requiredSigners[i] == _signer) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Check if document is fully signed
     */
    function _isFullySigned() internal view returns (bool) {
        for (uint256 i = 0; i < requiredSigners.length; i++) {
            if (!hasSigned[requiredSigners[i]]) {
                return false;
            }
        }
        return true;
    }
}
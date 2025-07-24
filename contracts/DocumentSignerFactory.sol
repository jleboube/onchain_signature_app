// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EnhancedDocumentSigner.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title DocumentSignerFactory
 * @dev Factory contract for creating and managing document signing contracts
 */
contract DocumentSignerFactory is Ownable, Pausable {
    
    // Custom errors
    error ContractCreationFailed();
    error InvalidParameters();
    error ContractNotFound(address contractAddress);
    error UnauthorizedAccess();
    
    // Structs
    struct ContractInfo {
        address contractAddress;
        bytes32 documentHash;
        string ipfsCid;
        address initiator;
        uint256 createdAt;
        bool isActive;
        string title;
    }
    
    // State variables
    address[] public allContracts;
    mapping(address => ContractInfo) public contractInfo;
    mapping(address => address[]) public contractsByInitiator;
    mapping(bytes32 => address[]) public contractsByDocumentHash;
    mapping(address => bool) public isValidContract;
    
    uint256 public totalContracts;
    uint256 public activeContracts;
    
    // Events
    event ContractCreated(
        address indexed contractAddress,
        bytes32 indexed documentHash,
        address indexed initiator,
        string ipfsCid,
        string title
    );
    event ContractDeactivated(address indexed contractAddress, address indexed deactivator);
    
    constructor() {
        _transferOwnership(msg.sender);
    }
    
    /**
     * @dev Create a new document signing contract
     * @param _documentHash Hash of the document to be signed
     * @param _ipfsCid IPFS CID where the document is stored
     * @param _requiredSigners Array of addresses that must sign the document
     * @param _sequentialSigning Whether signers must sign in order
     * @param _title Title of the document
     * @param _description Description of the document
     */
    function createSigningContract(
        bytes32 _documentHash,
        string memory _ipfsCid,
        address[] memory _requiredSigners,
        bool _sequentialSigning,
        string memory _title,
        string memory _description
    ) external whenNotPaused returns (address) {
        
        // Validate parameters
        if (_documentHash == bytes32(0) || bytes(_ipfsCid).length == 0 || _requiredSigners.length == 0) {
            revert InvalidParameters();
        }
        
        // Create new contract
        EnhancedDocumentSigner newContract;
        try new EnhancedDocumentSigner(
            _documentHash,
            _ipfsCid,
            _requiredSigners,
            _sequentialSigning,
            _title,
            _description
        ) returns (EnhancedDocumentSigner _contract) {
            newContract = _contract;
        } catch {
            revert ContractCreationFailed();
        }
        
        address contractAddress = address(newContract);
        
        // Store contract information
        ContractInfo memory info = ContractInfo({
            contractAddress: contractAddress,
            documentHash: _documentHash,
            ipfsCid: _ipfsCid,
            initiator: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            title: _title
        });
        
        // Update mappings and arrays
        allContracts.push(contractAddress);
        contractInfo[contractAddress] = info;
        contractsByInitiator[msg.sender].push(contractAddress);
        contractsByDocumentHash[_documentHash].push(contractAddress);
        isValidContract[contractAddress] = true;
        
        // Update counters
        totalContracts++;
        activeContracts++;
        
        emit ContractCreated(contractAddress, _documentHash, msg.sender, _ipfsCid, _title);
        
        return contractAddress;
    }
    
    /**
     * @dev Deactivate a contract (only contract initiator or factory owner)
     * @param _contractAddress Address of the contract to deactivate
     */
    function deactivateContract(address _contractAddress) external {
        if (!isValidContract[_contractAddress]) {
            revert ContractNotFound(_contractAddress);
        }
        
        ContractInfo storage info = contractInfo[_contractAddress];
        
        // Check authorization
        if (msg.sender != info.initiator && msg.sender != owner()) {
            revert UnauthorizedAccess();
        }
        
        if (info.isActive) {
            info.isActive = false;
            activeContracts--;
            emit ContractDeactivated(_contractAddress, msg.sender);
        }
    }
    
    /**
     * @dev Pause the factory (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the factory (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // View functions
    
    /**
     * @dev Get all contracts created by a specific initiator
     * @param _initiator Address of the initiator
     */
    function getContractsByInitiator(address _initiator) external view returns (address[] memory) {
        return contractsByInitiator[_initiator];
    }
    
    /**
     * @dev Get all contracts for a specific document hash
     * @param _documentHash Hash of the document
     */
    function getContractsByDocumentHash(bytes32 _documentHash) external view returns (address[] memory) {
        return contractsByDocumentHash[_documentHash];
    }
    
    /**
     * @dev Get contract information
     * @param _contractAddress Address of the contract
     */
    function getContractInfo(address _contractAddress) external view returns (ContractInfo memory) {
        if (!isValidContract[_contractAddress]) {
            revert ContractNotFound(_contractAddress);
        }
        return contractInfo[_contractAddress];
    }
    
    /**
     * @dev Get all contracts (paginated)
     * @param _offset Starting index
     * @param _limit Number of contracts to return
     */
    function getAllContracts(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (address[] memory contracts, uint256 total) 
    {
        total = allContracts.length;
        
        if (_offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        contracts = new address[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            contracts[i - _offset] = allContracts[i];
        }
    }
    
    /**
     * @dev Get active contracts (paginated)
     * @param _offset Starting index
     * @param _limit Number of contracts to return
     */
    function getActiveContracts(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (address[] memory contracts, uint256 total) 
    {
        // Count active contracts
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allContracts.length; i++) {
            if (contractInfo[allContracts[i]].isActive) {
                activeCount++;
            }
        }
        
        total = activeCount;
        
        if (_offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        contracts = new address[](end - _offset);
        uint256 currentIndex = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < allContracts.length && resultIndex < (end - _offset); i++) {
            if (contractInfo[allContracts[i]].isActive) {
                if (currentIndex >= _offset) {
                    contracts[resultIndex] = allContracts[i];
                    resultIndex++;
                }
                currentIndex++;
            }
        }
    }
    
    /**
     * @dev Get factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 _totalContracts,
        uint256 _activeContracts,
        uint256 _inactiveContracts
    ) {
        _totalContracts = totalContracts;
        _activeContracts = activeContracts;
        _inactiveContracts = totalContracts - activeContracts;
    }
    
    /**
     * @dev Check if a contract was created by this factory
     * @param _contractAddress Address to check
     */
    function isContractValid(address _contractAddress) external view returns (bool) {
        return isValidContract[_contractAddress];
    }
    
    /**
     * @dev Get contracts by status for a specific initiator
     * @param _initiator Address of the initiator
     * @param _activeOnly Whether to return only active contracts
     */
    function getContractsByInitiatorAndStatus(address _initiator, bool _activeOnly) 
        external 
        view 
        returns (address[] memory) 
    {
        address[] memory initiatorContracts = contractsByInitiator[_initiator];
        
        if (!_activeOnly) {
            return initiatorContracts;
        }
        
        // Count active contracts for this initiator
        uint256 activeCount = 0;
        for (uint256 i = 0; i < initiatorContracts.length; i++) {
            if (contractInfo[initiatorContracts[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active contracts
        address[] memory activeContracts = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < initiatorContracts.length; i++) {
            if (contractInfo[initiatorContracts[i]].isActive) {
                activeContracts[index] = initiatorContracts[i];
                index++;
            }
        }
        
        return activeContracts;
    }
}
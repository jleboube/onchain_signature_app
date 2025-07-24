const { ethers } = require("hardhat");
const { expect } = require("chai");

// Test data constants
const TEST_DOCUMENT_HASH = ethers.keccak256(ethers.toUtf8Bytes("test document content"));
const TEST_IPFS_CID = "QmTestCID123456789";
const TEST_TITLE = "Test Document";
const TEST_DESCRIPTION = "Test document for signing";

// Helper functions
async function deployFactory() {
  const DocumentSignerFactory = await ethers.getContractFactory("DocumentSignerFactory");
  const factory = await DocumentSignerFactory.deploy();
  await factory.waitForDeployment();
  return factory;
}

async function deployEnhancedDocumentSigner(
  documentHash = TEST_DOCUMENT_HASH,
  ipfsCid = TEST_IPFS_CID,
  requiredSigners = [],
  sequentialSigning = false,
  title = TEST_TITLE,
  description = TEST_DESCRIPTION
) {
  const EnhancedDocumentSigner = await ethers.getContractFactory("EnhancedDocumentSigner");
  const contract = await EnhancedDocumentSigner.deploy(
    documentHash,
    ipfsCid,
    requiredSigners,
    sequentialSigning,
    title,
    description
  );
  await contract.waitForDeployment();
  return contract;
}

async function createSigningContractViaFactory(
  factory,
  initiator,
  documentHash = TEST_DOCUMENT_HASH,
  ipfsCid = TEST_IPFS_CID,
  requiredSigners = [],
  sequentialSigning = false,
  title = TEST_TITLE,
  description = TEST_DESCRIPTION
) {
  const tx = await factory.connect(initiator).createSigningContract(
    documentHash,
    ipfsCid,
    requiredSigners,
    sequentialSigning,
    title,
    description
  );
  const receipt = await tx.wait();
  
  // Extract contract address from event
  const event = receipt.logs.find(log => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === "ContractCreated";
    } catch {
      return false;
    }
  });
  
  if (!event) {
    throw new Error("ContractCreated event not found");
  }
  
  const parsedEvent = factory.interface.parseLog(event);
  const contractAddress = parsedEvent.args.contractAddress;
  
  // Return contract instance
  const EnhancedDocumentSigner = await ethers.getContractFactory("EnhancedDocumentSigner");
  return EnhancedDocumentSigner.attach(contractAddress);
}

async function getSigners(count = 5) {
  const signers = await ethers.getSigners();
  return signers.slice(0, count);
}

async function expectRevert(promise, errorMessage) {
  try {
    await promise;
    expect.fail("Expected transaction to revert");
  } catch (error) {
    if (errorMessage) {
      expect(error.message).to.include(errorMessage);
    }
  }
}

async function expectEvent(tx, eventName, expectedArgs = {}) {
  const receipt = await tx.wait();
  const event = receipt.logs.find(log => {
    try {
      const parsed = log.interface ? log.interface.parseLog(log) : null;
      return parsed && parsed.name === eventName;
    } catch {
      return false;
    }
  });
  
  expect(event).to.not.be.undefined;
  
  if (Object.keys(expectedArgs).length > 0) {
    const parsedEvent = event.interface.parseLog(event);
    for (const [key, value] of Object.entries(expectedArgs)) {
      expect(parsedEvent.args[key]).to.equal(value);
    }
  }
  
  return event;
}

function generateRandomHash() {
  return ethers.keccak256(ethers.toUtf8Bytes(Math.random().toString()));
}

function generateRandomIPFSCid() {
  return `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}

async function advanceTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
}

async function getBlockTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

// Test scenarios
const testScenarios = {
  twoPartySequential: {
    sequentialSigning: true,
    signerCount: 2,
    description: "Two party sequential signing"
  },
  twoPartyParallel: {
    sequentialSigning: false,
    signerCount: 2,
    description: "Two party parallel signing"
  },
  multiPartySequential: {
    sequentialSigning: true,
    signerCount: 5,
    description: "Multi-party sequential signing"
  },
  multiPartyParallel: {
    sequentialSigning: false,
    signerCount: 5,
    description: "Multi-party parallel signing"
  }
};

module.exports = {
  // Constants
  TEST_DOCUMENT_HASH,
  TEST_IPFS_CID,
  TEST_TITLE,
  TEST_DESCRIPTION,
  
  // Deployment helpers
  deployFactory,
  deployEnhancedDocumentSigner,
  createSigningContractViaFactory,
  
  // Test utilities
  getSigners,
  expectRevert,
  expectEvent,
  generateRandomHash,
  generateRandomIPFSCid,
  advanceTime,
  getBlockTimestamp,
  
  // Test scenarios
  testScenarios
};
const { ethers, network } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log(`\n🧪 Testing deployment on ${network.name}...`);
  
  const deploymentFile = path.join(__dirname, '..', 'deployments', `${network.name}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.log("❌ No deployment file found. Please deploy contracts first.");
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const [deployer, user1, user2] = await ethers.getSigners();
  
  console.log(`📝 Testing with accounts:`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   User1: ${user1.address}`);
  console.log(`   User2: ${user2.address}`);

  try {
    // Test factory contract
    await testFactoryContract(deployments, deployer, user1, user2);
    
    // Test document signing workflow
    await testSigningWorkflow(deployments, user1, user2);
    
    console.log("\n🎉 All tests passed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

async function testFactoryContract(deployments, deployer, user1, user2) {
  console.log("\n📦 Testing DocumentSignerFactory...");
  
  const factory = await ethers.getContractAt("DocumentSignerFactory", deployments.factory.address);
  
  // Test initial state
  const initialTotalContracts = await factory.totalContracts();
  const initialActiveContracts = await factory.activeContracts();
  const owner = await factory.owner();
  
  console.log(`✅ Initial state:`);
  console.log(`   Total contracts: ${initialTotalContracts}`);
  console.log(`   Active contracts: ${initialActiveContracts}`);
  console.log(`   Owner: ${owner}`);
  
  // Test contract creation
  const documentHash = ethers.keccak256(ethers.toUtf8Bytes("Test document content"));
  const ipfsCid = "QmTestCID123456789";
  const requiredSigners = [user1.address, user2.address];
  const title = "Test Document";
  const description = "Test document for signing";
  
  console.log("\n📝 Creating signing contract...");
  const tx = await factory.connect(user1).createSigningContract(
    documentHash,
    ipfsCid,
    requiredSigners,
    false, // parallel signing
    title,
    description
  );
  
  const receipt = await tx.wait();
  console.log(`✅ Contract created. Gas used: ${receipt.gasUsed}`);
  
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
  
  console.log(`📍 New contract address: ${contractAddress}`);
  
  // Test factory state after creation
  const newTotalContracts = await factory.totalContracts();
  const newActiveContracts = await factory.activeContracts();
  
  console.log(`✅ Updated state:`);
  console.log(`   Total contracts: ${newTotalContracts}`);
  console.log(`   Active contracts: ${newActiveContracts}`);
  
  // Test contract info retrieval
  const contractInfo = await factory.getContractInfo(contractAddress);
  console.log(`✅ Contract info retrieved:`);
  console.log(`   Document hash: ${contractInfo.documentHash}`);
  console.log(`   IPFS CID: ${contractInfo.ipfsCid}`);
  console.log(`   Initiator: ${contractInfo.initiator}`);
  console.log(`   Title: ${contractInfo.title}`);
  
  return contractAddress;
}

async function testSigningWorkflow(deployments, user1, user2) {
  console.log("\n✍️  Testing document signing workflow...");
  
  const factory = await ethers.getContractAt("DocumentSignerFactory", deployments.factory.address);
  
  // Create a new signing contract for testing
  const documentHash = ethers.keccak256(ethers.toUtf8Bytes("Signing workflow test document"));
  const ipfsCid = "QmSigningTestCID987654321";
  const requiredSigners = [user1.address, user2.address];
  const title = "Signing Workflow Test";
  const description = "Test document for signing workflow";
  
  const tx = await factory.connect(user1).createSigningContract(
    documentHash,
    ipfsCid,
    requiredSigners,
    false, // parallel signing
    title,
    description
  );
  
  const receipt = await tx.wait();
  const event = receipt.logs.find(log => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === "ContractCreated";
    } catch {
      return false;
    }
  });
  
  const parsedEvent = factory.interface.parseLog(event);
  const contractAddress = parsedEvent.args.contractAddress;
  
  // Get contract instance
  const signingContract = await ethers.getContractAt("EnhancedDocumentSigner", contractAddress);
  
  // Test initial state
  const initialSignatures = await signingContract.getSignatures();
  const initialProgress = await signingContract.getSigningProgress();
  const isInitiallyFullySigned = await signingContract.isFullySigned();
  
  console.log(`✅ Initial signing state:`);
  console.log(`   Signatures: ${initialSignatures.length}`);
  console.log(`   Progress: ${initialProgress.signed}/${initialProgress.total}`);
  console.log(`   Fully signed: ${isInitiallyFullySigned}`);
  
  // User1 signs the document
  console.log("\n📝 User1 signing document...");
  const signTx1 = await signingContract.connect(user1).signDocument("Approved by User1");
  const signReceipt1 = await signTx1.wait();
  console.log(`✅ User1 signed. Gas used: ${signReceipt1.gasUsed}`);
  
  // Check state after first signature
  const midSignatures = await signingContract.getSignatures();
  const midProgress = await signingContract.getSigningProgress();
  const isMidFullySigned = await signingContract.isFullySigned();
  const user1HasSigned = await signingContract.hasSigned(user1.address);
  
  console.log(`✅ State after User1 signature:`);
  console.log(`   Signatures: ${midSignatures.length}`);
  console.log(`   Progress: ${midProgress.signed}/${midProgress.total}`);
  console.log(`   Fully signed: ${isMidFullySigned}`);
  console.log(`   User1 has signed: ${user1HasSigned}`);
  
  // User2 signs the document
  console.log("\n📝 User2 signing document...");
  const signTx2 = await signingContract.connect(user2).signDocument("Approved by User2");
  const signReceipt2 = await signTx2.wait();
  console.log(`✅ User2 signed. Gas used: ${signReceipt2.gasUsed}`);
  
  // Check final state
  const finalSignatures = await signingContract.getSignatures();
  const finalProgress = await signingContract.getSigningProgress();
  const isFinallyFullySigned = await signingContract.isFullySigned();
  const user2HasSigned = await signingContract.hasSigned(user2.address);
  const contractStatus = await signingContract.status();
  
  console.log(`✅ Final state:`);
  console.log(`   Signatures: ${finalSignatures.length}`);
  console.log(`   Progress: ${finalProgress.signed}/${finalProgress.total}`);
  console.log(`   Fully signed: ${isFinallyFullySigned}`);
  console.log(`   User2 has signed: ${user2HasSigned}`);
  console.log(`   Contract status: ${contractStatus} (2 = COMPLETED)`);
  
  // Verify signature details
  console.log(`\n📋 Signature details:`);
  for (let i = 0; i < finalSignatures.length; i++) {
    const sig = finalSignatures[i];
    console.log(`   Signature ${i + 1}:`);
    console.log(`     Signer: ${sig.signer}`);
    console.log(`     Timestamp: ${new Date(Number(sig.timestamp) * 1000).toISOString()}`);
    console.log(`     Metadata: ${sig.metadata}`);
  }
  
  // Test error cases
  console.log("\n🚫 Testing error cases...");
  
  // Try to sign again (should fail)
  try {
    await signingContract.connect(user1).signDocument("Trying to sign again");
    console.log("❌ Should have failed - user already signed");
  } catch (error) {
    console.log("✅ Correctly prevented double signing");
  }
  
  // Try unauthorized signer
  const [, , , unauthorizedUser] = await ethers.getSigners();
  try {
    await signingContract.connect(unauthorizedUser).signDocument("Unauthorized signature");
    console.log("❌ Should have failed - unauthorized signer");
  } catch (error) {
    console.log("✅ Correctly prevented unauthorized signing");
  }
  
  console.log("\n✅ Signing workflow test completed successfully!");
}

// Gas usage analysis
async function analyzeGasUsage(deployments) {
  console.log("\n⛽ Analyzing gas usage...");
  
  const factory = await ethers.getContractAt("DocumentSignerFactory", deployments.factory.address);
  const [user1, user2] = await ethers.getSigners();
  
  // Test contract creation gas
  const documentHash = ethers.keccak256(ethers.toUtf8Bytes("Gas analysis test"));
  const ipfsCid = "QmGasTestCID";
  const requiredSigners = [user1.address, user2.address];
  
  const createGas = await factory.connect(user1).createSigningContract.estimateGas(
    documentHash,
    ipfsCid,
    requiredSigners,
    false,
    "Gas Test",
    "Gas analysis test"
  );
  
  console.log(`📊 Gas estimates:`);
  console.log(`   Contract creation: ${createGas.toString()}`);
  
  // Create actual contract for signing gas test
  const tx = await factory.connect(user1).createSigningContract(
    documentHash,
    ipfsCid,
    requiredSigners,
    false,
    "Gas Test",
    "Gas analysis test"
  );
  
  const receipt = await tx.wait();
  const event = receipt.logs.find(log => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === "ContractCreated";
    } catch {
      return false;
    }
  });
  
  const parsedEvent = factory.interface.parseLog(event);
  const contractAddress = parsedEvent.args.contractAddress;
  const signingContract = await ethers.getContractAt("EnhancedDocumentSigner", contractAddress);
  
  // Test signing gas
  const signGas = await signingContract.connect(user1).signDocument.estimateGas("Gas test signature");
  
  console.log(`   Document signing: ${signGas.toString()}`);
  console.log(`   Total for 2-party signing: ${(createGas + signGas * 2n).toString()}`);
}

// Run tests if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  main,
  testFactoryContract,
  testSigningWorkflow,
  analyzeGasUsage
};
const { ethers, network, run } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log(`\n🚀 Deploying contracts to ${network.name}...`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying with account: ${deployer.address}`);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance === 0n) {
    throw new Error("❌ Deployer account has no ETH balance");
  }

  const deployments = {};
  const networkName = network.name;

  try {
    // Deploy DocumentSignerFactory
    console.log("\n📦 Deploying DocumentSignerFactory...");
    const DocumentSignerFactory = await ethers.getContractFactory("DocumentSignerFactory");
    
    const estimatedGas = await DocumentSignerFactory.getDeployTransaction().estimateGas();
    console.log(`⛽ Estimated gas for factory deployment: ${estimatedGas.toString()}`);
    
    const factory = await DocumentSignerFactory.deploy();
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    console.log(`✅ DocumentSignerFactory deployed to: ${factoryAddress}`);
    
    deployments.factory = {
      address: factoryAddress,
      contract: "DocumentSignerFactory",
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      network: networkName,
      gasUsed: (await ethers.provider.getTransactionReceipt(factory.deploymentTransaction().hash)).gasUsed.toString()
    };

    // Test factory deployment
    console.log("🧪 Testing factory deployment...");
    const totalContracts = await factory.totalContracts();
    console.log(`📊 Initial total contracts: ${totalContracts}`);

    // Save deployment information
    await saveDeploymentInfo(deployments, networkName);
    
    // Update environment files
    await updateEnvironmentFiles(deployments, networkName);
    
    // Verify contracts on Etherscan (if not localhost)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      await verifyContracts(deployments);
    }

    // Generate ABI files for frontend
    await generateABIFiles();

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log(`Network: ${networkName}`);
    console.log(`Factory Address: ${factoryAddress}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Gas Used: ${deployments.factory.gasUsed}`);
    
    // Instructions for next steps
    console.log("\n📝 Next Steps:");
    console.log("1. Update your .env file with the new contract addresses");
    console.log("2. Copy the generated ABI files to your frontend");
    console.log("3. Test the deployment with the provided test script");
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("4. Verify contracts on Etherscan (automated)");
    }

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

async function saveDeploymentInfo(deployments, networkName) {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
  
  // Load existing deployments if file exists
  let existingDeployments = {};
  if (fs.existsSync(deploymentFile)) {
    existingDeployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  }

  // Merge with new deployments
  const updatedDeployments = {
    ...existingDeployments,
    ...deployments,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(updatedDeployments, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentFile}`);
}

async function updateEnvironmentFiles(deployments, networkName) {
  const envFiles = [
    path.join(__dirname, '..', '.env.example'),
    path.join(__dirname, '..', 'frontend', '.env.example')
  ];

  const networkSuffix = networkName.toUpperCase();
  const factoryKey = `FACTORY_ADDRESS_${networkSuffix === 'LOCALHOST' ? 'DEV' : networkSuffix}`;
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      let content = fs.readFileSync(envFile, 'utf8');
      
      // Update factory address
      const factoryRegex = new RegExp(`^${factoryKey}=.*$`, 'm');
      if (factoryRegex.test(content)) {
        content = content.replace(factoryRegex, `${factoryKey}=${deployments.factory.address}`);
      } else {
        content += `\n${factoryKey}=${deployments.factory.address}`;
      }
      
      fs.writeFileSync(envFile, content);
      console.log(`📝 Updated ${envFile} with new addresses`);
    }
  }
}

async function verifyContracts(deployments) {
  console.log("\n🔍 Verifying contracts on Etherscan...");
  
  try {
    // Verify DocumentSignerFactory
    await run("verify:verify", {
      address: deployments.factory.address,
      constructorArguments: []
    });
    console.log(`✅ DocumentSignerFactory verified`);
    
  } catch (error) {
    console.log(`⚠️  Verification failed: ${error.message}`);
    console.log("You can verify manually later using:");
    console.log(`npx hardhat verify --network ${network.name} ${deployments.factory.address}`);
  }
}

async function generateABIFiles() {
  console.log("\n📄 Generating ABI files...");
  
  const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
  const abiDir = path.join(__dirname, '..', 'frontend', 'src', 'abis');
  
  // Create ABI directory if it doesn't exist
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const contracts = [
    {
      name: 'DocumentSignerFactory',
      file: 'DocumentSignerFactory.sol/DocumentSignerFactory.json'
    },
    {
      name: 'EnhancedDocumentSigner',
      file: 'EnhancedDocumentSigner.sol/EnhancedDocumentSigner.json'
    }
  ];

  for (const contract of contracts) {
    const artifactPath = path.join(artifactsDir, contract.file);
    const abiPath = path.join(abiDir, `${contract.name}.json`);
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      console.log(`📄 Generated ABI for ${contract.name}`);
    }
  }
}

// Test deployment function
async function testDeployment() {
  console.log("\n🧪 Testing deployment...");
  
  const networkName = network.name;
  const deploymentFile = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.log("❌ No deployment file found");
    return;
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  // Test factory contract
  const factory = await ethers.getContractAt("DocumentSignerFactory", deployments.factory.address);
  
  try {
    const totalContracts = await factory.totalContracts();
    const activeContracts = await factory.activeContracts();
    const owner = await factory.owner();
    
    console.log("✅ Factory contract is working:");
    console.log(`   Total contracts: ${totalContracts}`);
    console.log(`   Active contracts: ${activeContracts}`);
    console.log(`   Owner: ${owner}`);
    
  } catch (error) {
    console.log("❌ Factory contract test failed:", error.message);
  }
}

// Export functions for use in other scripts
module.exports = {
  main,
  testDeployment,
  saveDeploymentInfo,
  updateEnvironmentFiles,
  verifyContracts,
  generateABIFiles
};

// Run deployment if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
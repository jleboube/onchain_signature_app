const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployFactory,
  createSigningContractViaFactory,
  getSigners,
  TEST_DOCUMENT_HASH,
  TEST_IPFS_CID,
  TEST_TITLE,
  TEST_DESCRIPTION,
  generateRandomHash,
  generateRandomIPFSCid
} = require("./helpers/testHelpers");

describe("DocumentSignerFactory", function () {
  let factory;
  let owner, user1, user2, user3, signer1, signer2;

  beforeEach(async function () {
    [owner, user1, user2, user3, signer1, signer2] = await getSigners(6);
    factory = await deployFactory();
  });

  describe("Factory Deployment", function () {
    it("Should deploy factory with correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
      expect(await factory.totalContracts()).to.equal(0);
      expect(await factory.activeContracts()).to.equal(0);
    });

    it("Should start unpaused", async function () {
      expect(await factory.paused()).to.be.false;
    });
  });

  describe("Contract Creation", function () {
    it("Should create signing contract successfully", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      await expect(factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.emit(factory, "ContractCreated");

      expect(await factory.totalContracts()).to.equal(1);
      expect(await factory.activeContracts()).to.equal(1);
    });

    it("Should store contract information correctly", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      const tx = await factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
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

      const contractInfo = await factory.getContractInfo(contractAddress);
      expect(contractInfo.contractAddress).to.equal(contractAddress);
      expect(contractInfo.documentHash).to.equal(TEST_DOCUMENT_HASH);
      expect(contractInfo.ipfsCid).to.equal(TEST_IPFS_CID);
      expect(contractInfo.initiator).to.equal(user1.address);
      expect(contractInfo.isActive).to.be.true;
      expect(contractInfo.title).to.equal(TEST_TITLE);
    });

    it("Should track contracts by initiator", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      // User1 creates 2 contracts
      await factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
      
      const hash2 = generateRandomHash();
      await factory.connect(user1).createSigningContract(
        hash2,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        "Document 2",
        TEST_DESCRIPTION
      );

      // User2 creates 1 contract
      const hash3 = generateRandomHash();
      await factory.connect(user2).createSigningContract(
        hash3,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        "Document 3",
        TEST_DESCRIPTION
      );

      const user1Contracts = await factory.getContractsByInitiator(user1.address);
      const user2Contracts = await factory.getContractsByInitiator(user2.address);

      expect(user1Contracts.length).to.equal(2);
      expect(user2Contracts.length).to.equal(1);
    });

    it("Should track contracts by document hash", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      // Create 2 contracts with same document hash
      await factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
      
      await factory.connect(user2).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );

      const contractsByHash = await factory.getContractsByDocumentHash(TEST_DOCUMENT_HASH);
      expect(contractsByHash.length).to.equal(2);
    });

    it("Should revert with invalid parameters", async function () {
      const requiredSigners = [signer1.address, signer2.address];

      // Invalid document hash
      await expect(factory.connect(user1).createSigningContract(
        ethers.ZeroHash,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWithCustomError(factory, "InvalidParameters");

      // Empty IPFS CID
      await expect(factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        "",
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWithCustomError(factory, "InvalidParameters");

      // Empty signers array
      await expect(factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        [],
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWithCustomError(factory, "InvalidParameters");
    });

    it("Should not create contracts when paused", async function () {
      await factory.pause();
      const requiredSigners = [signer1.address, signer2.address];

      await expect(factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Contract Management", function () {
    let contractAddress;

    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      const contract = await createSigningContractViaFactory(
        factory,
        user1,
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
      contractAddress = await contract.getAddress();
    });

    it("Should allow initiator to deactivate contract", async function () {
      await expect(factory.connect(user1).deactivateContract(contractAddress))
        .to.emit(factory, "ContractDeactivated")
        .withArgs(contractAddress, user1.address);

      const contractInfo = await factory.getContractInfo(contractAddress);
      expect(contractInfo.isActive).to.be.false;
      expect(await factory.activeContracts()).to.equal(0);
    });

    it("Should allow owner to deactivate contract", async function () {
      await expect(factory.connect(owner).deactivateContract(contractAddress))
        .to.emit(factory, "ContractDeactivated")
        .withArgs(contractAddress, owner.address);

      const contractInfo = await factory.getContractInfo(contractAddress);
      expect(contractInfo.isActive).to.be.false;
    });

    it("Should prevent unauthorized deactivation", async function () {
      await expect(factory.connect(user2).deactivateContract(contractAddress))
        .to.be.revertedWithCustomError(factory, "UnauthorizedAccess");
    });

    it("Should revert when deactivating non-existent contract", async function () {
      const fakeAddress = ethers.Wallet.createRandom().address;
      
      await expect(factory.connect(user1).deactivateContract(fakeAddress))
        .to.be.revertedWithCustomError(factory, "ContractNotFound")
        .withArgs(fakeAddress);
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      // Create multiple contracts
      await factory.connect(user1).createSigningContract(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        "Document 1",
        TEST_DESCRIPTION
      );
      
      await factory.connect(user1).createSigningContract(
        generateRandomHash(),
        TEST_IPFS_CID,
        requiredSigners,
        false,
        "Document 2",
        TEST_DESCRIPTION
      );
      
      await factory.connect(user2).createSigningContract(
        generateRandomHash(),
        TEST_IPFS_CID,
        requiredSigners,
        false,
        "Document 3",
        TEST_DESCRIPTION
      );
    });

    it("Should return all contracts with pagination", async function () {
      const [contracts, total] = await factory.getAllContracts(0, 10);
      expect(contracts.length).to.equal(3);
      expect(total).to.equal(3);

      // Test pagination
      const [firstTwo, total2] = await factory.getAllContracts(0, 2);
      expect(firstTwo.length).to.equal(2);
      expect(total2).to.equal(3);

      const [lastOne, total3] = await factory.getAllContracts(2, 2);
      expect(lastOne.length).to.equal(1);
      expect(total3).to.equal(3);
    });

    it("Should return active contracts only", async function () {
      // Deactivate one contract
      const allContracts = await factory.getContractsByInitiator(user1.address);
      await factory.connect(user1).deactivateContract(allContracts[0]);

      const [activeContracts, total] = await factory.getActiveContracts(0, 10);
      expect(activeContracts.length).to.equal(2);
      expect(total).to.equal(2);
    });

    it("Should return contracts by initiator and status", async function () {
      const user1Contracts = await factory.getContractsByInitiator(user1.address);
      
      // Deactivate one of user1's contracts
      await factory.connect(user1).deactivateContract(user1Contracts[0]);

      const activeUser1Contracts = await factory.getContractsByInitiatorAndStatus(user1.address, true);
      const allUser1Contracts = await factory.getContractsByInitiatorAndStatus(user1.address, false);

      expect(activeUser1Contracts.length).to.equal(1);
      expect(allUser1Contracts.length).to.equal(2);
    });

    it("Should return factory statistics", async function () {
      const [total, active, inactive] = await factory.getFactoryStats();
      expect(total).to.equal(3);
      expect(active).to.equal(3);
      expect(inactive).to.equal(0);

      // Deactivate one contract
      const allContracts = await factory.getContractsByInitiator(user1.address);
      await factory.connect(user1).deactivateContract(allContracts[0]);

      const [total2, active2, inactive2] = await factory.getFactoryStats();
      expect(total2).to.equal(3);
      expect(active2).to.equal(2);
      expect(inactive2).to.equal(1);
    });

    it("Should validate contract addresses", async function () {
      const user1Contracts = await factory.getContractsByInitiator(user1.address);
      expect(await factory.isContractValid(user1Contracts[0])).to.be.true;

      const fakeAddress = ethers.Wallet.createRandom().address;
      expect(await factory.isContractValid(fakeAddress)).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to pause", async function () {
      await factory.pause();
      expect(await factory.paused()).to.be.true;

      await expect(factory.connect(user1).pause())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow only owner to unpause", async function () {
      await factory.pause();
      await factory.unpause();
      expect(await factory.paused()).to.be.false;

      await expect(factory.connect(user1).unpause())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Gas Optimization", function () {
    it("Should use reasonable gas for contract creation", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      const estimatedGas = await factory.connect(user1).createSigningContract.estimateGas(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
      
      expect(estimatedGas).to.be.lessThan(4000000); // Should be less than 4M gas
    });

    it("Should handle batch operations efficiently", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      
      // Create multiple contracts and measure gas usage
      const gasUsages = [];
      
      for (let i = 0; i < 5; i++) {
        const hash = generateRandomHash();
        const estimatedGas = await factory.connect(user1).createSigningContract.estimateGas(
          hash,
          TEST_IPFS_CID,
          requiredSigners,
          false,
          `Document ${i}`,
          TEST_DESCRIPTION
        );
        gasUsages.push(estimatedGas);
      }
      
      // Gas usage should remain relatively stable
      const maxGas = Math.max(...gasUsages);
      const minGas = Math.min(...gasUsages);
      const gasVariation = (maxGas - minGas) / minGas;
      
      expect(gasVariation).to.be.lessThan(0.1); // Less than 10% variation
    });
  });
});
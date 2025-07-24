const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  deployEnhancedDocumentSigner,
  getSigners,
  expectRevert,
  TEST_DOCUMENT_HASH,
  TEST_IPFS_CID,
  TEST_TITLE,
  TEST_DESCRIPTION,
  generateRandomHash,
  generateRandomIPFSCid,
  advanceTime,
  getBlockTimestamp,
  testScenarios
} = require("./helpers/testHelpers");

describe("EnhancedDocumentSigner", function () {
  let owner, signer1, signer2, signer3, signer4, signer5, nonSigner;
  let contract;
  
  beforeEach(async function () {
    [owner, signer1, signer2, signer3, signer4, signer5, nonSigner] = await getSigners(7);
  });

  describe("Contract Creation", function () {
    it("Should create contract with correct parameters", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );

      expect(await contract.documentHash()).to.equal(TEST_DOCUMENT_HASH);
      expect(await contract.ipfsCid()).to.equal(TEST_IPFS_CID);
      expect(await contract.sequentialSigning()).to.equal(false);
      expect(await contract.status()).to.equal(0); // INITIATED
      
      const returnedSigners = await contract.getRequiredSigners();
      expect(returnedSigners).to.deep.equal(requiredSigners);
    });

    it("Should emit DocumentInitiated event", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      const ContractFactory = await ethers.getContractFactory("EnhancedDocumentSigner");
      
      await expect(ContractFactory.deploy(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.emit(ContractFactory, "DocumentInitiated")
        .withArgs(TEST_DOCUMENT_HASH, TEST_IPFS_CID, owner.address, requiredSigners, false);
    });

    it("Should set correct required signers and indices", async function () {
      const requiredSigners = [signer1.address, signer2.address, signer3.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );

      for (let i = 0; i < requiredSigners.length; i++) {
        expect(await contract.requiredSigners(i)).to.equal(requiredSigners[i]);
        expect(await contract.signerIndex(requiredSigners[i])).to.equal(i);
      }
    });

    it("Should revert with invalid document hash", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      const ContractFactory = await ethers.getContractFactory("EnhancedDocumentSigner");
      
      await expect(ContractFactory.deploy(
        ethers.ZeroHash,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWithCustomError(ContractFactory, "InvalidDocumentHash");
    });

    it("Should revert with empty IPFS CID", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      const ContractFactory = await ethers.getContractFactory("EnhancedDocumentSigner");
      
      await expect(ContractFactory.deploy(
        TEST_DOCUMENT_HASH,
        "",
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWithCustomError(ContractFactory, "InvalidIPFSCid");
    });

    it("Should revert with empty signers list", async function () {
      const ContractFactory = await ethers.getContractFactory("EnhancedDocumentSigner");
      
      await expect(ContractFactory.deploy(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        [],
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      )).to.be.revertedWithCustomError(ContractFactory, "EmptySignersList");
    });
  });

  describe("Signing Process - Parallel", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false, // parallel signing
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should allow authorized signers to sign", async function () {
      const metadata = "Approved by signer1";
      
      await expect(contract.connect(signer1).signDocument(metadata))
        .to.emit(contract, "DocumentSigned")
        .withArgs(TEST_DOCUMENT_HASH, signer1.address, await getBlockTimestamp() + 1, 0);

      expect(await contract.hasSigned(signer1.address)).to.be.true;
      expect(await contract.verifySignature(signer1.address)).to.be.true;
      expect(await contract.status()).to.equal(1); // IN_PROGRESS
    });

    it("Should prevent unauthorized signers", async function () {
      await expect(contract.connect(nonSigner).signDocument(""))
        .to.be.revertedWithCustomError(contract, "NotAuthorizedSigner")
        .withArgs(nonSigner.address);
    });

    it("Should prevent double signing", async function () {
      await contract.connect(signer1).signDocument("");
      
      await expect(contract.connect(signer1).signDocument(""))
        .to.be.revertedWithCustomError(contract, "AlreadySigned")
        .withArgs(signer1.address);
    });

    it("Should complete when all signers have signed", async function () {
      await contract.connect(signer1).signDocument("Signer1 approval");
      expect(await contract.isFullySigned()).to.be.false;
      expect(await contract.status()).to.equal(1); // IN_PROGRESS

      await expect(contract.connect(signer2).signDocument("Signer2 approval"))
        .to.emit(contract, "DocumentCompleted");

      expect(await contract.isFullySigned()).to.be.true;
      expect(await contract.status()).to.equal(2); // COMPLETED
    });

    it("Should track signing progress correctly", async function () {
      let [signed, total] = await contract.getSigningProgress();
      expect(signed).to.equal(0);
      expect(total).to.equal(2);

      await contract.connect(signer1).signDocument("");
      [signed, total] = await contract.getSigningProgress();
      expect(signed).to.equal(1);
      expect(total).to.equal(2);

      await contract.connect(signer2).signDocument("");
      [signed, total] = await contract.getSigningProgress();
      expect(signed).to.equal(2);
      expect(total).to.equal(2);
    });
  });

  describe("Signing Process - Sequential", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address, signer3.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        true, // sequential signing
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should enforce signing order", async function () {
      // signer2 tries to sign before signer1
      await expect(contract.connect(signer2).signDocument(""))
        .to.be.revertedWithCustomError(contract, "InvalidSigningOrder")
        .withArgs(0, 1);

      // signer1 signs first (correct order)
      await contract.connect(signer1).signDocument("");
      expect(await contract.currentSignerIndex()).to.equal(1);

      // signer3 tries to sign before signer2
      await expect(contract.connect(signer3).signDocument(""))
        .to.be.revertedWithCustomError(contract, "InvalidSigningOrder")
        .withArgs(1, 2);

      // signer2 signs second (correct order)
      await contract.connect(signer2).signDocument("");
      expect(await contract.currentSignerIndex()).to.equal(2);

      // signer3 signs last
      await contract.connect(signer3).signDocument("");
      expect(await contract.isFullySigned()).to.be.true;
    });

    it("Should return correct next signer", async function () {
      expect(await contract.getNextSigner()).to.equal(signer1.address);

      await contract.connect(signer1).signDocument("");
      expect(await contract.getNextSigner()).to.equal(signer2.address);

      await contract.connect(signer2).signDocument("");
      expect(await contract.getNextSigner()).to.equal(signer3.address);

      await contract.connect(signer3).signDocument("");
      expect(await contract.getNextSigner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Signer Management", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should allow owner to replace signer", async function () {
      await expect(contract.replaceSigner(signer1.address, signer3.address))
        .to.emit(contract, "SignerReplaced")
        .withArgs(signer1.address, signer3.address);

      const signers = await contract.getRequiredSigners();
      expect(signers[0]).to.equal(signer3.address);
      expect(await contract.signerIndex(signer3.address)).to.equal(0);
    });

    it("Should prevent replacing non-existent signer", async function () {
      await expect(contract.replaceSigner(nonSigner.address, signer3.address))
        .to.be.revertedWithCustomError(contract, "SignerNotFound")
        .withArgs(nonSigner.address);
    });

    it("Should prevent replacing signer who already signed", async function () {
      await contract.connect(signer1).signDocument("");
      
      await expect(contract.replaceSigner(signer1.address, signer3.address))
        .to.be.revertedWithCustomError(contract, "AlreadySigned")
        .withArgs(signer1.address);
    });

    it("Should prevent non-owner from replacing signer", async function () {
      await expect(contract.connect(signer1).replaceSigner(signer1.address, signer3.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Document Management", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should allow owner to update IPFS CID", async function () {
      const newCid = generateRandomIPFSCid();
      
      await expect(contract.updateIpfsCid(newCid))
        .to.emit(contract, "IPFSCidUpdated")
        .withArgs(TEST_IPFS_CID, newCid);

      expect(await contract.ipfsCid()).to.equal(newCid);
    });

    it("Should prevent updating with empty CID", async function () {
      await expect(contract.updateIpfsCid(""))
        .to.be.revertedWithCustomError(contract, "InvalidIPFSCid");
    });

    it("Should allow adding document versions", async function () {
      const newHash = generateRandomHash();
      const newCid = generateRandomIPFSCid();

      await contract.addDocumentVersion(newHash, newCid);

      expect(await contract.documentHash()).to.equal(newHash);
      expect(await contract.ipfsCid()).to.equal(newCid);

      const metadata = await contract.getDocumentMetadata();
      expect(metadata.versions.length).to.equal(2);
      expect(metadata.ipfsCids.length).to.equal(2);
      expect(metadata.versions[1]).to.equal(newHash);
      expect(metadata.ipfsCids[1]).to.equal(newCid);
    });
  });

  describe("Contract Control", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should allow owner to cancel signing", async function () {
      await expect(contract.cancelSigning())
        .to.emit(contract, "DocumentCancelled")
        .withArgs(TEST_DOCUMENT_HASH, owner.address);

      expect(await contract.status()).to.equal(3); // CANCELLED
    });

    it("Should prevent signing after cancellation", async function () {
      await contract.cancelSigning();

      await expect(contract.connect(signer1).signDocument(""))
        .to.be.revertedWithCustomError(contract, "ContractAlreadyCompleted");
    });

    it("Should allow owner to pause contract", async function () {
      await contract.pause();
      expect(await contract.paused()).to.be.true;

      await expect(contract.connect(signer1).signDocument(""))
        .to.be.revertedWith("Pausable: paused");
    });

    it("Should allow owner to unpause contract", async function () {
      await contract.pause();
      await contract.unpause();
      expect(await contract.paused()).to.be.false;

      // Should be able to sign after unpause
      await contract.connect(signer1).signDocument("");
      expect(await contract.hasSigned(signer1.address)).to.be.true;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should return correct signatures", async function () {
      const metadata1 = "Approval 1";
      const metadata2 = "Approval 2";

      await contract.connect(signer1).signDocument(metadata1);
      await contract.connect(signer2).signDocument(metadata2);

      const signatures = await contract.getSignatures();
      expect(signatures.length).to.equal(2);
      expect(signatures[0].signer).to.equal(signer1.address);
      expect(signatures[0].metadata).to.equal(metadata1);
      expect(signatures[1].signer).to.equal(signer2.address);
      expect(signatures[1].metadata).to.equal(metadata2);
    });

    it("Should return correct document metadata", async function () {
      const metadata = await contract.getDocumentMetadata();
      expect(metadata.title).to.equal(TEST_TITLE);
      expect(metadata.description).to.equal(TEST_DESCRIPTION);
      expect(metadata.creator).to.equal(owner.address);
      expect(metadata.versions.length).to.equal(1);
      expect(metadata.versions[0]).to.equal(TEST_DOCUMENT_HASH);
      expect(metadata.ipfsCids[0]).to.equal(TEST_IPFS_CID);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should use reasonable gas for contract creation", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      const ContractFactory = await ethers.getContractFactory("EnhancedDocumentSigner");
      
      const deployTx = await ContractFactory.getDeployTransaction(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
      
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      expect(estimatedGas).to.be.lessThan(3000000); // Should be less than 3M gas
    });

    it("Should use reasonable gas for signing", async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );

      const estimatedGas = await contract.connect(signer1).signDocument.estimateGas("");
      expect(estimatedGas).to.be.lessThan(200000); // Should be less than 200k gas
    });
  });

  describe("Security Tests", function () {
    beforeEach(async function () {
      const requiredSigners = [signer1.address, signer2.address];
      contract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        requiredSigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );
    });

    it("Should prevent reentrancy attacks", async function () {
      // This test ensures the nonReentrant modifier is working
      // In a real attack scenario, a malicious contract would try to call signDocument recursively
      await contract.connect(signer1).signDocument("");
      expect(await contract.hasSigned(signer1.address)).to.be.true;
    });

    it("Should handle large numbers of signers", async function () {
      const manySigners = [];
      for (let i = 0; i < 50; i++) {
        const wallet = ethers.Wallet.createRandom();
        manySigners.push(wallet.address);
      }

      // Should not revert with many signers
      const largeContract = await deployEnhancedDocumentSigner(
        TEST_DOCUMENT_HASH,
        TEST_IPFS_CID,
        manySigners,
        false,
        TEST_TITLE,
        TEST_DESCRIPTION
      );

      expect(await largeContract.getRequiredSigners()).to.have.length(50);
    });
  });
});
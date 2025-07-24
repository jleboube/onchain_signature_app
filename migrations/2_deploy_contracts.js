const DocumentSigner = artifacts.require("DocumentSigner");

module.exports = function(deployer) {
  deployer.deploy(DocumentSigner);
};
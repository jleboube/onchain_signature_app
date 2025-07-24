require('dotenv').config();

const configs = {
  development: {
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    ipfsGateway: 'https://ipfs.io/ipfs/',
    nftStorageKey: process.env.NFT_STORAGE_API_KEY,
    contractAddresses: {
      factory: process.env.FACTORY_ADDRESS_DEV,
      registry: process.env.REGISTRY_ADDRESS_DEV
    },
    gasPrice: '20000000000', // 20 gwei
    gasLimit: 3000000
  },
  goerli: {
    rpcUrl: process.env.GOERLI_RPC_URL,
    chainId: 5,
    ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
    nftStorageKey: process.env.NFT_STORAGE_API_KEY,
    contractAddresses: {
      factory: process.env.FACTORY_ADDRESS_GOERLI,
      registry: process.env.REGISTRY_ADDRESS_GOERLI
    },
    gasPrice: '20000000000',
    gasLimit: 3000000
  },
  mainnet: {
    rpcUrl: process.env.MAINNET_RPC_URL,
    chainId: 1,
    ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
    nftStorageKey: process.env.NFT_STORAGE_API_KEY,
    contractAddresses: {
      factory: process.env.FACTORY_ADDRESS_MAINNET,
      registry: process.env.REGISTRY_ADDRESS_MAINNET
    },
    gasPrice: '30000000000', // 30 gwei for mainnet
    gasLimit: 3000000
  }
};

function getConfig(environment = 'development') {
  const config = configs[environment];
  if (!config) {
    throw new Error(`Configuration for environment '${environment}' not found`);
  }
  
  // Validate required configuration
  if (!config.nftStorageKey && environment !== 'development') {
    console.warn(`Warning: NFT_STORAGE_API_KEY not set for ${environment} environment`);
  }
  
  if (!config.rpcUrl && environment !== 'development') {
    throw new Error(`RPC URL not configured for ${environment} environment`);
  }
  
  return config;
}

module.exports = {
  getConfig,
  configs
};
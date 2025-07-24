// Environment configuration for React frontend
const configs = {
  development: {
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    chainName: 'Localhost',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrl: null,
    ipfsGateway: 'https://ipfs.io/ipfs/',
    nftStorageKey: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID,
    contractAddresses: {
      factory: process.env.REACT_APP_FACTORY_ADDRESS_DEV,
      registry: process.env.REACT_APP_REGISTRY_ADDRESS_DEV
    },
    gasPrice: '20000000000', // 20 gwei
    gasLimit: 3000000,
    enableLogging: true
  },
  goerli: {
    rpcUrl: `https://goerli.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`,
    chainId: 5,
    chainName: 'Goerli Testnet',
    nativeCurrency: {
      name: 'Goerli Ether',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrl: 'https://goerli.etherscan.io',
    ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
    nftStorageKey: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID,
    contractAddresses: {
      factory: process.env.REACT_APP_FACTORY_ADDRESS_GOERLI,
      registry: process.env.REACT_APP_REGISTRY_ADDRESS_GOERLI
    },
    gasPrice: '20000000000',
    gasLimit: 3000000,
    enableLogging: false
  },
  sepolia: {
    rpcUrl: `https://sepolia.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`,
    chainId: 11155111,
    chainName: 'Sepolia Testnet',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
    nftStorageKey: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID,
    contractAddresses: {
      factory: process.env.REACT_APP_FACTORY_ADDRESS_SEPOLIA,
      registry: process.env.REACT_APP_REGISTRY_ADDRESS_SEPOLIA
    },
    gasPrice: '20000000000',
    gasLimit: 3000000,
    enableLogging: false
  },
  mainnet: {
    rpcUrl: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`,
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrl: 'https://etherscan.io',
    ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
    nftStorageKey: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID,
    contractAddresses: {
      factory: process.env.REACT_APP_FACTORY_ADDRESS_MAINNET,
      registry: process.env.REACT_APP_REGISTRY_ADDRESS_MAINNET
    },
    gasPrice: '30000000000', // 30 gwei for mainnet
    gasLimit: 3000000,
    enableLogging: false
  }
};

function getConfig(environment = process.env.REACT_APP_ENVIRONMENT || 'development') {
  const config = configs[environment];
  
  if (!config) {
    console.error(`Configuration for environment '${environment}' not found. Falling back to development.`);
    return configs.development;
  }
  
  // Validate required configuration
  const missingKeys = [];
  
  if (!config.nftStorageKey && environment !== 'development') {
    missingKeys.push('REACT_APP_NFT_STORAGE_API_KEY');
  }
  
  if (!config.walletConnectProjectId) {
    missingKeys.push('REACT_APP_WALLETCONNECT_PROJECT_ID');
  }
  
  if (environment !== 'development' && !process.env.REACT_APP_INFURA_PROJECT_ID) {
    missingKeys.push('REACT_APP_INFURA_PROJECT_ID');
  }
  
  if (missingKeys.length > 0) {
    console.warn(`Warning: Missing environment variables for ${environment}:`, missingKeys);
    console.warn('Please check your .env file and ensure all required variables are set.');
  }
  
  // Log configuration in development
  if (config.enableLogging) {
    console.log('Current configuration:', {
      environment,
      chainId: config.chainId,
      chainName: config.chainName,
      rpcUrl: config.rpcUrl,
      contractAddresses: config.contractAddresses,
      hasNftStorageKey: !!config.nftStorageKey,
      hasWalletConnectId: !!config.walletConnectProjectId
    });
  }
  
  return config;
}

// Get current configuration
const config = getConfig();

// Export configuration and utilities
export default config;

export {
  getConfig,
  configs
};

// Network configuration for wallet connection
export const networkConfig = {
  [config.chainId]: {
    chainId: `0x${config.chainId.toString(16)}`,
    chainName: config.chainName,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: config.blockExplorerUrl ? [config.blockExplorerUrl] : []
  }
};

// Contract ABIs (to be populated after compilation)
export const contractABIs = {
  factory: [], // Will be populated from compiled artifacts
  documentSigner: [] // Will be populated from compiled artifacts
};

// Validation utilities
export const validateConfig = () => {
  const errors = [];
  
  if (!config.contractAddresses.factory) {
    errors.push('Factory contract address not configured');
  }
  
  if (!config.nftStorageKey && process.env.NODE_ENV === 'production') {
    errors.push('NFT Storage API key not configured for production');
  }
  
  if (!config.walletConnectProjectId) {
    errors.push('WalletConnect project ID not configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Environment detection utilities
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isTestnet = () => ['goerli', 'sepolia'].includes(process.env.REACT_APP_ENVIRONMENT);
export const isMainnet = () => process.env.REACT_APP_ENVIRONMENT === 'mainnet';
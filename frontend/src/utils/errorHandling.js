// Error handling utilities for the blockchain document signer application

// Error types
export const ErrorTypes = {
  WALLET_CONNECTION: 'WALLET_CONNECTION',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  IPFS_ERROR: 'IPFS_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
};

// Custom error classes
export class WalletConnectionError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'WalletConnectionError';
    this.type = ErrorTypes.WALLET_CONNECTION;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message, chainId = null) {
    super(message);
    this.name = 'NetworkError';
    this.type = ErrorTypes.NETWORK_ERROR;
    this.chainId = chainId;
  }
}

export class ContractError extends Error {
  constructor(message, contractAddress = null, method = null) {
    super(message);
    this.name = 'ContractError';
    this.type = ErrorTypes.CONTRACT_ERROR;
    this.contractAddress = contractAddress;
    this.method = method;
  }
}

export class IPFSError extends Error {
  constructor(message, operation = null) {
    super(message);
    this.name = 'IPFSError';
    this.type = ErrorTypes.IPFS_ERROR;
    this.operation = operation;
  }
}

export class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.type = ErrorTypes.VALIDATION_ERROR;
    this.field = field;
    this.value = value;
  }
}

export class TransactionError extends Error {
  constructor(message, txHash = null, reason = null) {
    super(message);
    this.name = 'TransactionError';
    this.type = ErrorTypes.TRANSACTION_ERROR;
    this.txHash = txHash;
    this.reason = reason;
  }
}

// Error message mappings for user-friendly display
const errorMessages = {
  // Wallet connection errors
  'MetaMask not installed': 'Please install MetaMask to connect your wallet.',
  'User rejected connection': 'Wallet connection was cancelled. Please try again.',
  'Already processing eth_requestAccounts': 'Wallet connection is already in progress. Please wait.',
  'User rejected the request': 'Transaction was cancelled by user.',
  
  // Network errors
  'wrong network': 'Please switch to the correct network in your wallet.',
  'network changed': 'Network was changed. Please refresh the page.',
  'insufficient funds': 'Insufficient funds to complete this transaction.',
  
  // Contract errors
  'execution reverted': 'Transaction failed. Please check the requirements and try again.',
  'gas required exceeds allowance': 'Transaction requires more gas. Please increase gas limit.',
  'nonce too low': 'Transaction nonce is too low. Please try again.',
  'replacement transaction underpriced': 'Replacement transaction is underpriced. Please increase gas price.',
  
  // IPFS errors
  'upload failed': 'Failed to upload document to IPFS. Please try again.',
  'retrieval failed': 'Failed to retrieve document from IPFS. Please check your connection.',
  'invalid cid': 'Invalid IPFS content identifier.',
  
  // Validation errors
  'invalid address': 'Please enter a valid Ethereum address.',
  'invalid file': 'Please select a valid file.',
  'file too large': 'File size is too large. Please select a smaller file.',
  'unsupported file type': 'File type is not supported.',
  
  // Permission errors
  'not authorized': 'You are not authorized to perform this action.',
  'already signed': 'You have already signed this document.',
  'not required signer': 'You are not a required signer for this document.'
};

// Get user-friendly error message
export const getUserFriendlyMessage = (error) => {
  if (!error) return 'An unknown error occurred.';
  
  const message = error.message || error.toString();
  const lowerMessage = message.toLowerCase();
  
  // Check for specific error patterns
  for (const [pattern, friendlyMessage] of Object.entries(errorMessages)) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return friendlyMessage;
    }
  }
  
  // Handle specific error types
  switch (error.type) {
    case ErrorTypes.WALLET_CONNECTION:
      return 'Failed to connect to wallet. Please ensure your wallet is installed and unlocked.';
    
    case ErrorTypes.NETWORK_ERROR:
      return 'Network connection error. Please check your internet connection and try again.';
    
    case ErrorTypes.CONTRACT_ERROR:
      return 'Smart contract interaction failed. Please try again or contact support.';
    
    case ErrorTypes.IPFS_ERROR:
      return 'Document storage error. Please try uploading your document again.';
    
    case ErrorTypes.VALIDATION_ERROR:
      return error.message || 'Please check your input and try again.';
    
    case ErrorTypes.TRANSACTION_ERROR:
      return 'Transaction failed. Please check your wallet and try again.';
    
    case ErrorTypes.PERMISSION_ERROR:
      return 'You do not have permission to perform this action.';
    
    case ErrorTypes.CONFIGURATION_ERROR:
      return 'Configuration error. Please contact support.';
    
    default:
      return message || 'An unexpected error occurred. Please try again.';
  }
};

// Get error suggestions for recovery
export const getErrorSuggestions = (error) => {
  if (!error) return [];
  
  const message = error.message || error.toString();
  const lowerMessage = message.toLowerCase();
  
  const suggestions = [];
  
  // Wallet-related suggestions
  if (lowerMessage.includes('metamask') || lowerMessage.includes('wallet')) {
    suggestions.push('Make sure MetaMask is installed and unlocked');
    suggestions.push('Try refreshing the page and connecting again');
    suggestions.push('Check if you have sufficient ETH for gas fees');
  }
  
  // Network-related suggestions
  if (lowerMessage.includes('network') || lowerMessage.includes('chain')) {
    suggestions.push('Switch to the correct network in your wallet');
    suggestions.push('Check your internet connection');
    suggestions.push('Try again in a few moments');
  }
  
  // Transaction-related suggestions
  if (lowerMessage.includes('gas') || lowerMessage.includes('transaction')) {
    suggestions.push('Increase gas limit or gas price');
    suggestions.push('Wait for network congestion to decrease');
    suggestions.push('Check your wallet balance');
  }
  
  // IPFS-related suggestions
  if (lowerMessage.includes('ipfs') || lowerMessage.includes('upload')) {
    suggestions.push('Check your internet connection');
    suggestions.push('Try uploading a smaller file');
    suggestions.push('Verify your IPFS configuration');
  }
  
  // Generic suggestions if no specific ones apply
  if (suggestions.length === 0) {
    suggestions.push('Try refreshing the page');
    suggestions.push('Check your internet connection');
    suggestions.push('Contact support if the problem persists');
  }
  
  return suggestions;
};

// Log error for debugging and monitoring
export const logError = (error, context = {}) => {
  const errorData = {
    message: error.message || error.toString(),
    type: error.type || 'UNKNOWN',
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    context
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorData);
  }
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to error tracking service
    // errorTrackingService.captureException(errorData);
  }
  
  return errorData;
};

// Retry mechanism for failed operations
export const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};

// Timeout wrapper for operations
export const withTimeout = (operation, timeoutMs = 30000) => {
  return Promise.race([
    operation(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
};

// Safe async operation wrapper
export const safeAsync = async (operation, fallback = null) => {
  try {
    return await operation();
  } catch (error) {
    logError(error, { operation: operation.name });
    return fallback;
  }
};

// Error boundary helper for React components
export const withErrorBoundary = (Component, fallback = null) => {
  return (props) => {
    try {
      return <Component {...props} />;
    } catch (error) {
      logError(error, { component: Component.name });
      return fallback || <div>Something went wrong</div>;
    }
  };
};
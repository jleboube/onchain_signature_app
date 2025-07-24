import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import config, { validateConfig } from './config';
import ipfsService from './services/ipfsService';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import LoadingSpinner, { TransactionSpinner, WalletSpinner } from './components/LoadingSpinner/LoadingSpinner';
import { 
  WalletConnectionError, 
  ContractError, 
  ValidationError,
  getUserFriendlyMessage,
  getErrorSuggestions,
  logError 
} from './utils/errorHandling';

// Import ABIs (these would be generated after contract compilation)
import DocumentSignerFactoryABI from './abis/DocumentSignerFactory.json';
import EnhancedDocumentSignerABI from './abis/EnhancedDocumentSigner.json';

function App() {
  // State management
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [documentFile, setDocumentFile] = useState(null);
  const [contractTitle, setContractTitle] = useState('');
  const [contractDescription, setContractDescription] = useState('');
  const [requiredSigners, setRequiredSigners] = useState(['']);
  const [sequentialSigning, setSequentialSigning] = useState(false);
  const [contractAddress, setContractAddress] = useState('');
  const [signatureMetadata, setSignatureMetadata] = useState('');

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Validate configuration
      const configValidation = validateConfig();
      if (!configValidation.isValid) {
        console.warn('Configuration issues:', configValidation.errors);
        toast.warn('Some features may not work due to missing configuration');
      }

      // Check for existing wallet connection
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }
      }
    } catch (error) {
      logError(error, { context: 'app-initialization' });
      console.error('Failed to initialize app:', error);
    }
  };

  // Wallet connection
  const connectWallet = async () => {
    if (!window.ethereum) {
      throw new WalletConnectionError('MetaMask not installed');
    }

    setIsConnecting(true);
    
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const userAccount = await web3Signer.getAddress();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(userAccount);
      setChainId(Number(network.chainId));

      // Check if we're on the correct network
      if (Number(network.chainId) !== config.chainId) {
        await switchNetwork();
      }

      toast.success('Wallet connected successfully!');
      
      // Load user contracts
      await loadUserContracts(userAccount);

    } catch (error) {
      logError(error, { context: 'wallet-connection' });
      
      if (error.code === 4001) {
        throw new WalletConnectionError('User rejected connection');
      } else if (error.code === -32002) {
        throw new WalletConnectionError('Already processing eth_requestAccounts');
      } else {
        throw new WalletConnectionError(`Failed to connect wallet: ${error.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch to correct network
  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      });
    } catch (error) {
      if (error.code === 4902) {
        // Network not added to wallet, add it
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${config.chainId.toString(16)}`,
            chainName: config.chainName,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: config.blockExplorerUrl ? [config.blockExplorerUrl] : []
          }]
        });
      } else {
        throw error;
      }
    }
  };

  // Load user contracts
  const loadUserContracts = async (userAddress) => {
    if (!config.contractAddresses.factory) {
      console.warn('Factory contract address not configured');
      return;
    }

    try {
      const factory = new ethers.Contract(
        config.contractAddresses.factory,
        DocumentSignerFactoryABI,
        provider
      );

      const contractAddresses = await factory.getContractsByInitiator(userAddress);
      const contractsData = [];

      for (const address of contractAddresses) {
        try {
          const contractInfo = await factory.getContractInfo(address);
          const signingContract = new ethers.Contract(address, EnhancedDocumentSignerABI, provider);
          const progress = await signingContract.getSigningProgress();
          const status = await signingContract.status();

          contractsData.push({
            address,
            title: contractInfo.title,
            documentHash: contractInfo.documentHash,
            ipfsCid: contractInfo.ipfsCid,
            createdAt: new Date(Number(contractInfo.createdAt) * 1000),
            isActive: contractInfo.isActive,
            progress: `${progress.signed}/${progress.total}`,
            status: ['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'][status]
          });
        } catch (error) {
          console.warn(`Failed to load contract info for ${address}:`, error);
        }
      }

      setContracts(contractsData);
    } catch (error) {
      logError(error, { context: 'load-user-contracts', userAddress });
      console.error('Failed to load user contracts:', error);
    }
  };

  // Create signing contract
  const createSigningContract = async () => {
    if (!documentFile) {
      throw new ValidationError('Please select a document file');
    }

    if (!contractTitle.trim()) {
      throw new ValidationError('Please enter a contract title');
    }

    const validSigners = requiredSigners.filter(s => s.trim() && ethers.isAddress(s.trim()));
    if (validSigners.length === 0) {
      throw new ValidationError('Please add at least one valid signer address');
    }

    setLoading(true);

    try {
      // Upload document to IPFS
      toast.info('Uploading document to IPFS...');
      const uploadResult = await ipfsService.uploadWithMetadata(documentFile, {
        title: contractTitle,
        description: contractDescription
      });

      // Create contract via factory
      toast.info('Creating signing contract...');
      const factory = new ethers.Contract(
        config.contractAddresses.factory,
        DocumentSignerFactoryABI,
        signer
      );

      const tx = await factory.createSigningContract(
        uploadResult.documentHash,
        uploadResult.cid,
        validSigners,
        sequentialSigning,
        contractTitle,
        contractDescription
      );

      toast.info('Transaction submitted. Waiting for confirmation...');
      const receipt = await tx.wait();

      // Extract contract address from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed.name === 'ContractCreated';
        } catch {
          return false;
        }
      });

      if (!event) {
        throw new ContractError('Contract creation event not found');
      }

      const parsedEvent = factory.interface.parseLog(event);
      const newContractAddress = parsedEvent.args.contractAddress;

      toast.success('Contract created successfully!');
      
      // Reset form
      setDocumentFile(null);
      setContractTitle('');
      setContractDescription('');
      setRequiredSigners(['']);
      setSequentialSigning(false);

      // Reload contracts
      await loadUserContracts(account);

      return newContractAddress;

    } catch (error) {
      logError(error, { context: 'create-contract', fileName: documentFile?.name });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign document
  const signDocument = async () => {
    if (!contractAddress.trim()) {
      throw new ValidationError('Please enter a contract address');
    }

    if (!ethers.isAddress(contractAddress.trim())) {
      throw new ValidationError('Please enter a valid contract address');
    }

    setLoading(true);

    try {
      const signingContract = new ethers.Contract(
        contractAddress.trim(),
        EnhancedDocumentSignerABI,
        signer
      );

      toast.info('Signing document...');
      const tx = await signingContract.signDocument(signatureMetadata);
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      await tx.wait();

      toast.success('Document signed successfully!');
      
      // Reset form
      setContractAddress('');
      setSignatureMetadata('');

      // Reload contracts if this was user's contract
      await loadUserContracts(account);

    } catch (error) {
      logError(error, { context: 'sign-document', contractAddress });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle errors with user-friendly messages
  const handleError = (error) => {
    const friendlyMessage = getUserFriendlyMessage(error);
    const suggestions = getErrorSuggestions(error);
    
    toast.error(friendlyMessage);
    
    if (suggestions.length > 0) {
      console.log('Suggestions:', suggestions);
    }
  };

  // Safe async wrapper
  const safeAsync = (asyncFn) => {
    return async (...args) => {
      try {
        await asyncFn(...args);
      } catch (error) {
        handleError(error);
      }
    };
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>📝 Blockchain Document Signer</h1>
          <p>Secure, transparent, and immutable document signing</p>
          
          {!account ? (
            <div className="wallet-connection">
              {isConnecting ? (
                <WalletSpinner />
              ) : (
                <button 
                  onClick={safeAsync(connectWallet)}
                  className="connect-button"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          ) : (
            <div className="wallet-info">
              <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
              <p>Network: {config.chainName}</p>
            </div>
          )}
        </header>

        {account && (
          <main className="app-main">
            <div className="section">
              <h2>📤 Create Signing Contract</h2>
              
              <div className="form-group">
                <label>Document File:</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => setDocumentFile(e.target.files[0])}
                />
              </div>

              <div className="form-group">
                <label>Contract Title:</label>
                <input
                  type="text"
                  value={contractTitle}
                  onChange={(e) => setContractTitle(e.target.value)}
                  placeholder="Enter contract title"
                />
              </div>

              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={contractDescription}
                  onChange={(e) => setContractDescription(e.target.value)}
                  placeholder="Enter contract description"
                />
              </div>

              <div className="form-group">
                <label>Required Signers:</label>
                {requiredSigners.map((signer, index) => (
                  <div key={index} className="signer-input">
                    <input
                      type="text"
                      value={signer}
                      onChange={(e) => {
                        const newSigners = [...requiredSigners];
                        newSigners[index] = e.target.value;
                        setRequiredSigners(newSigners);
                      }}
                      placeholder="0x..."
                    />
                    {index > 0 && (
                      <button
                        onClick={() => {
                          const newSigners = requiredSigners.filter((_, i) => i !== index);
                          setRequiredSigners(newSigners);
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setRequiredSigners([...requiredSigners, ''])}
                >
                  Add Signer
                </button>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={sequentialSigning}
                    onChange={(e) => setSequentialSigning(e.target.checked)}
                  />
                  Sequential Signing (signers must sign in order)
                </label>
              </div>

              <button
                onClick={safeAsync(createSigningContract)}
                disabled={loading}
                className="primary-button"
              >
                {loading ? 'Creating...' : 'Create Contract'}
              </button>
            </div>

            <div className="section">
              <h2>✍️ Sign Document</h2>
              
              <div className="form-group">
                <label>Contract Address:</label>
                <input
                  type="text"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  placeholder="0x..."
                />
              </div>

              <div className="form-group">
                <label>Signature Notes (Optional):</label>
                <textarea
                  value={signatureMetadata}
                  onChange={(e) => setSignatureMetadata(e.target.value)}
                  placeholder="Add any notes about your signature"
                />
              </div>

              <button
                onClick={safeAsync(signDocument)}
                disabled={loading}
                className="primary-button"
              >
                {loading ? 'Signing...' : 'Sign Document'}
              </button>
            </div>

            <div className="section">
              <h2>📋 My Contracts</h2>
              
              {contracts.length === 0 ? (
                <p>No contracts found. Create your first contract above!</p>
              ) : (
                <div className="contracts-list">
                  {contracts.map((contract) => (
                    <div key={contract.address} className="contract-card">
                      <h3>{contract.title}</h3>
                      <p><strong>Status:</strong> {contract.status}</p>
                      <p><strong>Progress:</strong> {contract.progress}</p>
                      <p><strong>Created:</strong> {contract.createdAt.toLocaleDateString()}</p>
                      <p><strong>Address:</strong> {contract.address.slice(0, 10)}...{contract.address.slice(-8)}</p>
                      <button
                        onClick={() => setContractAddress(contract.address)}
                      >
                        Use for Signing
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        )}

        {loading && <LoadingSpinner overlay={true} />}
        
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
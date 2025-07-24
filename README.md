# 📝 Blockchain Document Signer

A secure, transparent, and immutable document signing platform built on blockchain technology. This application enables multiple parties to digitally sign legal contracts using smart contracts, ensuring verifiability and tamper-proof records.

## 🌟 Features

- **Multi-Party Signing**: Support for multiple signers with flexible workflows
- **Sequential & Parallel Signing**: Choose between ordered or simultaneous signing
- **IPFS Integration**: Decentralized document storage with integrity verification
- **Smart Contract Security**: Built with OpenZeppelin security standards
- **Multiple Interfaces**: React frontend and Streamlit admin panel
- **Comprehensive Testing**: Full test coverage with automated CI/CD
- **Multi-Network Support**: Deploy on localhost, testnets, and mainnet

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Web     │    │  Streamlit      │    │   Smart         │
│   Frontend      │◄──►│  Admin Panel    │◄──►│   Contracts     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   IPFS Network  │
                    │   (NFT.Storage) │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd blockchain-document-signer

# Install dependencies
npm install

# Install Python dependencies
pip install streamlit web3 eth-account requests python-dotenv
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp frontend/.env.example frontend/.env

# Edit .env files with your configuration
```

### 3. Start Local Blockchain

```bash
# Start Hardhat node
npx hardhat node
```

### 4. Deploy Contracts

```bash
# Deploy to local network
npm run deploy:local

# The deployment will automatically update your .env files
```

### 5. Run Applications

```bash
# Terminal 1: Start React frontend
npm run start:react

# Terminal 2: Start Streamlit admin panel
npm run start:streamlit
```

Visit:
- React App: http://localhost:3000
- Streamlit App: http://localhost:8501

## 📋 Detailed Setup

### Environment Variables

#### Root `.env` file:
```env
# Blockchain Networks
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_INFURA_PROJECT_ID
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=your_private_key_here

# Contract Verification
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# IPFS Storage
NFT_STORAGE_API_KEY=your_nft_storage_api_key_here

# Contract Addresses (auto-populated after deployment)
FACTORY_ADDRESS_DEV=
FACTORY_ADDRESS_GOERLI=
FACTORY_ADDRESS_MAINNET=
```

#### Frontend `.env` file:
```env
REACT_APP_ENVIRONMENT=development
REACT_APP_INFURA_PROJECT_ID=your_infura_project_id_here
REACT_APP_NFT_STORAGE_API_KEY=your_nft_storage_api_key_here
REACT_APP_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here

# Contract addresses (auto-populated)
REACT_APP_FACTORY_ADDRESS_DEV=
REACT_APP_FACTORY_ADDRESS_GOERLI=
REACT_APP_FACTORY_ADDRESS_MAINNET=
```

### Required API Keys

1. **Infura Project ID**: Get from [infura.io](https://infura.io)
2. **NFT.Storage API Key**: Get from [nft.storage](https://nft.storage)
3. **WalletConnect Project ID**: Get from [walletconnect.com](https://walletconnect.com)
4. **Etherscan API Key**: Get from [etherscan.io](https://etherscan.io/apis)

## 🔧 Development

### Smart Contract Development

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Clean artifacts
npm run clean
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

### Testing

```bash
# Run all smart contract tests
npm run test

# Test specific contract
npx hardhat test test/EnhancedDocumentSigner.test.js

# Test deployment
npx hardhat run scripts/test-deployment.js --network localhost
```

## 🌐 Deployment

### Local Development

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts
npm run deploy:local

# Test deployment
npx hardhat run scripts/test-deployment.js --network localhost
```

### Testnet Deployment

```bash
# Deploy to Goerli
npm run deploy:goerli

# Deploy to Sepolia
npm run deploy:sepolia
```

### Mainnet Deployment

```bash
# Deploy to mainnet (use with caution)
npm run deploy:mainnet
```

## 📖 Usage Guide

### Creating a Signing Contract

1. **Upload Document**: Select your PDF, Word, or text document
2. **Configure Signers**: Add Ethereum addresses of required signers
3. **Set Options**: Choose sequential or parallel signing
4. **Deploy Contract**: Transaction creates a new signing contract

### Signing Documents

1. **Connect Wallet**: Use MetaMask or compatible wallet
2. **Enter Contract Address**: From the contract creation step
3. **Add Signature**: Optionally include notes with your signature
4. **Confirm Transaction**: Sign the blockchain transaction

### Monitoring Progress

- **Real-time Status**: View signing progress and completion
- **Signature Details**: See who signed and when
- **Document Verification**: Verify document integrity via IPFS

## 🔒 Security Features

- **OpenZeppelin Standards**: Built with battle-tested security libraries
- **Reentrancy Protection**: Guards against common attack vectors
- **Access Controls**: Role-based permissions and ownership
- **Input Validation**: Comprehensive parameter checking
- **Gas Optimization**: Efficient contract execution

## 🧪 Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Individual contract function testing
- **Integration Tests**: End-to-end workflow testing
- **Security Tests**: Attack vector and edge case testing
- **Gas Analysis**: Cost optimization verification

```bash
# Run all tests
npm run test

# Generate coverage report
npm run test:coverage

# Test specific scenarios
npx hardhat test --grep "signing workflow"
```

## 📊 Gas Costs

Typical gas usage (at 20 gwei):

| Operation | Gas Used | Cost (ETH) | Cost (USD)* |
|-----------|----------|------------|-------------|
| Deploy Factory | ~2,500,000 | 0.05 | $100 |
| Create Contract | ~3,000,000 | 0.06 | $120 |
| Sign Document | ~150,000 | 0.003 | $6 |

*Prices are estimates and vary with ETH price and network congestion.

## 🛠️ Troubleshooting

### Common Issues

#### "Contract ABI not found"
```bash
# Compile contracts first
npm run compile

# Check artifacts directory exists
ls artifacts/contracts/
```

#### "Factory address not configured"
```bash
# Deploy contracts to populate addresses
npm run deploy:local

# Check .env file was updated
cat .env | grep FACTORY_ADDRESS
```

#### "Insufficient funds for gas"
```bash
# Check account balance
npx hardhat run scripts/check-balance.js --network localhost

# Fund account from Hardhat node accounts
```

#### "Network connection failed"
```bash
# Ensure Hardhat node is running
npx hardhat node

# Check RPC URL in configuration
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
export DEBUG=true

# Run with verbose output
npm run test -- --verbose
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Write comprehensive tests for new features
- Follow existing code style and conventions
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🔗 Links

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [React Documentation](https://reactjs.org/docs)
- [Streamlit Documentation](https://docs.streamlit.io)
- [IPFS Documentation](https://docs.ipfs.io)

---

**Built with ❤️ for secure document signing on the blockchain**
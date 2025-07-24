import streamlit as st
import hashlib
from web3 import Web3
from eth_account import Account
import json
import time
import os
from pathlib import Path
import requests
from typing import Optional, Dict, List, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration Management
class Config:
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.load_config()
    
    def load_config(self):
        if self.environment == 'development':
            self.rpc_url = 'http://127.0.0.1:8545'
            self.chain_id = 31337
        elif self.environment == 'goerli':
            self.rpc_url = f"https://goerli.infura.io/v3/{os.getenv('INFURA_PROJECT_ID')}"
            self.chain_id = 5
        elif self.environment == 'sepolia':
            self.rpc_url = f"https://sepolia.infura.io/v3/{os.getenv('INFURA_PROJECT_ID')}"
            self.chain_id = 11155111
        else:
            raise ValueError(f"Unsupported environment: {self.environment}")
        
        # Contract addresses
        self.factory_address = os.getenv(f'FACTORY_ADDRESS_{self.environment.upper()}')
        
        # IPFS configuration
        self.nft_storage_key = os.getenv('NFT_STORAGE_API_KEY')
        self.ipfs_gateway = 'https://ipfs.io/ipfs/'

config = Config()

# Web3 setup with error handling
try:
    w3 = Web3(Web3.HTTPProvider(config.rpc_url))
    if not w3.is_connected():
        st.error(f"❌ Failed to connect to {config.environment} network")
        st.stop()
except Exception as e:
    st.error(f"❌ Web3 connection error: {str(e)}")
    st.stop()

# Load contract ABIs
def load_contract_abi(contract_name: str) -> Optional[Dict]:
    """Load contract ABI from artifacts or deployments"""
    try:
        # Try loading from Hardhat artifacts first
        artifacts_path = Path(f'artifacts/contracts/{contract_name}.sol/{contract_name}.json')
        if artifacts_path.exists():
            with open(artifacts_path) as f:
                artifact = json.load(f)
                return artifact['abi']
        
        # Try loading from deployments
        deployment_path = Path(f'deployments/{config.environment}.json')
        if deployment_path.exists():
            with open(deployment_path) as f:
                deployment = json.load(f)
                # This would need to be extended to include ABI in deployment file
                pass
        
        # Fallback to build directory (Truffle)
        build_path = Path(f'build/contracts/{contract_name}.json')
        if build_path.exists():
            with open(build_path) as f:
                contract_data = json.load(f)
                return contract_data['abi']
        
        return None
    except Exception as e:
        logger.error(f"Error loading ABI for {contract_name}: {e}")
        return None

# Load contract ABIs
FACTORY_ABI = load_contract_abi('DocumentSignerFactory')
SIGNER_ABI = load_contract_abi('EnhancedDocumentSigner')

if not FACTORY_ABI:
    st.error("❌ Could not load DocumentSignerFactory ABI. Please compile contracts first.")
    st.stop()

if not SIGNER_ABI:
    st.error("❌ Could not load EnhancedDocumentSigner ABI. Please compile contracts first.")
    st.stop()

# Utility functions
def hash_document(file_bytes: bytes) -> str:
    """Generate SHA-256 hash of document bytes"""
    sha256 = hashlib.sha256()
    sha256.update(file_bytes)
    return '0x' + sha256.hexdigest()

def upload_to_ipfs(file_bytes: bytes, filename: str) -> str:
    """Upload file to IPFS via NFT.Storage (mock implementation)"""
    # In a real implementation, you would upload to IPFS
    # For now, return a mock CID
    import hashlib
    file_hash = hashlib.md5(file_bytes).hexdigest()
    return f"Qm{file_hash[:44]}"  # Mock IPFS CID

def create_signing_contract(
    document_hash: str, 
    ipfs_cid: str,
    required_signers: List[str], 
    private_key: str,
    title: str = "Document",
    description: str = "Document for signing",
    sequential_signing: bool = False
) -> str:
    """Create a new signing contract via factory"""
    try:
        if not config.factory_address:
            raise ValueError("Factory address not configured")
        
        account = Account.from_key(private_key)
        factory = w3.eth.contract(address=config.factory_address, abi=FACTORY_ABI)
        
        # Build transaction
        txn = factory.functions.createSigningContract(
            document_hash,
            ipfs_cid,
            required_signers,
            sequential_signing,
            title,
            description
        ).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 3000000,
            'gasPrice': w3.to_wei('20', 'gwei')
        })
        
        # Sign and send transaction
        signed_txn = w3.eth.account.sign_transaction(txn, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Extract contract address from event logs
        for log in tx_receipt.logs:
            try:
                decoded_log = factory.events.ContractCreated().processLog(log)
                return decoded_log.args.contractAddress
            except:
                continue
        
        raise ValueError("Could not find ContractCreated event in transaction receipt")
        
    except Exception as e:
        logger.error(f"Error creating signing contract: {e}")
        raise

def sign_document(contract_address: str, private_key: str, metadata: str = "") -> str:
    """Sign a document in the given contract"""
    try:
        account = Account.from_key(private_key)
        contract = w3.eth.contract(address=contract_address, abi=SIGNER_ABI)
        
        # Build transaction
        txn = contract.functions.signDocument(metadata).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 200000,
            'gasPrice': w3.to_wei('20', 'gwei')
        })
        
        # Sign and send transaction
        signed_txn = w3.eth.account.sign_transaction(txn, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return tx_hash.hex()
        
    except Exception as e:
        logger.error(f"Error signing document: {e}")
        raise

def get_contract_status(contract_address: str) -> Dict:
    """Get the status of a signing contract"""
    try:
        contract = w3.eth.contract(address=contract_address, abi=SIGNER_ABI)
        
        # Get contract information
        signatures = contract.functions.getSignatures().call()
        is_fully_signed = contract.functions.isFullySigned().call()
        required_signers = contract.functions.getRequiredSigners().call()
        progress = contract.functions.getSigningProgress().call()
        status = contract.functions.status().call()
        document_hash = contract.functions.documentHash().call()
        ipfs_cid = contract.functions.ipfsCid().call()
        
        # Status mapping
        status_names = ["INITIATED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
        
        return {
            'signatures': signatures,
            'is_fully_signed': is_fully_signed,
            'required_signers': required_signers,
            'signed_count': progress[0],
            'total_signers': progress[1],
            'status': status_names[status] if status < len(status_names) else "UNKNOWN",
            'document_hash': document_hash,
            'ipfs_cid': ipfs_cid
        }
        
    except Exception as e:
        logger.error(f"Error getting contract status: {e}")
        raise

def get_user_contracts(user_address: str) -> List[Dict]:
    """Get all contracts created by a user"""
    try:
        if not config.factory_address:
            return []
        
        factory = w3.eth.contract(address=config.factory_address, abi=FACTORY_ABI)
        contract_addresses = factory.functions.getContractsByInitiator(user_address).call()
        
        contracts = []
        for address in contract_addresses:
            try:
                contract_info = factory.functions.getContractInfo(address).call()
                status_info = get_contract_status(address)
                
                contracts.append({
                    'address': address,
                    'title': contract_info[6],  # title field
                    'document_hash': contract_info[1],  # documentHash field
                    'ipfs_cid': contract_info[2],  # ipfsCid field
                    'created_at': contract_info[4],  # createdAt field
                    'is_active': contract_info[5],  # isActive field
                    'status': status_info['status'],
                    'progress': f"{status_info['signed_count']}/{status_info['total_signers']}"
                })
            except Exception as e:
                logger.warning(f"Error getting info for contract {address}: {e}")
                continue
        
        return contracts
        
    except Exception as e:
        logger.error(f"Error getting user contracts: {e}")
        return []

# Streamlit UI
st.set_page_config(
    page_title="Blockchain Document Signer",
    page_icon="📝",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("📝 Blockchain Document Signer")
st.markdown("*Secure, transparent, and immutable document signing on the blockchain*")

# Sidebar for configuration info
with st.sidebar:
    st.header("🔧 Configuration")
    st.info(f"**Environment:** {config.environment}")
    st.info(f"**Network:** {config.chain_id}")
    st.info(f"**Factory Address:** {config.factory_address or 'Not configured'}")
    
    if w3.is_connected():
        st.success("✅ Connected to blockchain")
        latest_block = w3.eth.block_number
        st.metric("Latest Block", latest_block)
    else:
        st.error("❌ Not connected to blockchain")

# Main tabs
tab1, tab2, tab3, tab4 = st.tabs(["📤 Create Contract", "✍️ Sign Document", "📊 Check Status", "📋 My Contracts"])

with tab1:
    st.header("📤 Create Signing Contract")
    st.markdown("Upload a document and create a new signing contract")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        uploaded_file = st.file_uploader(
            "Upload Document", 
            type=['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg'],
            help="Supported formats: PDF, Word, Text, Images"
        )
        
        if uploaded_file:
            st.success(f"✅ File uploaded: {uploaded_file.name} ({uploaded_file.size} bytes)")
    
    with col2:
        st.subheader("Contract Settings")
        title = st.text_input("Document Title", value="Legal Contract")
        description = st.text_area("Description", value="Document for signing")
        sequential_signing = st.checkbox("Sequential Signing", help="Signers must sign in order")
    
    st.subheader("👥 Signers Configuration")
    initiator_key = st.text_input("Your Private Key", type="password", help="Private key of contract initiator")
    
    # Dynamic signer input
    if 'signers' not in st.session_state:
        st.session_state.signers = ['']
    
    col1, col2 = st.columns([3, 1])
    with col1:
        for i, signer in enumerate(st.session_state.signers):
            st.session_state.signers[i] = st.text_input(
                f"Signer {i+1} Address", 
                value=signer,
                key=f"signer_{i}",
                placeholder="0x..."
            )
    
    with col2:
        if st.button("➕ Add Signer"):
            st.session_state.signers.append('')
            st.rerun()
        
        if len(st.session_state.signers) > 1 and st.button("➖ Remove Signer"):
            st.session_state.signers.pop()
            st.rerun()
    
    # Create contract button
    if st.button("🚀 Create Signing Contract", type="primary"):
        if not uploaded_file:
            st.error("❌ Please upload a document")
        elif not initiator_key:
            st.error("❌ Please enter your private key")
        elif not any(st.session_state.signers):
            st.error("❌ Please add at least one signer")
        else:
            try:
                with st.spinner("Creating contract..."):
                    # Process file
                    file_bytes = uploaded_file.read()
                    document_hash = hash_document(file_bytes)
                    ipfs_cid = upload_to_ipfs(file_bytes, uploaded_file.name)
                    
                    # Get initiator address
                    initiator_address = Account.from_key(initiator_key).address
                    
                    # Filter out empty signers and add initiator
                    required_signers = [initiator_address] + [s for s in st.session_state.signers if s.strip()]
                    required_signers = list(dict.fromkeys(required_signers))  # Remove duplicates
                    
                    # Create contract
                    contract_address = create_signing_contract(
                        document_hash=document_hash,
                        ipfs_cid=ipfs_cid,
                        required_signers=required_signers,
                        private_key=initiator_key,
                        title=title,
                        description=description,
                        sequential_signing=sequential_signing
                    )
                    
                    st.success(f"🎉 Contract created successfully!")
                    st.info(f"**Contract Address:** `{contract_address}`")
                    st.info(f"**Document Hash:** `{document_hash}`")
                    st.info(f"**IPFS CID:** `{ipfs_cid}`")
                    
                    # Store in session for other tabs
                    st.session_state.last_contract = contract_address
                    
            except Exception as e:
                st.error(f"❌ Error creating contract: {str(e)}")

with tab2:
    st.header("✍️ Sign Document")
    st.markdown("Sign an existing document contract")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        contract_address = st.text_input(
            "Contract Address", 
            value=st.session_state.get('last_contract', ''),
            placeholder="0x...",
            help="Address of the signing contract"
        )
        
        signer_key = st.text_input(
            "Your Private Key", 
            type="password",
            help="Private key to sign the document"
        )
        
        signature_metadata = st.text_area(
            "Signature Notes (Optional)",
            placeholder="Add any notes about your signature...",
            help="Optional metadata to include with your signature"
        )
    
    with col2:
        if contract_address:
            try:
                status_info = get_contract_status(contract_address)
                st.subheader("📊 Contract Status")
                st.metric("Status", status_info['status'])
                st.metric("Progress", status_info['progress'])
                
                if status_info['required_signers']:
                    st.subheader("👥 Required Signers")
                    for i, signer in enumerate(status_info['required_signers']):
                        signed = any(sig[0].lower() == signer.lower() for sig in status_info['signatures'])
                        icon = "✅" if signed else "⏳"
                        st.write(f"{icon} {signer[:10]}...{signer[-8:]}")
                        
            except Exception as e:
                st.warning(f"Could not load contract status: {str(e)}")
    
    if st.button("✍️ Sign Document", type="primary"):
        if not contract_address:
            st.error("❌ Please enter contract address")
        elif not signer_key:
            st.error("❌ Please enter your private key")
        else:
            try:
                with st.spinner("Signing document..."):
                    tx_hash = sign_document(contract_address, signer_key, signature_metadata)
                    st.success(f"🎉 Document signed successfully!")
                    st.info(f"**Transaction Hash:** `{tx_hash}`")
                    
                    # Refresh status
                    time.sleep(2)  # Wait for transaction to be mined
                    st.rerun()
                    
            except Exception as e:
                st.error(f"❌ Error signing document: {str(e)}")

with tab3:
    st.header("📊 Contract Status")
    st.markdown("Check the status of any signing contract")
    
    status_contract_address = st.text_input(
        "Contract Address to Check", 
        value=st.session_state.get('last_contract', ''),
        placeholder="0x..."
    )
    
    if st.button("🔍 Check Status") and status_contract_address:
        try:
            with st.spinner("Loading contract status..."):
                status_info = get_contract_status(status_contract_address)
                
                # Status overview
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Status", status_info['status'])
                with col2:
                    st.metric("Progress", f"{status_info['signed_count']}/{status_info['total_signers']}")
                with col3:
                    st.metric("Fully Signed", "Yes" if status_info['is_fully_signed'] else "No")
                with col4:
                    completion = (status_info['signed_count'] / status_info['total_signers']) * 100
                    st.metric("Completion", f"{completion:.0f}%")
                
                # Document info
                st.subheader("📄 Document Information")
                col1, col2 = st.columns(2)
                with col1:
                    st.code(f"Hash: {status_info['document_hash']}")
                with col2:
                    st.code(f"IPFS: {status_info['ipfs_cid']}")
                
                # Signatures
                st.subheader("✍️ Signatures")
                if status_info['signatures']:
                    for i, sig in enumerate(status_info['signatures']):
                        with st.expander(f"Signature {i+1} - {sig[0][:10]}...{sig[0][-8:]}"):
                            st.write(f"**Signer:** `{sig[0]}`")
                            st.write(f"**Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(sig[1]))}")
                            if len(sig) > 3 and sig[3]:  # metadata
                                st.write(f"**Notes:** {sig[3]}")
                else:
                    st.info("No signatures yet")
                
                # Required signers
                st.subheader("👥 Required Signers")
                for signer in status_info['required_signers']:
                    signed = any(sig[0].lower() == signer.lower() for sig in status_info['signatures'])
                    icon = "✅" if signed else "⏳"
                    status_text = "Signed" if signed else "Pending"
                    st.write(f"{icon} `{signer}` - {status_text}")
                    
        except Exception as e:
            st.error(f"❌ Error checking status: {str(e)}")

with tab4:
    st.header("📋 My Contracts")
    st.markdown("View all contracts you've created")
    
    user_address_input = st.text_input(
        "Your Address", 
        placeholder="0x...",
        help="Enter your Ethereum address to see your contracts"
    )
    
    if st.button("📋 Load My Contracts") and user_address_input:
        try:
            with st.spinner("Loading your contracts..."):
                contracts = get_user_contracts(user_address_input)
                
                if contracts:
                    st.success(f"Found {len(contracts)} contracts")
                    
                    for contract in contracts:
                        with st.expander(f"📄 {contract['title']} - {contract['status']}"):
                            col1, col2 = st.columns(2)
                            
                            with col1:
                                st.write(f"**Address:** `{contract['address']}`")
                                st.write(f"**Status:** {contract['status']}")
                                st.write(f"**Progress:** {contract['progress']}")
                                
                            with col2:
                                st.write(f"**Document Hash:** `{contract['document_hash'][:20]}...`")
                                st.write(f"**IPFS CID:** `{contract['ipfs_cid']}`")
                                st.write(f"**Created:** {time.strftime('%Y-%m-%d', time.localtime(contract['created_at']))}")
                            
                            if st.button(f"View Details", key=f"view_{contract['address']}"):
                                st.session_state.last_contract = contract['address']
                                st.switch_page("tab3")  # Switch to status tab
                else:
                    st.info("No contracts found for this address")
                    
        except Exception as e:
            st.error(f"❌ Error loading contracts: {str(e)}")

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #666;'>
        <p>🔐 Blockchain Document Signer | Built with Streamlit & Web3</p>
        <p>Secure • Transparent • Immutable</p>
    </div>
    """, 
    unsafe_allow_html=True
)
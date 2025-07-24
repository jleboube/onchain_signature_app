import { NFTStorage } from 'nft.storage';
import config from '../config';
import { IPFSError, withRetry, withTimeout, logError } from '../utils/errorHandling';

class IPFSService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.supportedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
  }

  /**
   * Initialize the IPFS service
   */
  async initialize() {
    if (this.initialized) return;

    if (!config.nftStorageKey) {
      throw new IPFSError('NFT Storage API key not configured', 'initialization');
    }

    try {
      this.client = new NFTStorage({ token: config.nftStorageKey });
      this.initialized = true;
      
      if (config.enableLogging) {
        console.log('IPFS service initialized successfully');
      }
    } catch (error) {
      logError(error, { service: 'ipfs', operation: 'initialize' });
      throw new IPFSError('Failed to initialize IPFS service', 'initialization');
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file) {
    if (!file) {
      throw new IPFSError('No file provided', 'validation');
    }

    if (file.size > this.maxFileSize) {
      throw new IPFSError(
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.maxFileSize)})`,
        'validation'
      );
    }

    if (!this.supportedTypes.includes(file.type)) {
      throw new IPFSError(
        `File type '${file.type}' is not supported. Supported types: ${this.supportedTypes.join(', ')}`,
        'validation'
      );
    }

    return true;
  }

  /**
   * Upload file to IPFS
   */
  async uploadFile(file, onProgress = null) {
    await this.initialize();
    this.validateFile(file);

    try {
      const uploadOperation = async () => {
        // Create a progress tracking wrapper if callback provided
        if (onProgress) {
          onProgress(0);
        }

        // Upload to IPFS via NFT.Storage
        const cid = await withTimeout(
          this.client.storeBlob(file),
          60000 // 60 second timeout
        );

        if (onProgress) {
          onProgress(100);
        }

        // Verify the upload by attempting to retrieve metadata
        await this.verifyUpload(cid);

        const result = {
          cid: cid,
          size: file.size,
          type: file.type,
          name: file.name,
          uploadedAt: new Date().toISOString(),
          gateway: `${config.ipfsGateway}${cid}`
        };

        if (config.enableLogging) {
          console.log('File uploaded successfully:', result);
        }

        return result;
      };

      // Retry upload up to 3 times with exponential backoff
      return await withRetry(uploadOperation, 3, 2000);

    } catch (error) {
      logError(error, { 
        service: 'ipfs', 
        operation: 'upload',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      if (error.name === 'TimeoutError') {
        throw new IPFSError('Upload timed out. Please try again with a smaller file.', 'upload');
      }

      throw new IPFSError(
        `Failed to upload file: ${error.message}`,
        'upload'
      );
    }
  }

  /**
   * Retrieve file from IPFS
   */
  async retrieveFile(cid) {
    if (!cid) {
      throw new IPFSError('No CID provided', 'retrieval');
    }

    try {
      const retrieveOperation = async () => {
        const response = await fetch(`${config.ipfsGateway}${cid}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      };

      const response = await withTimeout(
        withRetry(retrieveOperation, 3, 1000),
        30000 // 30 second timeout
      );

      return response;

    } catch (error) {
      logError(error, { 
        service: 'ipfs', 
        operation: 'retrieve',
        cid: cid
      });

      throw new IPFSError(
        `Failed to retrieve file from IPFS: ${error.message}`,
        'retrieval'
      );
    }
  }

  /**
   * Get file metadata from IPFS
   */
  async getFileMetadata(cid) {
    if (!cid) {
      throw new IPFSError('No CID provided', 'metadata');
    }

    try {
      const response = await this.retrieveFile(cid);
      
      const metadata = {
        cid: cid,
        size: response.headers.get('content-length'),
        type: response.headers.get('content-type'),
        lastModified: response.headers.get('last-modified'),
        gateway: `${config.ipfsGateway}${cid}`,
        retrievedAt: new Date().toISOString()
      };

      return metadata;

    } catch (error) {
      logError(error, { 
        service: 'ipfs', 
        operation: 'metadata',
        cid: cid
      });

      throw new IPFSError(
        `Failed to get file metadata: ${error.message}`,
        'metadata'
      );
    }
  }

  /**
   * Verify file integrity using hash
   */
  async verifyFileIntegrity(file, expectedHash) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const computedHash = `0x${hashHex}`;

      const isValid = computedHash === expectedHash;

      if (config.enableLogging) {
        console.log('File integrity check:', {
          expected: expectedHash,
          computed: computedHash,
          valid: isValid
        });
      }

      return {
        isValid,
        expectedHash,
        computedHash
      };

    } catch (error) {
      logError(error, { 
        service: 'ipfs', 
        operation: 'integrity-check',
        fileName: file.name
      });

      throw new IPFSError(
        `Failed to verify file integrity: ${error.message}`,
        'integrity-check'
      );
    }
  }

  /**
   * Verify upload was successful
   */
  async verifyUpload(cid) {
    try {
      const response = await fetch(`${config.ipfsGateway}${cid}`, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`Upload verification failed: HTTP ${response.status}`);
      }

      return true;

    } catch (error) {
      throw new IPFSError(
        `Upload verification failed: ${error.message}`,
        'verification'
      );
    }
  }

  /**
   * Generate document hash for blockchain storage
   */
  async generateDocumentHash(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `0x${hashHex}`;

    } catch (error) {
      logError(error, { 
        service: 'ipfs', 
        operation: 'hash-generation',
        fileName: file.name
      });

      throw new IPFSError(
        `Failed to generate document hash: ${error.message}`,
        'hash-generation'
      );
    }
  }

  /**
   * Upload file with metadata
   */
  async uploadWithMetadata(file, metadata = {}, onProgress = null) {
    await this.initialize();
    this.validateFile(file);

    try {
      // Generate document hash
      const documentHash = await this.generateDocumentHash(file);

      // Create metadata object
      const fileMetadata = {
        name: file.name,
        size: file.size,
        type: file.type,
        documentHash: documentHash,
        uploadedAt: new Date().toISOString(),
        ...metadata
      };

      // Upload file
      const uploadResult = await this.uploadFile(file, onProgress);

      return {
        ...uploadResult,
        documentHash,
        metadata: fileMetadata
      };

    } catch (error) {
      logError(error, { 
        service: 'ipfs', 
        operation: 'upload-with-metadata',
        fileName: file.name
      });

      throw error; // Re-throw as it's already an IPFSError
    }
  }

  /**
   * Batch upload multiple files
   */
  async uploadBatch(files, onProgress = null) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new IPFSError('No files provided for batch upload', 'batch-upload');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const progressCallback = onProgress ? 
          (progress) => onProgress(i, progress, files.length) : null;

        const result = await this.uploadWithMetadata(files[i], {}, progressCallback);
        results.push(result);

      } catch (error) {
        errors.push({
          file: files[i].name,
          error: error.message
        });
      }
    }

    return {
      successful: results,
      failed: errors,
      totalFiles: files.length,
      successCount: results.length,
      failureCount: errors.length
    };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get supported file types
   */
  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  /**
   * Get maximum file size
   */
  getMaxFileSize() {
    return this.maxFileSize;
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasApiKey: !!config.nftStorageKey,
      gateway: config.ipfsGateway,
      maxFileSize: this.maxFileSize,
      supportedTypes: this.supportedTypes
    };
  }
}

// Create and export singleton instance
const ipfsService = new IPFSService();

export default ipfsService;

// Export class for testing
export { IPFSService };
import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  overlay = false,
  color = 'primary'
}) => {
  const sizeClass = `loading-spinner-${size}`;
  const colorClass = `loading-spinner-${color}`;
  
  const spinner = (
    <div className={`loading-spinner ${sizeClass} ${colorClass}`}>
      <div className="loading-spinner-circle">
        <div className="loading-spinner-inner"></div>
      </div>
      {message && <div className="loading-spinner-message">{message}</div>}
    </div>
  );
  
  if (overlay) {
    return (
      <div className="loading-spinner-overlay">
        {spinner}
      </div>
    );
  }
  
  return spinner;
};

// Specialized loading components
export const TransactionSpinner = ({ txHash, message = 'Processing transaction...' }) => (
  <div className="transaction-spinner">
    <LoadingSpinner size="large" color="primary" />
    <div className="transaction-spinner-content">
      <h3>{message}</h3>
      {txHash && (
        <p className="transaction-hash">
          Transaction: <code>{txHash.slice(0, 10)}...{txHash.slice(-8)}</code>
        </p>
      )}
      <p className="transaction-note">
        This may take a few moments. Please don't close this window.
      </p>
    </div>
  </div>
);

export const UploadSpinner = ({ progress, message = 'Uploading document...' }) => (
  <div className="upload-spinner">
    <LoadingSpinner size="large" color="secondary" />
    <div className="upload-spinner-content">
      <h3>{message}</h3>
      {progress !== undefined && (
        <div className="upload-progress">
          <div className="upload-progress-bar">
            <div 
              className="upload-progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="upload-progress-text">{progress}%</span>
        </div>
      )}
    </div>
  </div>
);

export const WalletSpinner = ({ message = 'Connecting to wallet...' }) => (
  <div className="wallet-spinner">
    <LoadingSpinner size="medium" color="accent" />
    <div className="wallet-spinner-content">
      <h3>{message}</h3>
      <p>Please check your wallet and approve the connection.</p>
    </div>
  </div>
);

export default LoadingSpinner;
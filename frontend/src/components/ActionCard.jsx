import React, { useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiPlay, FiX, FiCheck, FiLayers } from 'react-icons/fi';
import { apiClient } from '../api/client';

export function ActionCard({ rawData }) {
  let card = null;
  try {
    card = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  } catch {
    return <pre className="action-card-raw">{rawData}</pre>;
  }

  const [approvalStatus, setApprovalStatus] = useState(card.type === 'approval_required' ? 'pending' : 'executed');
  const [executionResult, setExecutionResult] = useState(card.result || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const isApprovalRequired = card.type === 'approval_required' && approvalStatus === 'pending';
  const toolName = card.toolName || 'system_tool';
  const domain = card.domain || 'automation';

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.approveTool(card.toolName, card.parameters || {});
      setApprovalStatus('approved');
      setExecutionResult(res.result || res);
    } catch (err) {
      setErrorMsg(err.message || 'Approval execution failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    setApprovalStatus('rejected');
  };

  return (
    <div className={`action-card-container ${isApprovalRequired ? 'approval-pending' : 'action-done'}`}>
      <div className="action-card-header">
        <div className="action-card-title-group">
          <FiLayers className="action-card-icon" />
          <span className="action-card-tool-name">{toolName}</span>
          <span className="action-card-domain-badge">{domain.toUpperCase()}</span>
        </div>
        <div className="action-card-status-badge">
          {approvalStatus === 'pending' && (
            <span className="badge-warning">
              <FiAlertTriangle /> Confirmation Required
            </span>
          )}
          {approvalStatus === 'approved' && (
            <span className="badge-success">
              <FiCheckCircle /> Approved & Executed
            </span>
          )}
          {approvalStatus === 'rejected' && (
            <span className="badge-danger">
              <FiX /> Action Cancelled
            </span>
          )}
          {approvalStatus === 'executed' && (
            <span className="badge-success">
              <FiCheckCircle /> Executed Deterministically
            </span>
          )}
        </div>
      </div>

      {card.message && (
        <div className="action-card-message">{card.message}</div>
      )}

      {/* Parameters Preview */}
      {card.parameters && Object.keys(card.parameters).length > 0 && (
        <div className="action-card-params-section">
          <div className="action-card-section-label">Parameters</div>
          <div className="action-card-params-grid">
            {Object.entries(card.parameters).map(([key, val]) => (
              <div key={key} className="action-card-param-item">
                <span className="param-key">{key}:</span>
                <span className="param-val">
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Result Preview */}
      {executionResult && (
        <div className="action-card-result-section">
          <div className="action-card-section-label">Execution Result</div>
          <pre className="action-card-result-json">
            {JSON.stringify(executionResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Error message if any */}
      {errorMsg && (
        <div className="action-card-error">
          <FiX /> {errorMsg}
        </div>
      )}

      {/* Interactive Approval Bar */}
      {isApprovalRequired && (
        <div className="action-card-footer">
          <button
            className="action-btn-approve"
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            <FiCheck /> {isSubmitting ? 'Executing...' : 'Approve & Execute'}
          </button>
          <button
            className="action-btn-reject"
            onClick={handleReject}
            disabled={isSubmitting}
          >
            <FiX /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}


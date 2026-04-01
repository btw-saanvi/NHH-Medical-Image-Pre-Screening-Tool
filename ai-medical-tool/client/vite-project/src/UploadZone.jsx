import { useState, useCallback, useRef } from 'react';
import './UploadZone.css';

function UploadZone({ onFileSelect, file, preview }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileSelect(dropped);
  }, [onFileSelect]);

  const handleChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFileSelect(selected);
  };

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.dcm"
        onChange={handleChange}
        style={{ display: 'none' }}
        id="file-input"
      />

      {preview ? (
        <div className="upload-preview">
          <div className="preview-image-wrap">
            <img src={preview} alt="Medical image preview" className="preview-image" />
            <div className="scan-overlay">
              <div className="scan-line"></div>
            </div>
            <div className="preview-badge">
              <span className="badge-dot"></span>
              Image Loaded
            </div>
          </div>
          <div className="preview-info">
            <div className="file-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
            </div>
            <div className="file-details">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <button
              className="change-btn"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="upload-empty">
          <div className="upload-icon-wrap">
            <div className="upload-icon-ring"></div>
            <svg className="upload-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <h3 className="upload-title">Drop medical image here</h3>
          <p className="upload-sub">Supports X-Ray, CT Scan, MRI — PNG, JPG, DICOM</p>
          <div className="upload-formats">
            {['X-Ray', 'CT Scan', 'MRI', 'DICOM'].map(f => (
              <span key={f} className="format-tag">{f}</span>
            ))}
          </div>
          <button className="browse-btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Browse Files
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadZone;

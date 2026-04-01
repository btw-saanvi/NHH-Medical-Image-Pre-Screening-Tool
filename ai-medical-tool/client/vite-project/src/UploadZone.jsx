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
      className={`stitch-upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.dcm"
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {file ? (
        <div className="upload-active-view">
           <div className="active-img-container">
             <img src={preview} alt="Scan Preview" className="active-preview-img" />
             <div className="active-overlay">
               <div className="active-badge">✓ Selected</div>
             </div>
           </div>
           <div className="active-details">
             <div className="file-main">
               <span className="file-name">{file.name}</span>
               <span className="file-meta">{(file.size / 1024).toFixed(1)} KB • Medical Image</span>
             </div>
             <button className="change-link" onClick={() => inputRef.current?.click()}>Change file</button>
           </div>
        </div>
      ) : (
        <div className="upload-placeholder-view">
          <div className="upload-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <h3>Drag and drop imaging files</h3>
          <p>Supports RAW, DICOM, JPG, or PNG for standard imaging thresholds.</p>
          <button className="select-link">⊕ Select from Local Storage</button>
        </div>
      )}
    </div>
  );
}

export default UploadZone;

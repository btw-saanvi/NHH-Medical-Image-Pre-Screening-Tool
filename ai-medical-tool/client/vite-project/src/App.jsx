import { useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("image", file);

    const res = await axios.post("http://localhost:5000/upload", formData);
    setResult(res.data);
  };

  return (
    <div style={{ textAlign: "center", padding: "40px" }}>
      <h1>AI Medical Image Pre-Screening Tool</h1>

      <input type="file" onChange={handleFileChange} />

      {preview && (
        <div>
          <h3>Preview:</h3>
          <img src={preview} alt="preview" width="300" />
        </div>
      )}

      <br />

      <button onClick={handleUpload}>Upload & Analyze</button>

      {result && (
        <div style={{ marginTop: "20px" }}>
          <h2>Result:</h2>
          <p>Prediction: {result.prediction}</p>
          <p>Priority: {result.priority}</p>
        </div>
      )}
    </div>
  );
}

export default App;
const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("image"), (req, res) => {
  // FAKE AI LOGIC
  const random = Math.random();

  let prediction = random > 0.5 ? "Abnormal" : "Normal";
  let priority =
    random > 0.7 ? "High" : random > 0.4 ? "Medium" : "Low";

  res.json({
    prediction,
    priority,
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
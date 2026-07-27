import express from "express";
import pipeline from "./run_pipeline.js"; // This now correctly imports the default export

const router = express.Router();

router.post("/run", async (req, res) => {
  console.log("[AUTOMATION] API trigger received");
  
  try {
    // Trigger the pipeline (runs for ALL UNPROCESSED dates by default)
    await pipeline.runPipeline();
    
    res.json({ success: true, message: "Automation script started successfully!" });
  } catch (err) {
    console.error("[AUTOMATION ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
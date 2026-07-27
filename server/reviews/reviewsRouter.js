import express from 'express';
import { fetchGoogleReviews } from './fetchReviews.js';
import { generateGroqReply } from './generateReply.js';
import { postGoogleReply } from './postReply.js';

const router = express.Router();

router.get('/', async (req, res) => {
  console.log("[REVIEWS] Initial load requested by website...");
  try {
    const reviews = await fetchGoogleReviews();
    res.json(reviews);
  } catch (err) {
    console.error("[REVIEWS ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/fetch-new', async (req, res) => {
  console.log("[REVIEWS] 'Fetch New Reviews' button clicked!");
  try {
    const reviews = await fetchGoogleReviews();
    res.json({ success: true, reviews });
  } catch (err) {
    console.error("[REVIEWS ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/generate', async (req, res) => {
  console.log(`[REVIEWS] Generating AI reply for review: ${req.params.id}`);
  try {
    // No DB, so we receive the review context directly from the frontend
    const { review_text, star_rating, store_name, brand } = req.body;
    if (!review_text) return res.status(400).json({ error: 'Review text required' });
    
    const reply = await generateGroqReply({ review_text, star_rating, store_name, brand });
    console.log(`[REVIEWS] Successfully generated AI reply!`);
    res.json({ reply });
  } catch (err) {
    console.error("[REVIEWS ERROR - Groq]", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { replyText, name } = req.body;
    
    // Post reply directly back to Google
    await postGoogleReply(name, replyText); 
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
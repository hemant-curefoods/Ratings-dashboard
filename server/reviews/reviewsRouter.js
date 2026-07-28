import express from 'express';
import { fetchGoogleReviews } from './fetchReviews.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const reviews = await fetchGoogleReviews();
    res.json(reviews);
  } catch (err) {
    console.error("[REVIEWS ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/fetch-new', async (req, res) => {
  try {
    const reviews = await fetchGoogleReviews();
    res.json({ success: true, reviews });
  } catch (err) {
    console.error("[REVIEWS ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Groq } from 'groq-sdk';
import { BRAND_VOICE } from './config.js';
import 'dotenv/config';

export async function generateGroqReply(review) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const brandVoice = BRAND_VOICE[review.brand] || "You are a polite restaurant manager.";
  
  const prompt = `You are a restaurant manager at ${review.store_name}.
${brandVoice}

Customer review (${review.star_rating} stars):
"${review.review_text}"

Write a reply to this review. Follow the brand voice exactly.
Return only the reply text. No explanation. No quotes around it.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.1-8b-instant',
  });
  return completion.choices[0]?.message?.content?.trim() || "Thank you for your feedback!";
}
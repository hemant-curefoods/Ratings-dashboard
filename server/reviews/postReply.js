import { getAuthClient } from './fetchReviews.js';

export async function postGoogleReply(name, replyText) {
  // TEMPORARY BYPASS: Simulate a successful post to Google
  console.log(`[Google API Mock] Successfully posted reply for ${name}:\n"${replyText}"`);
  return true;

  const auth = await getAuthClient();
  
  // 'name' is the full path returned by Google: accounts/*/locations/*/reviews/*
  await auth.request({
    url: `https://mybusinessreviews.googleapis.com/v1/${name}/reply`,
    method: 'PUT',
    data: { comment: replyText }
  });

  return true;
}
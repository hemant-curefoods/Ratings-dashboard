import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function useReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ store: 'All', rating: 'All', status: 'All' });

  const fetchAllReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reviews`);
      const data = await res.json();
      if (Array.isArray(data)) setReviews(data);
      if (!res.ok && data.error) {
        alert(`Failed to load reviews: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllReviews(); }, []);

  const fetchNewReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reviews/fetch-new`);
      const data = await res.json();
      if (data.success && data.reviews) {
        setReviews(data.reviews);
      }
      if (!res.ok && data.error) {
        alert(`Failed to fetch reviews: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateReply = async (review) => {
    try {
      const res = await fetch(`${API_BASE}/api/reviews/${review.id}/generate`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_text: review.review_text,
          star_rating: review.star_rating,
          store_name: review.store_name,
          brand: review.brand
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(`AI Generation Failed: ${data.error}`);
        return;
      }
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, ai_reply: data.reply } : r));
    } catch (err) {
      console.error(err);
      alert("Connection error when reaching backend.");
    }
  };

  const approveReply = async (review, replyText) => {
    try {
      await fetch(`${API_BASE}/api/reviews/${review.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText, name: review.name })
      });
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: 'posted', final_reply: replyText } : r));
    } catch (err) {
      console.error(err);
    }
  };

  const rejectReply = async (id) => {
    // Instantly remove from view since we don't have a DB
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
  };

  const filteredReviews = reviews.filter(r => {
    if (filters.store !== 'All' && r.store_name !== filters.store) return false;
    if (filters.rating !== 'All' && r.star_rating !== Number(filters.rating)) return false;
    if (filters.status !== 'All' && r.status !== filters.status.toLowerCase()) return false;
    return true;
  });

  return { 
    reviews: filteredReviews, loading, filters, setFilters, fetchNewReviews, generateReply, approveReply, rejectReply 
  };
}
import React, { useState, useEffect } from 'react';

export default function ReviewCard({ review, generateReply, approveReply, rejectReply }) {
  const [editedReply, setEditedReply] = useState(review.ai_reply || '');
  const [isGenerating, setIsGenerating] = useState(false);

  // Force the text box to update when the AI reply arrives from the backend
  useEffect(() => {
    if (review.ai_reply) {
      setEditedReply(review.ai_reply);
      setIsGenerating(false);
    }
  }, [review.ai_reply]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await generateReply(review);
    setIsGenerating(false);
  };

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 20,
    border: '1px solid rgba(19, 38, 100, 0.15)',
    borderLeft: '4px solid #132664',
    marginBottom: 16,
    boxShadow: '0 2px 6px rgba(19, 38, 100, 0.03)'
  };
  
  return (
    <div style={cardStyle}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#132664' }}>{review.store_name}</div>
          <div style={{ fontSize: 11, color: 'rgba(19, 38, 100, 0.6)', fontWeight: '600' }}>{review.brand}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#132664', fontWeight: 700, fontSize: "14px" }}>
            {'★'.repeat(review.star_rating)}{'☆'.repeat(5 - review.star_rating)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(19, 38, 100, 0.5)', marginTop: "2px" }}>
            {review.reviewer_name} • {new Date(review.review_date).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Review Content */}
      <div style={{ color: '#132664', fontSize: 13, lineHeight: '1.5', marginBottom: 16, fontStyle: "italic" }}>
        "{review.review_text}"
      </div>

      <hr style={{ borderColor: 'rgba(19, 38, 100, 0.1)', margin: '16px 0' }} />

      {/* AI Reply Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#132664', fontWeight: 700 }}>AI Response Draft</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'rgba(19, 38, 100, 0.05)', color: '#132664', fontWeight: "700", textTransform: 'uppercase' }}>
            {review.status}
          </span>
        </div>
        
        {review.status === 'pending' ? (
          <>
            <textarea 
              value={editedReply} onChange={(e) => setEditedReply(e.target.value)}
              style={{ width: '100%', background: '#ffffff', border: '1px solid #132664', borderRadius: 8, padding: 12, color: '#132664', fontSize: 13, minHeight: 80, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
              placeholder={editedReply ? '' : 'Draft reply or generate automatically...'}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              {!editedReply && (
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating} 
                  style={{ padding: '6px 14px', background: '#132664', color: '#ffffff', border: 'none', borderRadius: 18, cursor: isGenerating ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                  {isGenerating ? 'Generating...' : 'Generate AI Draft'}
                </button>
              )}
              {editedReply && (
                <button 
                  onClick={() => approveReply(review, editedReply)} 
                  style={{ padding: '6px 14px', background: '#132664', color: '#ffffff', border: 'none', borderRadius: 18, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                  ✓ Approve & Post
                </button>
              )}
              {editedReply && (
                <button 
                  onClick={() => rejectReply(review.id)} 
                  style={{ padding: '6px 14px', background: '#ffffff', color: '#132664', border: '1px solid #132664', borderRadius: 18, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                  ✗ Reject
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: 'rgba(19, 38, 100, 0.8)', fontSize: 13, background: 'rgba(19, 38, 100, 0.03)', padding: 12, borderRadius: 8, border: "1px solid rgba(19, 38, 100, 0.08)", lineHeight: "1.4" }}>
            {review.final_reply || review.ai_reply || 'No reply generated.'}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { C, FONT } from '../../theme';

export default function ChatbotWidget({ userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Hello! I'm the KitchenPulse AI Assistant. 👋\n\nI can analyze your dashboard data and answer questions instantly. What would you like to know today?` }
  ]);
  const [inputValue, setInputValue] = useState("");
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const handleSend = (textOrEvent) => {
    if (textOrEvent && textOrEvent.preventDefault) {
      textOrEvent.preventDefault();
    }
    
    const text = typeof textOrEvent === 'string' ? textOrEvent : inputValue;
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', text }]);
    if (typeof textOrEvent !== 'string') setInputValue("");
    
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: "I am currently in visual demonstration mode! My actual data-fetching capabilities are being connected soon. 🚀" 
      }]);
    }, 1500);
  };

  const quickPrompts = [
    "Summarize yesterday's prep times",
    "Show me the worst performing brand",
    "Any alerts for dine-in reviews?"
  ];

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(2, 132, 199, 0); }
          100% { box-shadow: 0 0 0 0 rgba(2, 132, 199, 0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.primary}, #0369a1)`,
          color: '#fff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: isOpen ? 'scale(0.8) rotate(90deg)' : 'scale(1) rotate(0deg)',
          animation: !isOpen ? 'pulse 2s infinite' : 'none'
        }}
        aria-label="Toggle AI Chat"
      >
        {isOpen ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
        )}
      </button>

      {/* Backdrop (Optional, but gives a premium focus feel) */}
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(3px)',
          zIndex: 9997,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease'
        }}
        onClick={() => setIsOpen(false)}
      />

      {/* Chat Window Panel */}
      <div 
        style={{
          position: 'fixed',
          bottom: 100,
          right: 24,
          width: 380,
          height: 600,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9998,
          overflow: 'hidden',
          fontFamily: FONT,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.9)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          border: '1px solid rgba(255,255,255,0.4)'
        }}
      >
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.primary}, #0369a1)`, color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>KitchenPulse AI</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4ade80' }}></span>
                Online (Role: {userRole})
              </div>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, backgroundColor: '#f8fafc' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'slideUp 0.3s ease-out' }}>
              <div 
                style={{ 
                  maxWidth: '85%',
                  padding: '14px 18px',
                  borderRadius: 16,
                  fontSize: 14,
                  lineHeight: 1.5,
                  fontWeight: 500,
                  color: m.role === 'user' ? '#fff' : C.text,
                  background: m.role === 'user' ? `linear-gradient(135deg, ${C.primary}, #0284c7)` : '#fff',
                  border: m.role === 'user' ? 'none' : `1px solid ${C.borderSoft}`,
                  boxShadow: m.role === 'user' ? '0 4px 12px rgba(2, 132, 199, 0.2)' : '0 4px 12px rgba(0,0,0,0.03)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'slideUp 0.3s ease-out' }}>
              <div style={{ padding: '16px 20px', borderRadius: 16, backgroundColor: '#fff', border: `1px solid ${C.borderSoft}`, borderBottomLeftRadius: 4, display: 'flex', gap: 6 }}>
                <span style={{ width: 6, height: 6, backgroundColor: C.muted, borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                <span style={{ width: 6, height: 6, backgroundColor: C.muted, borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></span>
                <span style={{ width: 6, height: 6, backgroundColor: C.muted, borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          
          <div ref={endOfMessagesRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && !isTyping && (
          <div style={{ padding: '0 24px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, backgroundColor: '#f8fafc' }}>
            {quickPrompts.map((prompt, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(prompt)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 20,
                  border: `1px solid ${C.primary}`,
                  backgroundColor: 'rgba(2, 132, 199, 0.05)',
                  color: C.primary,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: FONT,
                  animation: `slideUp 0.3s ease-out ${i * 0.1}s both`
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.05)'}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSend} style={{ padding: '16px 24px', borderTop: `1px solid ${C.borderSoft}`, backgroundColor: '#fff', display: 'flex', gap: 12 }}>
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AI anything..."
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: 24,
              border: `1px solid ${C.borderSoft}`,
              outline: 'none',
              fontFamily: FONT,
              fontSize: 14,
              backgroundColor: '#f8fafc',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = C.primary;
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = C.borderSoft;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            style={{
              width: 48, height: 48, borderRadius: '50%', backgroundColor: inputValue.trim() ? C.primary : C.border, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputValue.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
              boxShadow: inputValue.trim() ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>
    </>
  );
}

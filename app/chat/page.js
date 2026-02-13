"use client"; // This is required in Next.js for real-time features!

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient'; // This uses the hub we made


export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
const [userName, setUserName] = useState("");
const [hasSetName, setHasSetName] = useState(false);

// This checks if they already saved a name on this computer/phone
useEffect(() => {
  const savedName = localStorage.getItem("family-chat-name");
  if (savedName) {
    setUserName(savedName);
    setHasSetName(true);
  }
}, []);
const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // 1. Listen for new messages
    const channel = supabase
      .channel('family-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
          payload => setMessages(current => [...current, payload.new]))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const sendMessage = async (e) => {
e.preventDefault();
    if (!input.trim()) return; // Don't send empty messages

    // --- UPDATE THIS SECTION ---
    const { error } = await supabase
      .from('messages')
      .insert([
        { 
          content: input, 
          user_name: userName // This now uses the name the user typed in!
        }
      ]);
    // ---------------------------

    if (!error) setInput("");
  };

if (!hasSetName) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <h1 className="text-3xl font-extrabold mb-2 text-blue-600">Family Hub</h1>
          <p className="text-gray-500 mb-6 text-sm">Enter your name to join the family chat</p>
          <input 
            className="border-2 border-gray-200 p-3 rounded-xl w-full mb-4 text-black focus:border-blue-500 outline-none transition-all"
            placeholder="e.g. Mom, Uncle Joe"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && userName.trim() && (localStorage.setItem("family-chat-name", userName), setHasSetName(true))}
          />
          <button 
            onClick={() => {
              if (userName.trim()) {
                localStorage.setItem("family-chat-name", userName);
                setHasSetName(true);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl w-full transition-colors shadow-lg"
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-blue-600">Family Chat</h1>
      
      <div className="h-96 border rounded-xl p-4 overflow-y-auto mb-4 bg-gray-100 flex flex-col gap-3">
  {messages.map((m, index) => (
    <div 
      key={index} 
      className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
        m.user_name === 'Me' 
          ? 'bg-blue-600 text-white self-end rounded-tr-none' 
          : 'bg-white text-black self-start rounded-tl-none'
      }`}
    >
      
      <span className="text-[10px] font-bold uppercase opacity-70 block mb-1">
        {m.user_name}
      </span>
      <span className="text-[10px] opacity-50 ml-2">
        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <p className="text-sm">{m.content}</p>
      <div ref={messagesEndRef} />
    </div>
  ))}
</div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input 
          className="border flex-1 p-2 rounded text-black"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded">Send</button>
      </form>
    </div>
  );
}
"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function FamilyChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("");
  const [hasSetName, setHasSetName] = useState(false);
  const messagesEndRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);

  // 1. Load messages and setup Realtime listener (INSERT, DELETE, and UPDATE)
  useEffect(() => {
    const savedName = localStorage.getItem("family-chat-name");
    if (savedName) {
      setUserName(savedName);
      setHasSetName(true);
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    const handleEsc = (e) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('keydown', handleEsc);

    const channel = supabase
      .channel("chat-room")
      .on("postgres_changes", { event: "INSERT", table: "messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on("postgres_changes", { event: "DELETE", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
      })
      // FIXED: Added UPDATE listener so reactions show up in real-time
      .on("postgres_changes", { event: "UPDATE", table: "messages" }, (payload) => {
        setMessages((prev) => 
          prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // 2. Function to send text messages
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    await supabase.from("messages").insert([{ content: input, user_name: userName }]);
    setInput("");
  };

  // 3. Function to upload images
  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file);

    if (uploadError) {
      alert("Error uploading: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    await supabase.from('messages').insert([
      { user_name: userName, image_url: urlData.publicUrl, content: "" }
    ]);
  };

  // 4. Function to delete messages
  const deleteMessage = async (id, msgUserName) => {
    if (msgUserName !== userName) {
      alert("You can only delete your own messages!");
      return;
    }
    if (!window.confirm("Delete this message?")) return;
    await supabase.from("messages").delete().eq("id", id);
  };

  // 5. Function to handle reactions
  const addReaction = async (messageId, emoji) => {
    const message = messages.find(m => m.id === messageId);
    const currentReactions = message.reactions || {};
    
    const newReactions = {
      ...currentReactions,
      [emoji]: (currentReactions[emoji] || 0) + 1
    };

    const { error } = await supabase
      .from("messages")
      .update({ reactions: newReactions })
      .eq("id", messageId);

    if (error) console.error("Error adding reaction:", error.message);
  };

  // UI Effect: Preventing "Background Scroll"
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = selectedImage ? "hidden" : "auto";
    }
  }, [selectedImage]);

  // UI Effect: Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // LOGIN SCREEN
  if (!hasSetName) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border">
          <h1 className="text-3xl font-extrabold mb-2 text-blue-600">Family Hub</h1>
          <p className="text-gray-500 mb-6 text-sm">Enter your name to join</p>
          <input 
            className="border-2 border-gray-200 p-3 rounded-xl w-full mb-4 text-black outline-none focus:border-blue-500"
            placeholder="e.g. Mom, Dad"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button 
            onClick={() => {
              if (userName.trim()) {
                localStorage.setItem("family-chat-name", userName);
                setHasSetName(true);
              }
            }}
            className="bg-blue-600 text-white font-bold py-3 rounded-xl w-full shadow-lg"
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  // MAIN CHAT SCREEN
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border shadow-2xl relative">
      <header className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center shadow-md z-10">
        <span>Family Chat</span>
        <span className="text-xs opacity-80">Hello, {userName}</span>
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">
                {msg.user_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.user_name === userName && (
                <button onClick={() => deleteMessage(msg.id, msg.user_name)} className="text-[10px] opacity-40 hover:opacity-100 hover:text-red-500 transition-all">🗑️</button>
              )}
            </div>

            {msg.content && (
              <div className={`p-3 rounded-2xl max-w-xs shadow-sm ${msg.user_name === userName ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-black border rounded-tl-none'}`}>
                {msg.content}
              </div>
            )}

            {msg.image_url && (
              <div className="mt-1">
                <img 
                  src={msg.image_url} 
                  alt="Shared" 
                  onClick={() => setSelectedImage(msg.image_url)}
                  className="rounded-xl max-w-[250px] border shadow-md cursor-zoom-in hover:scale-[1.03] transition-all duration-300 hover:opacity-90" 
                />
              </div>
            )}

            {/* Reactions UI */}
            <div className={`flex flex-wrap gap-1 mt-1.5 ${msg.user_name === userName ? 'justify-end' : 'justify-start'}`}>
              {['❤️', '👍', '😂', '😮'].map((emoji) => {
                const count = msg.reactions?.[emoji] || 0;
                return (
                  <button
                    key={emoji}
                    onClick={() => addReaction(msg.id, emoji)}
                    className={`px-2 py-0.5 rounded-full text-xs transition-all active:scale-75 flex items-center gap-1 border shadow-sm ${
                      count > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-400 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span className="font-bold">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={sendMessage} className="p-4 border-t flex items-center gap-3 bg-white">
        <input type="file" accept="image/*" onChange={uploadImage} className="hidden" id="image-upload" />
        <label htmlFor="image-upload" className="cursor-pointer p-2 hover:bg-gray-100 rounded-full border border-gray-100 shadow-sm transition-all">
          <span className="text-xl">📸</span>
        </label>
        <input 
          className="flex-1 border rounded-full px-5 py-2.5 text-black outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-all"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full w-11 h-11 flex items-center justify-center shadow-lg transition-transform active:scale-95">→</button>
      </form>

      {/* FULL SCREEN ZOOM OVERLAY */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white text-4xl">×</button>
          <img 
            src={selectedImage} 
            className="max-w-full max-h-full rounded-md shadow-2xl transition-all duration-300 scale-100"
            alt="Full size" 
          />
        </div>
      )}
    </div>
  );
}
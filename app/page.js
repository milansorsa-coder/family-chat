"use client";
import { useState, useEffect } from "react";
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

  // 1. Load messages and setup Realtime listener
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

    const channel = supabase
      .channel("chat-room")
      .on("postgres_changes", { event: "INSERT", table: "messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // 2. Function to send text messages
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    await supabase.from("messages").insert([
      { content: input, user_name: userName }
    ]);
    setInput("");
  };

  // 3. Function to upload images
  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    // Upload to 'chat-images' bucket
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file);

    if (error) {
      alert("Error uploading: " + error.message);
      return;
    }

    // Get Public URL
    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    // Insert into database
    await supabase.from('messages').insert([
      { user_name: userName, image_url: urlData.publicUrl, content: "" }
    ]);
  };

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
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border shadow-2xl">
      <header className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center">
        <span>Family Chat</span>
        <span className="text-xs opacity-80">Logged in as {userName}</span>
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-gray-400 mb-1 px-1">
              {msg.user_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {msg.content && (
              <div className={`p-3 rounded-2xl max-w-xs shadow-sm ${msg.user_name === userName ? 'bg-blue-600 text-white' : 'bg-white text-black border'}`}>
                {msg.content}
              </div>
            )}

            {msg.image_url && (
              <img 
                src={msg.image_url} 
                alt="Shared" 
                className="mt-1 rounded-xl max-w-[250px] border shadow-sm" 
              />
            )}
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <form onSubmit={sendMessage} className="p-4 border-t flex items-center gap-2 bg-white">
        <input 
          type="file" 
          accept="image/*" 
          onChange={uploadImage} 
          className="hidden" 
          id="image-upload" 
        />
        <label htmlFor="image-upload" className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-all border border-gray-200">
          <span className="text-xl">📸</span>
        </label>

        <input 
          className="flex-1 border rounded-full px-4 py-2 text-black outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center font-bold">
          →
        </button>
      </form>
    </div>
  );
}
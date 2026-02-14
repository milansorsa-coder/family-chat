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
  const [password, setPassword] = useState("");
  const [hasAuthorized, setHasAuthorized] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Initial Load: Auth and Messages
  useEffect(() => {
    // Check for existing session
    const isAuth = localStorage.getItem("family-auth");
    if (isAuth === "true") setHasAuthorized(true);

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
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // 2. Realtime & Presence: Starts only when name is ready
  useEffect(() => {
    if (!userName || !hasSetName) return;

    const channel = supabase.channel("chat-room", {
      config: { presence: { key: userName } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(Object.keys(state));
      })
      .on("postgres_changes", { event: "INSERT", table: "messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on("postgres_changes", { event: "DELETE", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "UPDATE", table: "messages" }, (payload) => {
        setMessages((prev) => 
          prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userName, hasSetName]);

  // UI Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    const { data: isValid, error } = await supabase.rpc('verify_family_password', { 
      input_password: password 
    });
    if (isValid) {
      localStorage.setItem("family-auth", "true");
      setHasAuthorized(true);
    } else {
      alert("❌ Incorrect Password");
      setPassword("");
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    await supabase.from("messages").insert([{ content: input, user_name: userName }]);
    setInput("");
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (uploadError) return alert(uploadError.message);

    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    await supabase.from('messages').insert([{ user_name: userName, image_url: urlData.publicUrl, content: "" }]);
  };

  const addReaction = async (messageId, emoji) => {
    const message = messages.find(m => m.id === messageId);
    const newReactions = { ...message.reactions, [emoji]: (message.reactions?.[emoji] || 0) + 1 };
    await supabase.from("messages").update({ reactions: newReactions }).eq("id", messageId);
  };

  const logout = () => {
    if (window.confirm("Log out and lock app?")) {
      localStorage.removeItem("family-chat-name");
      localStorage.removeItem("family-auth");
      window.location.reload(); // Hard reset to clear states
    }
  };

  // 1. Password Screen
  if (!hasAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6">
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <span className="text-4xl mb-4 block">🔐</span>
          <h1 className="text-2xl font-bold mb-2">Family Vault</h1>
          <input 
            type="password" autoFocus placeholder="Password" value={password}
            className="border-2 p-3 rounded-xl w-full mb-4 text-center outline-none focus:border-blue-500 text-black"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="bg-slate-900 text-white font-bold py-3 rounded-xl w-full">Unlock</button>
        </form>
      </div>
    );
  }

  // 2. Name Screen
  if (!hasSetName) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border text-black">
          <h1 className="text-3xl font-extrabold mb-2 text-blue-600">Family Hub</h1>
          <input 
            className="border-2 p-3 rounded-xl w-full mb-4 outline-none focus:border-blue-500"
            placeholder="Your Name" value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button 
            onClick={() => { if(userName.trim()){ localStorage.setItem("family-chat-name", userName); setHasSetName(true); }}}
            className="bg-blue-600 text-white font-bold py-3 rounded-xl w-full"
          >Join Chat</button>
        </div>
      </div>
    );
  }

  // 3. Main Chat
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border shadow-2xl relative text-black">
      <header className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>Family Chat</span>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          </div>
          <button onClick={logout} className="text-[10px] opacity-70 hover:underline">Log out ({userName})</button>
        </div>
      </header>

      {/* Online Now Indicator */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 overflow-x-auto">
        <div className="flex -space-x-2">
          {onlineUsers.map((user) => (
            <div key={user} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">
              {user.charAt(0)}
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400 font-bold uppercase">Online Now</span>
          <span className="text-[11px] text-blue-600 font-medium">{onlineUsers.length} active</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-gray-400 mb-1 px-1">{msg.user_name}</span>
            {msg.content && (
              <div className={`p-3 rounded-2xl max-w-xs shadow-sm ${msg.user_name === userName ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                {msg.content}
              </div>
            )}
            {msg.image_url && <img src={msg.image_url} onClick={() => setSelectedImage(msg.image_url)} className="rounded-xl max-w-[200px] mt-1 border shadow-sm cursor-zoom-in" />}
            
            <div className="flex gap-1 mt-1.5">
              {['❤️', '👍', '😂'].map(emoji => (
                <button key={emoji} onClick={() => addReaction(msg.id, emoji)} className="px-2 py-0.5 rounded-full text-xs border bg-white">
                  {emoji} {msg.reactions?.[emoji] || ''}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t flex items-center gap-3 bg-white">
        <input type="file" accept="image/*" onChange={uploadImage} className="hidden" id="img-up" />
        <label htmlFor="img-up" className="cursor-pointer p-2 hover:bg-gray-100 rounded-full border">📸</label>
        <input className="flex-1 border rounded-full px-5 py-2.5 outline-none bg-gray-50" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message..." />
        <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-full w-11 h-11">→</button>
      </form>

      {/* Fullscreen Image Overlay */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-w-full max-h-full rounded-md" />
        </div>
      )}
    </div>
  );
}
"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// CHANGE THIS to your exact name to see the Admin Button
const ADMIN_NAME = "milan_AdMod86"; 

export default function FamilyChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("");
  const [hasSetName, setHasSetName] = useState(false);
  const [password, setPassword] = useState("");
  const [hasAuthorized, setHasAuthorized] = useState(false);
  const [presenceState, setPresenceState] = useState({}); 
  const [selectedImage, setSelectedImage] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Initial Setup: Load existing session data
  useEffect(() => {
    if (localStorage.getItem("family-auth") === "true") setHasAuthorized(true);
    const savedName = localStorage.getItem("family-chat-name");
    if (savedName) {
      setUserName(savedName);
      setHasSetName(true);
    }

    const fetchMessages = async () => {
      const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    const handleEsc = (e) => { if (e.key === 'Escape') setSelectedImage(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // 2. Realtime Engine: Messages, Reactions, Presence, and Seen status
  useEffect(() => {
    if (!hasAuthorized || !hasSetName || !userName) return;

    const channel = supabase.channel("family-hub-main", {
      config: { presence: { key: userName } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setPresenceState(channel.presenceState());
      })
      .on("postgres_changes", { event: "INSERT", table: "messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on("postgres_changes", { event: "DELETE", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        if (!payload.old.id) setMessages([]); // Full wipe detection
      })
      .on("postgres_changes", { event: "UPDATE", table: "messages" }, (payload) => {
        setMessages((prev) => prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            online_at: new Date().toISOString(),
            last_seen: new Date().toISOString() 
          });
        }
      });

    // Heartbeat for "Seen" status
    const interval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        await channel.track({ 
            online_at: new Date().toISOString(),
            last_seen: new Date().toISOString() 
        });
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [hasAuthorized, hasSetName, userName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    const { data: isValid } = await supabase.rpc('verify_family_password', { input_password: password });
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
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (error) return alert("Upload failed");
    const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    await supabase.from('messages').insert([{ user_name: userName, image_url: data.publicUrl, content: "" }]);
  };

  const addReaction = async (messageId, emoji) => {
    const message = messages.find(m => m.id === messageId);
    const newReactions = { ...message.reactions, [emoji]: (message.reactions?.[emoji] || 0) + 1 };
    await supabase.from("messages").update({ reactions: newReactions }).eq("id", messageId);
  };

  const clearAllMessages = async () => {
    if (window.confirm("⚠️ Delete EVERY message for everyone?")) {
      const { error } = await supabase.from("messages").delete().neq("id", 0);
      if (error) alert("Error: " + error.message);
    }
  };

  const logout = () => {
    if (confirm("Log out?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const getSeenBy = (msgTime) => {
    const seenBy = [];
    const time = new Date(msgTime).getTime();
    Object.entries(presenceState).forEach(([name, presences]) => {
      if (name === userName) return;
      const isSeen = presences.some(p => p.last_seen && new Date(p.last_seen).getTime() >= time);
      if (isSeen) seenBy.push(name);
    });
    return seenBy;
  };

  // --- Screens ---
  if (!hasAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6 text-black">
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center border">
          <span className="text-4xl mb-4 block">🔐</span>
          <h1 className="text-2xl font-bold mb-6">Family Vault</h1>
          <input type="password" autoFocus placeholder="Password" value={password} className="border-2 p-3 rounded-xl w-full mb-4 text-center outline-none focus:border-blue-500" onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="bg-slate-900 text-white font-bold py-3 rounded-xl w-full">Unlock</button>
        </form>
      </div>
    );
  }

  if (!hasSetName) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-black">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border">
          <h1 className="text-3xl font-extrabold mb-6 text-blue-600">Family Hub</h1>
          <input className="border-2 p-3 rounded-xl w-full mb-4 outline-none focus:border-blue-500" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <button onClick={() => { if(userName.trim()){ localStorage.setItem("family-chat-name", userName); setHasSetName(true); }}} className="bg-blue-600 text-white font-bold py-3 rounded-xl w-full shadow-lg">Join Chat</button>
        </div>
      </div>
    );
  }

  const onlineUsersList = Object.keys(presenceState);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border shadow-2xl relative text-black">
      <header className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>Family Chat</span>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
          </div>
          <button onClick={logout} className="text-[10px] opacity-70 hover:underline text-left">Log out ({userName})</button>
        </div>

        {/* Case-insensitive Admin Check */}
        {userName.toLowerCase() === ADMIN_NAME.toLowerCase() && (
          <button onClick={clearAllMessages} className="bg-red-500 hover:bg-red-600 text-[10px] px-3 py-1 rounded-full border border-red-300">🗑️ Clear Chat</button>
        )}
      </header>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 overflow-x-auto min-h-[52px]">
        <div className="flex -space-x-2">
          {onlineUsersList.map((user) => (
            <div key={user} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">{user.charAt(0)}</div>
          ))}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Online Now</span>
          <span className="text-[11px] text-blue-600 font-medium">{onlineUsersList.length} active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {messages.map((msg) => {
          const seenList = getSeenBy(msg.created_at);
          const isMine = msg.user_name === userName;
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-gray-400 mb-1 px-1 font-semibold uppercase">{msg.user_name}</span>
              
              {msg.content && (
                <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm ${isMine ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                  {msg.content}
                </div>
              )}
              
              {msg.image_url && <img src={msg.image_url} onClick={() => setSelectedImage(msg.image_url)} className="rounded-xl max-w-[200px] mt-1 border shadow-sm cursor-zoom-in" alt="Shared" />}
              
              {isMine && seenList.length > 0 && (
                <span className="text-[9px] text-gray-400 mt-1 italic px-1">✓ Seen by {seenList.join(", ")}</span>
              )}

              <div className="flex gap-1 mt-1.5">
                {['❤️', '👍', '😂'].map(emoji => (
                  <button key={emoji} onClick={() => addReaction(msg.id, emoji)} className={`px-2 py-0.5 rounded-full text-xs border transition-all ${msg.reactions?.[emoji] ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                    {emoji} {msg.reactions?.[emoji] || ''}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t flex items-center gap-3 bg-white">
        <input type="file" accept="image/*" onChange={uploadImage} className="hidden" id="img-up" />
        <label htmlFor="img-up" className="cursor-pointer p-2 hover:bg-gray-100 rounded-full border shadow-sm">📸</label>
        <input className="flex-1 border rounded-full px-5 py-2.5 outline-none bg-gray-50" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
        <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-full w-11 h-11 shadow-lg active:scale-95 transition-transform">→</button>
      </form>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-w-full max-h-full rounded-md shadow-2xl" alt="Zoomed" />
        </div>
      )}
    </div>
  );
}
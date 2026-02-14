"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

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
  }, []);

  // REALTIME ENGINE - Optimized for Presence
  useEffect(() => {
    if (!hasAuthorized || !hasSetName || !userName) return;

    // Use a very specific channel name
    const channel = supabase.channel("family_v1", {
      config: { presence: { key: userName } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        console.log("Presence Syncing...", state);
        setOnlineUsers(Object.keys(state));
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", key);
      })
      .on("postgres_changes", { event: "*", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") setMessages((prev) => [...prev, payload.new]);
        if (payload.eventType === "DELETE") setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Connected to Realtime!");
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasAuthorized, hasSetName, userName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const { data: isValid } = await supabase.rpc('verify_family_password', { input_password: password });
    if (isValid) {
      localStorage.setItem("family-auth", "true");
      setHasAuthorized(true);
    } else { alert("❌ Incorrect Password"); setPassword(""); }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    await supabase.from("messages").insert([{ content: input, user_name: userName }]);
    setInput("");
  };

  // Render Logic
  if (!hasAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6 text-black">
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-6">Family Vault</h1>
          <input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border-2 p-3 rounded-xl w-full mb-4 text-center outline-none" />
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
          <input className="border-2 p-3 rounded-xl w-full mb-4 outline-none" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <button onClick={() => { if(userName.trim()){ localStorage.setItem("family-chat-name", userName); setHasSetName(true); }}} className="bg-blue-600 text-white font-bold py-3 rounded-xl w-full">Join Chat</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border shadow-2xl relative text-black">
      <header className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>Family Chat</span>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
          </div>
          <span className="text-[10px] opacity-70">Logged in as {userName}</span>
        </div>
      </header>

      {/* ONLINE BAR */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-gray-400 mb-1 px-1 uppercase font-semibold">{msg.user_name}</span>
            <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm ${msg.user_name === userName ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t flex items-center gap-3 bg-white">
        <input className="flex-1 border rounded-full px-5 py-2.5 outline-none bg-gray-50" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
        <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-full w-11 h-11 shadow-lg">→</button>
      </form>
    </div>
  );
}
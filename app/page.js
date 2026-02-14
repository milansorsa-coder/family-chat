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
  const [onlineUsers, setOnlineUsers] = useState({}); // Changed to object for presence data
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

  // REALTIME & SEEN ENGINE
  useEffect(() => {
    if (!hasAuthorized || !hasSetName || !userName) return;

    const channel = supabase.channel("family_v1", {
      config: { presence: { key: userName } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(state);
      })
      .on("postgres_changes", { event: "*", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") setMessages((prev) => [...prev, payload.new]);
        if (payload.eventType === "DELETE") setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track presence WITH a last_seen timestamp
          await channel.track({ 
            online_at: new Date().toISOString(),
            last_seen: new Date().toISOString() 
          });
        }
      });

    // Update "last_seen" every 10 seconds while tab is active
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

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    await supabase.from("messages").insert([{ content: input, user_name: userName }]);
    setInput("");
  };

  // Helper to check who has seen a message
  const getSeenBy = (msgTime) => {
    const seenBy = [];
    Object.entries(onlineUsers).forEach(([name, presences]) => {
      if (name === userName) return; // Don't show yourself
      const lastSeen = presences[0]?.last_seen;
      if (lastSeen && new Date(lastSeen) > new Date(msgTime)) {
        seenBy.push(name);
      }
    });
    return seenBy;
  };

  if (!hasAuthorized) return (/* ... Same Password UI ... */ <div className="p-10 text-center">Please Unlock Vault</div>);
  if (!hasSetName) return (/* ... Same Name UI ... */ <div className="p-10 text-center">Please Enter Name</div>);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border shadow-2xl relative text-black">
      <header className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center">
        <span>Family Chat</span>
        <span className="text-[10px] opacity-70">{userName}</span>
      </header>

      {/* ONLINE BAR */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="flex -space-x-2">
          {Object.keys(onlineUsers).map((user) => (
            <div key={user} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white uppercase">
              {user.charAt(0)}
            </div>
          ))}
        </div>
        <span className="text-[11px] text-blue-600 font-medium">{Object.keys(onlineUsers).length} active</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {messages.map((msg) => {
          const seenList = getSeenBy(msg.created_at);
          return (
            <div key={msg.id} className={`flex flex-col ${msg.user_name === userName ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-gray-400 mb-1 px-1 uppercase font-semibold">{msg.user_name}</span>
              <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm ${msg.user_name === userName ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                {msg.content}
              </div>
              
              {/* SEEN INDICATOR */}
              {msg.user_name === userName && seenList.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-400 font-medium animate-fade-in">
                  <span>✓ Seen by {seenList.join(", ")}</span>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t flex items-center gap-3 bg-white">
        <input className="flex-1 border rounded-full px-5 py-2.5 outline-none bg-gray-50" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
        <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-full w-11 h-11 shadow-lg">→</button>
      </form>
    </div>
  );
}
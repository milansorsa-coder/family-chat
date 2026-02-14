"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase"; // Use your existing supabase client

export default function PushInitializer() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("✅ SW Registered"))
        .catch((err) => console.error("❌ SW Failed", err));
    }
  }, []);

  const subscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("You need to allow notifications for this to work!");
        return;
      }

      // Subscribe to Push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Save to Supabase (Change 'user_name' to how you track users)
      const userName = localStorage.getItem("userName") || "Family Member";
      await supabase.from("push_subscriptions").insert([{
        user_name: userName,
        subscription_data: subscription,
      }]);

      alert("🎉 Notifications Linked!");
    } catch (error) {
      console.error("Error subscribing:", error);
    }
  };

  return (
    <button 
      onClick={subscribeUser}
      className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg"
    >
      🔔 Link App
    </button>
  );
}
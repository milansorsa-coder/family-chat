import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import WebPush from "https://esm.sh/web-push@3.6.6"

const PUBLIC_VAPID = Deno.env.get('VAPID_PUBLIC_KEY')!;
const PRIVATE_VAPID = Deno.env.get('VAPID_PRIVATE_KEY')!;

WebPush.setVapidDetails(
  'mailto:milan.sorsa@gmail.com',
  PUBLIC_VAPID,
  PRIVATE_VAPID
);

serve(async (req) => {
  const { record } = await req.json(); // The new message from the database webhook

  // 1. Initialize Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

// 2. Get all subscriptions (except the sender)
const { data: subs, error } = await supabase
  .from('push_subscriptions')
  .select('subscription_data')
  .neq('user_name', record.user_name);

// Add this safety check!
if (error || !subs || !Array.isArray(subs)) {
  console.error("No subscriptions found or error fetching:", error);
  return new Response(JSON.stringify({ message: "No subscribers" }), { status: 200 });
}

// 3. Send notifications
const pushPromises = subs.map((sub: any) => {
  return WebPush.sendNotification(
    sub.subscription_data,
    JSON.stringify({
      title: `New Message from ${record.user_name}`,
      message: record.content || "Sent an image 📸",
    })
  ).catch(err => console.error("Push failed for one user:", err));
});

  await Promise.allSettled(pushPromises || []);

  return new Response(JSON.stringify({ done: true }), { 
    headers: { "Content-Type": "application/json" } 
  });
});
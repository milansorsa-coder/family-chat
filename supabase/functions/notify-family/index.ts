import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// Switching to the NPM specifier which uses a different bundling path
import webpush from "npm:web-push@3.6.6"

serve(async (req) => {
  try {
    const { record } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')

    const vapidKeys = {
      publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
      subject: 'mailto:milan.sorsa@gmail.com'
    }

    const notifications = (subs || []).map(async (sub) => {
      try {
        const pushConfig = typeof sub.subscription_data === 'string' 
          ? JSON.parse(sub.subscription_data) 
          : sub.subscription_data

        // Using the default export from the npm package
        return await webpush.sendNotification(
          pushConfig,
          JSON.stringify({
            title: `Message from ${record.user_name || 'Family'}`,
            body: record.content || 'New update!',
          }),
          { vapidDetails: vapidKeys }
        )
      } catch (e) {
        console.error("Push failed for one user:", e.message)
      }
    })
console.log("Total subs found:", subs?.length);
console.log("Sender name:", record.user_name);
console.log("VAPID Public Key being used:", Deno.env.get('VAPID_PUBLIC_KEY')?.substring(0, 10) + "...");
    await Promise.all(notifications)

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
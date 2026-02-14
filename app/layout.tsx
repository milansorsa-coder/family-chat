import type { Metadata } from "next";
import "./globals.css";
import PushInitializer from "@/components/PushInitializer";
import React from "react"; // Ensure React is imported

export const metadata: Metadata = {
  title: "Family Hub",
  description: "Our Private Family Vault",
  manifest: "/manifest.json",
};



export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

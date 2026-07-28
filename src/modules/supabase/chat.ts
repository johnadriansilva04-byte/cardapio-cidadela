import { useEffect, useState } from "react";
import { supabase } from "./client";

type ChatMessage = {
  id: number;
  user_id: string;
  role: "user" | "pracinha";
  text: string;
  timestamp: string;
};

type ChatSession = {
  id: string;
  user_id: string;
  session_type: string;
  created_at: string;
};

export function usePracinhaChat(sessionType: string = "iq_test") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Carregar mensagens anteriores ao montar
  useEffect(() => {
    async function loadMessages() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", userId)
        .eq("session_type", sessionType)
        .order("timestamp", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
      } else {
        setMessages(data || []);
      }
      setIsLoading(false);
    }

    loadMessages();
  }, [userId, sessionType]);

  // Subscription para mensagens em tempo real
  useEffect(() => {
    const subscription = supabase
      .channel("chat_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMessage]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  async function sendMessage(text: string, role: "user" | "pracinha") {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        role,
        text,
        session_type: sessionType,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return null;
    }

    return data;
  }

  async function clearChat() {
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", userId)
      .eq("session_type", sessionType);

    if (error) {
      console.error("Error clearing chat:", error);
      return false;
    }

    setMessages([]);
    return true;
  }

  return {
    messages,
    isLoading,
    userId,
    sendMessage,
    clearChat,
  };
}

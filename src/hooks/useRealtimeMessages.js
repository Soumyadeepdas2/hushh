// ---------------------------------------------------------------------------
// Realtime hook for a single conversation's messages.
//
// Supabase Realtime (postgres_changes) respects RLS: a client only receives
// events for rows it is authorized to SELECT. A user therefore only ever
// receives message events for conversations they participate in.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeMessages(conversationId, onEvent) {
  useEffect(() => {
    if (!conversationId) return undefined

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => onEvent(payload),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, onEvent])
}

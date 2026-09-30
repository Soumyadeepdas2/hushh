

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

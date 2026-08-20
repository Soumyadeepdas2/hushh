// ---------------------------------------------------------------------------
// Realtime hook for the conversation list.
//
// Subscribes to changes on the conversations table with no filter; RLS on
// conversations ensures only events for conversations the caller participates
// in are delivered.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeConversations(onEvent) {
  useEffect(() => {
    const channel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => onEvent(payload),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onEvent])
}

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const listeners: Set<() => void> = new Set();
const broadcastChannel = new BroadcastChannel('app_updates');

// Listen for cross-tab messages
broadcastChannel.onmessage = (event) => {
  if (event.data === 'refresh') {
    listeners.forEach(l => l());
  }
};

export const refreshAllQueries = () => {
  listeners.forEach(l => l());
  broadcastChannel.postMessage('refresh');
};

/**
 * Custom hook for fetching data with support for manual refresh and optional Supabase Realtime sync.
 * @param fetcher Async function to fetch data.
 * @param deps Dependencies for the fetcher.
 * @param tableName Optional Supabase table name for real-time subscription.
 */
export function useOnlineQuery<T>(
  fetcher: () => Promise<T>, 
  deps: any[] = [], 
  tableName?: string
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  const load = async () => {
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      console.error('Query fetch error:', err);
    }
  };

  useEffect(() => {
    load();
    
    // Add to manual listeners (triggered by local mutations)
    const currentLoad = load;
    listeners.add(currentLoad);

    // Setup Supabase Realtime subscription if tableName is provided
    let channel: any;
    if (tableName) {
      const channelName = `realtime:${tableName}-${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => {
            console.log(`Realtime change in ${tableName}:`, payload);
            load(); // Re-fetch data on any change
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to Realtime for ${tableName}`);
          }
        });
    }

    return () => {
      listeners.delete(currentLoad);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [...deps, tableName]);

  return data;
}

export const useLiveQuery = useOnlineQuery;


import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async (s: Session | null) => {
      if (!s) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', s.user.id)
        .maybeSingle();
      setIsAdmin(data !== null);
    };

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void checkAdmin(data.session).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      (async () => {
        await checkAdmin(newSession);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, isAdmin, loading };
}

import { getSupabaseClient, isSupabaseEnabled } from './supabase';

export interface GameData {
  id: string;
  title: string;
  creator: string;
  thumbnail: string;
  likes: string;
  playing: number;
  mapData?: any;
  skybox?: string;
}

export const dataService = {
  // --- GAMES ---
  async getGames(): Promise<GameData[]> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching games from Supabase:', err);
        return [];
      }
    } else {
      const res = await fetch('/api/games');
      return res.json();
    }
  },

  async saveGame(game: any) {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('games')
        .upsert({
          id: game.id || undefined,
          title: game.title,
          creator: game.creator,
          thumbnail: game.thumbnail,
          map_data: game.mapData,
          skybox: game.skybox,
          likes: game.likes || '0%',
          playing: game.playing || 0
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game)
      });
      return res.json();
    }
  },

  async updateUsername(uid: string, currentUsername: string, newUsername: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('users')
        .update({ username: newUsername, display_name: newUsername })
        .eq('username', currentUsername);
      if (error) throw error;
    } else {
      // For shared backend, we'd normally call an API, but since the user has Firestore access here:
      // We'll let App.tsx handle it if not Supabase, OR add a fallback here if needed.
      // However, we want to unify. Let's assume the API handles it:
      const res = await fetch(`/api/user/${currentUsername}/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername })
      });
      if (!res.ok) throw new Error('Failed to update username');
    }
  },

  // --- USERS ---
  normalizeUser(userData: any): any {
    if (!userData) return null;
    return {
      uid: userData.uid,
      username: userData.username,
      displayName: userData.display_name || userData.displayName || userData.username,
      avatarUrl: userData.avatar_url || userData.avatarUrl,
      robux: userData.robux ?? 0,
      drovis: userData.drovis ?? 0,
      rank: userData.rank || 'Standard',
      avatarConfig: userData.avatar_config || userData.avatarConfig,
      settings: userData.settings,
      inventory: userData.inventory || [],
      gallery: userData.gallery || [],
      lastUsernameChange: userData.last_username_change || userData.lastUsernameChange,
      usernameChangeCards: userData.username_change_cards ?? userData.usernameChangeCards ?? 1
    };
  },

  async login(username: string, password?: string) {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      try {
        let { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();
        
        if (error && error.code === 'PGRST116') {
          // User not found, create one
          const isGlidrovia = username.toLowerCase() === 'glidrovia';
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              uid: `sb-${Math.random().toString(36).substr(2, 9)}`,
              username,
              display_name: username,
              robux: isGlidrovia ? 999999 : 1540,
              drovis: isGlidrovia ? 999999 : 400,
              rank: isGlidrovia ? 'Platinum' : 'Standard',
              username_change_cards: 1,
              avatar_config: {
                bodyColors: {
                  head: '#F5CD30', torso: '#0047AB', leftArm: '#F5CD30', rightArm: '#F5CD30', leftLeg: '#A2C429', rightLeg: '#A2C429'
                }
              }
            })
            .select()
            .single();
          if (createError) throw createError;
          return this.normalizeUser(newUser);
        }
        if (error) throw error;
        return this.normalizeUser(user);
      } catch (err) {
        console.error('Login error with Supabase:', err);
        // Fallback to local login if Supabase fails
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        return res.json();
      }
    } else {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return res.json();
    }
  },

  async updateAvatar(username: string, config: any) {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('users')
        .update({ avatar_config: config })
        .eq('username', username);
      if (error) throw error;
      return { success: true };
    } else {
      const res = await fetch(`/api/user/${username}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return res.json();
    }
  },

  // --- UPLOADS ---
  async uploadFile(file: File): Promise<string> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Intentamos con 'assets' (plural) primero, luego con 'asset' (singular) si el usuario lo creó así
      const bucketName = 'assets'; 
      
      try {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file);

        if (uploadError) {
          // Si falla por bucket no encontrado, intentamos con 'asset'
          if (uploadError.message?.includes('not found')) {
            const { error: retryError } = await supabase.storage
              .from('asset')
              .upload(filePath, file);
            if (retryError) throw retryError;
            
            const { data } = supabase.storage
              .from('asset')
              .getPublicUrl(filePath);
            return data.publicUrl;
          }
          throw uploadError;
        }

        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        return data.publicUrl;
      } catch (err: any) {
        console.error('Error uploading to Supabase Storage:', err);
        throw err;
      }
    } else {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      return data.url;
    }
  },

  async searchUsers(query: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return (data || []).map(u => this.normalizeUser(u));
    } else {
      const res = await fetch(`/api/users?q=${query}`);
      return res.json();
    }
  },

  async updateSettings(username: string, settings: any): Promise<void> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('users')
        .update({ settings })
        .eq('username', username);
      if (error) throw error;
    } else {
      await fetch(`/api/user/${username}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
    }
  },

  async updateGallery(username: string, gallery: string[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('users')
        .update({ gallery })
        .eq('username', username);
      if (error) throw error;
    } else {
      await fetch(`/api/user/${username}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery })
      });
    }
  },

  async purchaseItem(username: string, item: any): Promise<any> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (fetchError) throw fetchError;

      const currency = item.currency === 'drovis' ? 'drovis' : 'robux';
      if (user[currency] < item.price) throw new Error('Insufficient funds');

      const { data, error } = await supabase
        .from('users')
        .update({ 
          [currency]: user[currency] - item.price,
          inventory: [...(user.inventory || []), item.id]
        })
        .eq('username', username)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const res = await fetch('/api/user/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, item })
      });
      return res.json();
    }
  },

  async getStudioData(username: string): Promise<any> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('studio_data')
        .select('*')
        .eq('username', username)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || { mapData: [] };
    } else {
      const res = await fetch(`/api/user/${username}/studio`);
      return res.json();
    }
  },

  async saveStudioData(username: string, mapData: any): Promise<void> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('studio_data')
        .upsert({ username, map_data: mapData, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      await fetch(`/api/user/${username}/studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapData })
      });
    }
  },

  async deleteGame(gameId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);
      if (error) throw error;
    } else {
      await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
    }
  },

  async getGamesByCreator(username: string): Promise<GameData[]> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('creator', username);
      if (error) throw error;
      return data || [];
    } else {
      const res = await fetch(`/api/games?creator=${username}`);
      return res.json();
    }
  },

  async updateGlobalSettings(settings: any): Promise<void> {
    const supabase = getSupabaseClient();
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('global_settings')
        .upsert({ id: 'main', ...settings, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
  },

  // --- REAL-TIME SUBSCRIPTIONS ---
  subscribeToUsers(callback: (users: any[]) => void): () => void {
    const client = getSupabaseClient();
    if (isSupabaseEnabled() && client) {
      try {
        const channel = client
          .channel('public:users_all')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async () => {
            const { data } = await client.from('users').select('*').limit(50);
            if (data) callback(data.map((u: any) => this.normalizeUser(u)));
          })
          .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Supabase real-time error: Asegúrate de que las réplicas (Realtime) estén activadas para la tabla "users" en tu dashboard de Supabase.');
            }
          });
        
        // Initial fetch
        client.from('users').select('*').limit(50).then(({ data, error }: any) => {
          if (error) console.error('Initial users fetch error:', error);
          if (data) callback(data.map((u: any) => this.normalizeUser(u)));
        });

        return () => {
          client.removeChannel(channel);
        };
      } catch (err) {
        console.error('Error setting up users subscription:', err);
        return () => {};
      }
    } else {
      // Fallback: poll or just return empty cleanup
      return () => {};
    }
  },

  subscribeToGlobalSettings(callback: (settings: any) => void): () => void {
    const client = getSupabaseClient();
    if (isSupabaseEnabled() && client) {
      try {
        const channel = client
          .channel('public:settings_global')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, async () => {
            const { data } = await client.from('global_settings').select('*').eq('id', 'main').single();
            if (data) callback(data);
          })
          .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Supabase real-time error: Asegúrate de que las réplicas (Realtime) estén activadas para la tabla "global_settings" en tu dashboard de Supabase.');
            }
          });

        // Initial fetch
        client.from('global_settings').select('*').eq('id', 'main').single().then(({ data, error }: any) => {
          if (error && error.code !== 'PGRST116') console.error('Initial global_settings fetch error:', error);
          if (data) callback(data);
        });

        return () => {
          client.removeChannel(channel);
        };
      } catch (err) {
        console.error('Error setting up global_settings subscription:', err);
        return () => {};
      }
    } else {
      return () => {};
    }
  },

  subscribeToUser(username: string, callback: (user: any) => void): () => void {
    const safeUsername = (username || '').trim();
    if (!safeUsername) return () => {};
    const client = getSupabaseClient();
    if (isSupabaseEnabled() && client) {
      try {
        const channel = client
          .channel(`public:users:username:${safeUsername}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'users',
            filter: `username=eq.${safeUsername}`
          }, async () => {
            const { data } = await client.from('users').select('*').eq('username', safeUsername).single();
            if (data) callback(this.normalizeUser(data));
          })
          .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR') {
              console.error(`Supabase real-time error para el usuario "${safeUsername}". Verifica Realtime y RLS.`);
            }
          });

        // Initial fetch
        client.from('users').select('*').eq('username', safeUsername).single().then(({ data, error }: any) => {
          if (error && error.code !== 'PGRST116') console.error(`Initial user fetch error (${safeUsername}):`, error);
          if (data) callback(this.normalizeUser(data));
        });

        return () => {
          client.removeChannel(channel);
        };
      } catch (err) {
        console.error(`Error setting up user subscription (${safeUsername}):`, err);
        return () => {};
      }
    } else {
      return () => {};
    }
  },

  // --- PUBLIC REGIONS ---
  async publishRegion(name: string, url: string, key: string, creator: string) {
    // This always goes to the GLOBAL shared backend (Firebase API)
    const res = await fetch('/api/regions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, key, creator })
    });
    return res.json();
  },

  async getPublicRegions(): Promise<any[]> {
    try {
      const res = await fetch('/api/regions');
      return res.json();
    } catch (err) {
      console.error('Error fetching public regions:', err);
      return [];
    }
  }
};

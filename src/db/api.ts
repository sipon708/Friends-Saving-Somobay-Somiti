const API_URL = '/api';

export const api = {
  get: async (table: string) => {
    const res = await fetch(`${API_URL}/${table}`);
    return res.json();
  },
  post: async (table: string, data: any) => {
    const res = await fetch(`${API_URL}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  put: async (table: string, id: number | string, data: any) => {
    const res = await fetch(`${API_URL}/${table}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (table: string, id: number | string) => {
    const res = await fetch(`${API_URL}/${table}/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  getSettings: async () => {
    const res = await fetch(`${API_URL}/settings`);
    return res.json();
  },
  updateSetting: async (key: string, value: any) => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    return res.json();
  }
};

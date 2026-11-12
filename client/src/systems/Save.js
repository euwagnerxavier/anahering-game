const KEY = 'anahering.save.v1';

/** Save local versionado (o GDD deixa saves na nuvem fora do escopo). */
export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data?.version === 1 ? data : null;
    } catch {
      return null;
    }
  },
  write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), ...data }));
    } catch {
      /* armazenamento indisponível: segue sem salvar */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignora */
    }
  },
};

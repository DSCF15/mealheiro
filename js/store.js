import { defaultState, normalize } from './logic.js';

const KEY = 'mealheiro.v1';
let state;
let onChange = () => {};
let onError = () => {};

export const getState = () => state;
export const configureStore = (handlers) => { ({ onChange, onError } = handlers); };

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalize(JSON.parse(raw)) : defaultState();
  } catch (error) {
    // Nunca sobrescrever dados que não se conseguiram ler: guardar uma cópia primeiro.
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}.corrupted-${Date.now()}`, raw);
    } catch { /* sem espaço */ }
    state = defaultState();
  }
  return state;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    onError('Não foi possível guardar. Faz um backup e liberta espaço no dispositivo.');
  }
}

/** Aplica uma alteração, guarda e devolve uma função que a anula. */
export function commit(mutator) {
  const before = JSON.stringify(state);
  mutator(state);
  persist();
  onChange();
  return () => {
    state = JSON.parse(before);
    persist();
    onChange();
  };
}

export function replaceState(next) {
  const before = JSON.stringify(state);
  state = normalize(next);
  persist();
  onChange();
  return () => {
    state = JSON.parse(before);
    persist();
    onChange();
  };
}

// Mantém vários separadores abertos sincronizados.
window.addEventListener('storage', (event) => {
  if (event.key !== KEY || !event.newValue) return;
  try {
    state = normalize(JSON.parse(event.newValue));
    onChange();
  } catch { /* ignora escrita inválida */ }
});

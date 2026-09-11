import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark' | 'system';
export const theme = writable<Theme>('system');

export function initTheme() {
  const saved = (localStorage.getItem('theme') as Theme) || 'system';
  setTheme(saved);
}

export function setTheme(value: Theme) {
  theme.set(value);
  localStorage.setItem('theme', value);
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = value === 'dark' || (value === 'system' && prefersDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

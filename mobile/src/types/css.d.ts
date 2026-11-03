// CSS side-effect imports (`import '@/global.css'`). Expo generates the same
// declaration in expo-env.d.ts on `expo start`, but that file is git-ignored,
// so a fresh clone needs this one to type-check.
declare module '*.css';

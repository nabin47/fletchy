declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;
declare const __APP_WEB_URL__: string;

interface Window {
  __fletchy?: { ready: boolean; version: string };
}

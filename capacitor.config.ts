import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hengtong.app',
  appName: 'HengtongApp',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  }
};

export default config;
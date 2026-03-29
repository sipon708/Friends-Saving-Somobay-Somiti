import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.friendssaving.app',
  appName: 'ফ্রেন্ডস সেভিং সমবায় সমিতি',
  webDir: 'dist',
  backgroundColor: '#f8fafc',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#047857",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff",
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      resize: 'none' as any,
    },
    StatusBar: {
      backgroundColor: '#f8fafc',
      style: 'LIGHT',
    },
  },
};

export default config;

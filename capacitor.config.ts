import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.thecatholiccalendar.app",
  appName: "Catholic Calendar",
  webDir: "dist",
  backgroundColor: "#f8f6f1",
  // Live-load the Lovable-hosted site instead of a bundled copy, so
  // publishing on Lovable updates the app instantly with no rebuild or
  // store resubmission. See PORT_TO_LOVABLE.md for what has to exist on
  // that live site for push notifications and native polish to work.
  server: {
    url: "https://thecatholiccalendar.org",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#f8f6f1",
  },
  android: {
    backgroundColor: "#f8f6f1",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#f8f6f1",
      androidSplashResourceName: "splash",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f8f6f1",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

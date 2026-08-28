import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.thecatholiccalendar.app",
  appName: "Catholic Calendar",
  webDir: "dist",
  backgroundColor: "#f8f6f1",
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

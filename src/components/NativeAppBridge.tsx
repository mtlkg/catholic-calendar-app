import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { setNativePushNavigator } from "@/lib/nativePush";

/** Links to other sites (organizer websites, maps, videos…) should open in
 *  the system browser inside the native app, not navigate the app's WebView. */
function installExternalLinkHandler() {
  document.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    const url = anchor.href;
    if (!url.startsWith("http")) return;
    if (url.startsWith(window.location.origin)) return;
    e.preventDefault();
    Browser.open({ url });
  });
}

/**
 * Wires the native shell into the router: routes notification taps to the
 * right page, and makes Android's hardware back button behave like a
 * browser back button instead of the OS default (which would just close
 * the whole app from any screen).
 */
export default function NativeAppBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setNativePushNavigator((path) => navigate(path));
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    installExternalLinkHandler();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener("backButton", () => {
      if (window.history.length > 1 && location.pathname !== "/catholic-calendar") {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, [location.pathname]);

  return null;
}

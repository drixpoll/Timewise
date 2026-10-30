import { isTauri } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export async function enableNotificationPermission(): Promise<boolean> {
  try {
    if (isTauri()) {
      if (await isPermissionGranted()) return true;
      return (await requestPermission()) === 'granted';
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  } catch { return false; }
}
export async function notifyCompleted(title: string): Promise<void> {
  try {
    if (isTauri()) {
      if (await isPermissionGranted()) sendNotification({ title: 'Time block complete ✓', body: `Finished: ${title}. Nice work!` });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Time block complete ✓', { body: `Finished: ${title}. Nice work!` });
    }
  } catch { /* Notifications are optional. */ }
}

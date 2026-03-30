'use client';

import { useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tg = window.Telegram?.WebApp;

    if (tg?.initDataUnsafe?.user) {
      // Реальный Telegram WebApp
      tg.ready();
      tg.expand();
      setUser(tg.initDataUnsafe.user);
      setIsReady(true);
      console.log('✅ Telegram user:', tg.initDataUnsafe.user);
    } else if (process.env.NODE_ENV === 'development') {
      // Dev режим — используем тестового пользователя
      console.warn('⚠️ Dev режим: используем тестового пользователя');
      setUser({
        id: Number(process.env.NEXT_PUBLIC_DEV_TELEGRAM_ID || 123456789),
        first_name: 'Dev',
        username: 'dev_user',
      });
      setIsReady(true);
    } else {
      // Prod без Telegram — всё равно помечаем ready чтобы не зависало
      console.warn('⚠️ Telegram WebApp недоступен');
      setIsReady(true);
    }
  }, []);

  return { user, isReady };
}

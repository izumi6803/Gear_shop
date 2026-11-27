import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LANGS, MESSAGES, type Lang } from './messages';

const STORAGE_KEY = 'stockflow.lang';
const CURRENCY = 'USD';

const LOCALES: Record<Lang, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  ja: 'ja-JP',
};

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LANGS as readonly string[]).includes(stored)) {
      return stored as Lang;
    }
    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (browser === 'vi' || browser === 'ja' || browser === 'en') {
      return browser as Lang;
    }
  } catch {
    // localStorage có thể bị chặn (private mode) → dùng mặc định
  }
  return 'en';
}

type Params = Record<string, string | number>;

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Params) => string;
  money: (value: number) => string;
  number: (value: number) => string;
  date: (value?: string | null) => string;
  dateTime: (value?: string | null) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => detectLang());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // bỏ qua: không lưu được thì vẫn đổi ngôn ngữ trong phiên hiện tại
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: string, params?: Params) => {
      const entry = MESSAGES[key];
      const raw = entry ? entry[LANGS.indexOf(lang)] : key;
      if (!params) {
        return raw;
      }
      return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
        params[name] === undefined ? match : String(params[name]),
      );
    },
    [lang],
  );

  const money = useCallback(
    (value: number) =>
      new Intl.NumberFormat(LOCALES[lang], {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 2,
      }).format(value),
    [lang],
  );

  const number = useCallback(
    (value: number) => new Intl.NumberFormat(LOCALES[lang]).format(value),
    [lang],
  );

  const date = useCallback((value?: string | null) => (value ? value.slice(0, 10) : '—'), []);

  const dateTime = useCallback(
    (value?: string | null) => {
      if (!value) {
        return '—';
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      return new Intl.DateTimeFormat(LOCALES[lang], {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, money, number, date, dateTime }),
    [lang, t, money, number, date, dateTime],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return context;
}

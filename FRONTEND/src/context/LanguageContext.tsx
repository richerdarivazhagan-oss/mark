import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Language } from '../i18n/translations';

const STORAGE_KEY = 'markup_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  isTamil: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getDotValue(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ta' || saved === 'en') {
        return saved;
      }
    } catch {
      // localStorage unavailable
    }
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    } catch {
      // localStorage unavailable
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      if (!key) return '';

      const dict = translations[language] as any;
      if (!dict) return fallback !== undefined ? fallback : key;

      // 1. Check dot-path (e.g. 'common.save', 'nav.dashboard')
      const dotVal = getDotValue(dict, key);
      if (dotVal !== undefined) return dotVal;

      // 2. Check direct dictionary in current language
      if (dict.direct && dict.direct[key]) {
        return dict.direct[key];
      }

      // 3. If English mode, return fallback or key directly
      if (language === 'en') {
        return fallback !== undefined ? fallback : key;
      }

      // 4. Tamil mode resolution:
      // Try matching fallback in direct ta dictionary
      if (fallback && dict.direct && dict.direct[fallback]) {
        return dict.direct[fallback];
      }

      // Try matching trimmed key
      const trimmed = key.trim();
      if (dict.direct && dict.direct[trimmed]) {
        return dict.direct[trimmed];
      }

      // Check common section for exact key
      if (dict.common && dict.common[key]) {
        return dict.common[key];
      }

      // Check nav section for exact key
      if (dict.nav && dict.nav[key]) {
        return dict.nav[key];
      }

      // If key is an English word with lowercase match in direct dictionary
      const directKeys = Object.keys(dict.direct || {});
      const lowerKey = key.toLowerCase();
      const matchedKey = directKeys.find((k) => k.toLowerCase() === lowerKey);
      if (matchedKey && dict.direct[matchedKey]) {
        return dict.direct[matchedKey];
      }

      return fallback !== undefined ? fallback : key;
    },
    [language]
  );

  const formatDate = useCallback(
    (dateInput: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      try {
        const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        const locale = language === 'ta' ? 'ta-IN' : 'en-US';
        const defaultOptions: Intl.DateTimeFormatOptions = {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        };
        return d.toLocaleDateString(locale, options || defaultOptions);
      } catch {
        return String(dateInput);
      }
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        formatDate,
        isTamil: language === 'ta'
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

import { LANGS, LANG_LABELS } from '../i18n/messages';
import { useI18n } from '../i18n/I18nContext';

/**
 * Chọn ngôn ngữ giao diện (vi / en / ja).
 * Dùng <select> gốc để thao tác bàn phím và screen reader hoạt động sẵn.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();

  return (
    <label className={`lang-switcher${compact ? ' lang-switcher-compact' : ''}`}>
      <span className="visually-hidden">{t('lang.label')}</span>
      <select
        className="form-select form-select-sm"
        value={lang}
        aria-label={t('lang.label')}
        data-testid="lang-switcher"
        onChange={(event) => setLang(event.target.value as (typeof LANGS)[number])}
      >
        {LANGS.map((code) => (
          <option key={code} value={code}>
            {LANG_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

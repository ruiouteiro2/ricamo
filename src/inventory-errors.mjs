import { t, errorText } from './i18n';
export function inventoryErrorText(error) {
  const key = `error.${error?.code || ''}`, translated = t(key);
  const message = translated === key ? errorText(error) : translated;
  return Number.isInteger(error?.details?.row) ? t('inventoryEntryError', { number: error.details.row, message }) : message;
}

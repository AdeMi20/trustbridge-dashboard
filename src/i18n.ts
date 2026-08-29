import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

type SupportedLocale = 'en' | 'es' | 'pt';
const locales: SupportedLocale[] = ['en', 'es', 'pt'];

export default getRequestConfig(async ({ locale }: { locale: string }) => {
  if (!locales.includes(locale as SupportedLocale)) notFound();

  return {
    messages: (await import(`../public/locales/${locale}.json`)).default,
  };
});

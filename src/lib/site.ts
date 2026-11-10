/** Endereço do site (sem barra no fim). Usado em links compartilhados e no Open Graph. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/** Link público de uma viagem. */
export function tripUrl(slug: string): string {
  return `${siteUrl}/v/${slug}`;
}

/** Link pessoal da página do inscrito (migration 0013). */
export function registrationUrl(token: string): string {
  return `${siteUrl}/i/${token}`;
}

import { expect, test } from "@playwright/test";

const cases = [
  {
    path: "/",
    title: /LicitaIA/i,
    canonical: "https://licitai.mbest.site",
    ogUrl: "https://licitai.mbest.site",
  },
  {
    path: "/blog",
    title: /Blog/i,
    canonical: "https://licitai.mbest.site/blog",
    ogUrl: "https://licitai.mbest.site/blog",
  },
  {
    path: "/precos",
    title: /Preços|Precos/i,
    canonical: "https://licitai.mbest.site/precos",
    ogUrl: "https://licitai.mbest.site/precos",
  },
  {
    path: "/guia/como-participar-de-licitacoes",
    title: /Como Participar de Licitações|Como Participar de Licitacoes/i,
    canonical: "https://licitai.mbest.site/guia/como-participar-de-licitacoes",
    ogUrl: "https://licitai.mbest.site/guia/como-participar-de-licitacoes",
  },
];

for (const pageCase of cases) {
  test(`SEO smoke ${pageCase.path}`, async ({ page }) => {
    const response = await page.goto(pageCase.path, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    expect(response?.status(), `HTTP inesperado em ${pageCase.path}`).toBe(200);
    await expect(page).toHaveTitle(pageCase.title);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("h1").first()).toContainText(/.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", pageCase.canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", pageCase.ogUrl);
  });
}

const { test, expect } = require('@playwright/test');

/**
 * SEO/GEO/AEO 검증 E2E 테스트
 * - hreflang 태그 검증 (모든 레이아웃)
 * - JSON-LD 구조화 데이터 검증 (Person, WebSite, BlogPosting, BreadcrumbList, Blog, FAQPage, HowTo)
 * - Open Graph / meta 태그 검증
 * - Sitemap 검증
 * - Robots.txt 검증
 */

/** JSON-LD 스크립트 태그에서 파싱된 스키마 객체 배열 반환 */
async function getJsonLdSchemas(page) {
  return page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return Array.from(scripts).map(s => {
      try { return JSON.parse(s.textContent); }
      catch { return null; }
    }).filter(Boolean);
  });
}

/** 페이지에서 hreflang 태그 맵 추출 { hreflang: href } */
async function getHreflangMap(page) {
  return page.evaluate(() => {
    const links = document.querySelectorAll('link[rel="alternate"][hreflang]');
    const map = {};
    links.forEach(link => {
      map[link.getAttribute('hreflang')] = link.getAttribute('href');
    });
    return map;
  });
}

const REQUIRED_HREFLANGS = ['ko', 'en', 'es', 'x-default'];

test.describe('SEO/GEO/AEO Validation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('lang-redirected', 'true'));
  });

  // =========================================================================
  // a) hreflang 검증
  // =========================================================================
  test.describe('hreflang tags', () => {

    test('Home pages have correct hreflang tags', async ({ page }) => {
      for (const [path, lang] of [['/', 'ko'], ['/en/', 'en'], ['/es/', 'es']]) {
        await page.goto(path);
        const map = await getHreflangMap(page);

        for (const hl of REQUIRED_HREFLANGS) {
          expect(map[hl], `Missing hreflang="${hl}" on ${path}`).toBeTruthy();
        }
        expect(map['en']).toContain('/en/');
        expect(map['es']).toContain('/es/');
        expect(map['x-default']).not.toContain('/en/');
        expect(map['x-default']).not.toContain('/es/');
      }
    });

    test('Post pages have correct hreflang tags with matching slugs', async ({ page }) => {
      const slug = 'WHY_PAGEABLE_RETURN_ZERO';

      await page.goto(`/posts/${slug}/`);
      const koMap = await getHreflangMap(page);
      expect(koMap['ko']).toContain(`/posts/${slug}/`);
      expect(koMap['en']).toContain(`/en/posts/${slug}/`);
      expect(koMap['es']).toContain(`/es/posts/${slug}/`);

      await page.goto(`/en/posts/${slug}/`);
      const enMap = await getHreflangMap(page);
      expect(enMap['ko']).toContain(`/posts/${slug}/`);
      expect(enMap['en']).toContain(`/en/posts/${slug}/`);
    });

    test('Archives pages have hreflang tags', async ({ page }) => {
      await page.goto('/archives/');
      const map = await getHreflangMap(page);
      for (const hl of REQUIRED_HREFLANGS) {
        expect(map[hl], `Missing hreflang="${hl}" on /archives/`).toBeTruthy();
      }
      expect(map['en']).toContain('/en/archives/');
      expect(map['es']).toContain('/es/archives/');
    });

    test('Categories index pages have hreflang tags', async ({ page }) => {
      await page.goto('/categories/');
      const map = await getHreflangMap(page);
      for (const hl of REQUIRED_HREFLANGS) {
        expect(map[hl], `Missing hreflang="${hl}" on /categories/`).toBeTruthy();
      }
      expect(map['en']).toContain('/en/categories/');
    });

    test('Tags index pages have hreflang tags', async ({ page }) => {
      await page.goto('/tags/');
      const map = await getHreflangMap(page);
      for (const hl of REQUIRED_HREFLANGS) {
        expect(map[hl], `Missing hreflang="${hl}" on /tags/`).toBeTruthy();
      }
      expect(map['en']).toContain('/en/tags/');
    });
  });

  // =========================================================================
  // b) JSON-LD 구조화 데이터 검증
  // =========================================================================
  test.describe('JSON-LD structured data', () => {

    test('All pages have Person and WebSite schemas', async ({ page }) => {
      for (const path of ['/', '/en/', '/posts/WHY_PAGEABLE_RETURN_ZERO/']) {
        await page.goto(path);
        const schemas = await getJsonLdSchemas(page);
        const types = schemas.map(s => s['@type']);

        expect(types, `Missing Person schema on ${path}`).toContain('Person');
        expect(types, `Missing WebSite schema on ${path}`).toContain('WebSite');
      }
    });

    test('Person schema has required fields', async ({ page }) => {
      await page.goto('/');
      const schemas = await getJsonLdSchemas(page);
      const person = schemas.find(s => s['@type'] === 'Person');

      expect(person.name).toBeTruthy();
      expect(person.jobTitle).toBeTruthy();
      expect(person['@id']).toContain('#author');
    });

    test('Home page has Blog schema', async ({ page }) => {
      await page.goto('/');
      const schemas = await getJsonLdSchemas(page);
      const blog = schemas.find(s => s['@type'] === 'Blog');

      expect(blog).toBeTruthy();
      expect(blog.name).toBeTruthy();
      expect(blog.availableLanguage).toContain('ko-KR');
      expect(blog.availableLanguage).toContain('en');
    });

    test('Post page has BlogPosting schema with required fields', async ({ page }) => {
      await page.goto('/posts/WHY_PAGEABLE_RETURN_ZERO/');
      const schemas = await getJsonLdSchemas(page);
      const posting = schemas.find(s => s['@type'] === 'BlogPosting' && s.inLanguage);

      expect(posting).toBeTruthy();
      expect(posting.headline).toBeTruthy();
      expect(posting.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(posting.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(posting.author['@id']).toContain('#author');
      expect(posting.keywords).toBeTruthy();
      expect(posting.url).toBeTruthy();
      expect(posting.inLanguage).toBeTruthy();
    });

    test('Korean post BreadcrumbList Home points to Korean root', async ({ page }) => {
      await page.goto('/posts/WHY_PAGEABLE_RETURN_ZERO/');
      const schemas = await getJsonLdSchemas(page);
      const breadcrumb = schemas.find(s => s['@type'] === 'BreadcrumbList');

      expect(breadcrumb).toBeTruthy();
      const homeItem = breadcrumb.itemListElement.find(i => i.position === 1);
      expect(homeItem.name).toBe('Home');
      expect(homeItem.item).not.toContain('/en/');
      expect(homeItem.item).not.toContain('/es/');
    });

    test('English post BreadcrumbList Home points to English root', async ({ page }) => {
      await page.goto('/en/posts/WHY_PAGEABLE_RETURN_ZERO/');
      const schemas = await getJsonLdSchemas(page);
      const breadcrumb = schemas.find(s => s['@type'] === 'BreadcrumbList');

      expect(breadcrumb).toBeTruthy();
      const homeItem = breadcrumb.itemListElement.find(i => i.position === 1);
      expect(homeItem.item).toContain('/en/');
    });

    test('Post with FAQ has valid FAQPage schema', async ({ page }) => {
      await page.goto('/posts/WHY_PAGEABLE_RETURN_ZERO/');
      const schemas = await getJsonLdSchemas(page);
      const faq = schemas.find(s => s['@type'] === 'FAQPage');

      expect(faq).toBeTruthy();
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(2);
      for (const q of faq.mainEntity) {
        expect(q['@type']).toBe('Question');
        expect(q.name).toBeTruthy();
        expect(q.acceptedAnswer['@type']).toBe('Answer');
        expect(q.acceptedAnswer.text).toBeTruthy();
      }
    });

    test('All posts with FAQ front matter have FAQPage schema', async ({ page }) => {
      const postsWithFaq = [
        '/posts/When_To_Ereate_Exceptions/',
        '/posts/Chrome-Not-Returning-304-Status-in-Not-Modified-Situations/',
        '/posts/JSHELL_SWAP_MEMORY/',
        '/posts/AWS-CLI-MFA-SCRIPT/',
        '/posts/AUTO_SCALING_GROUP_CLOSE/',
        '/posts/SWAP_MEMORY_ERROR_LOGGING/',
        '/posts/FLWAY_FOR_TIBERO/',
        '/posts/WHY_PAGEABLE_RETURN_ZERO/',
      ];

      for (const postPath of postsWithFaq) {
        await page.goto(postPath);
        const schemas = await getJsonLdSchemas(page);
        const faq = schemas.find(s => s['@type'] === 'FAQPage');
        expect(faq, `Missing FAQPage schema on ${postPath}`).toBeTruthy();
        expect(faq.mainEntity.length, `No FAQ items on ${postPath}`).toBeGreaterThanOrEqual(2);
      }
    });

    test('Post with HowTo has valid HowTo schema', async ({ page }) => {
      await page.goto('/posts/AWS-CLI-MFA-SCRIPT/');
      const schemas = await getJsonLdSchemas(page);
      const howto = schemas.find(s => s['@type'] === 'HowTo');

      expect(howto).toBeTruthy();
      expect(howto.name).toBeTruthy();
      expect(howto.step.length).toBeGreaterThanOrEqual(3);
      for (const step of howto.step) {
        expect(step['@type']).toBe('HowToStep');
        expect(step.name).toBeTruthy();
        expect(step.text).toBeTruthy();
        expect(step.position).toBeGreaterThan(0);
      }
    });

    test('All posts with HowTo front matter have HowTo schema', async ({ page }) => {
      const postsWithHowto = [
        '/posts/AWS-CLI-MFA-SCRIPT/',
        '/posts/JSHELL_SWAP_MEMORY/',
        '/posts/FLWAY_FOR_TIBERO/',
      ];

      for (const postPath of postsWithHowto) {
        await page.goto(postPath);
        const schemas = await getJsonLdSchemas(page);
        const howto = schemas.find(s => s['@type'] === 'HowTo');
        expect(howto, `Missing HowTo schema on ${postPath}`).toBeTruthy();
        expect(howto.step.length, `No steps on ${postPath}`).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // =========================================================================
  // c) Open Graph / meta 태그 검증
  // =========================================================================
  test.describe('Open Graph and meta tags', () => {

    test('Post page has required OG tags and canonical URL', async ({ page }) => {
      await page.goto('/posts/WHY_PAGEABLE_RETURN_ZERO/');

      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
      expect(ogTitle).toBeTruthy();
      expect(ogDesc).toBeTruthy();

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBeTruthy();
      expect(canonical).toContain('/posts/WHY_PAGEABLE_RETURN_ZERO/');
    });

    test('html lang attribute matches page language', async ({ page }) => {
      const langTests = [
        ['/', 'ko-KR'],
        ['/en/', 'en'],
        ['/es/', 'es-ES'],
        ['/en/posts/WHY_PAGEABLE_RETURN_ZERO/', 'en'],
      ];

      for (const [path, expectedLang] of langTests) {
        await page.goto(path);
        const htmlLang = await page.locator('html').getAttribute('lang');
        expect(htmlLang, `Wrong lang on ${path}`).toBe(expectedLang);
      }
    });

    test('Home page has OG tags', async ({ page }) => {
      await page.goto('/');
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toBeTruthy();
    });
  });

  // =========================================================================
  // d) Sitemap 검증
  // =========================================================================
  test.describe('Sitemap validation', () => {

    test('Sitemap contains hreflang for homepage', async ({ page }) => {
      const response = await page.goto('/sitemap.xml');
      const body = await response.text();

      expect(body).toContain('xmlns:xhtml=');
      expect(body).toContain('hreflang="ko"');
      expect(body).toContain('hreflang="en"');
      expect(body).toContain('hreflang="es"');
      expect(body).toContain('hreflang="x-default"');
    });

    test('Sitemap contains all page types', async ({ page }) => {
      const response = await page.goto('/sitemap.xml');
      const body = await response.text();

      expect(body).toContain('/archives/');
      expect(body).toContain('/en/archives/');
      expect(body).toContain('/categories/');
      expect(body).toContain('/tags/');
      expect(body).toContain('/posts/');
      expect(body).toContain('/en/posts/');
    });

    test('Sitemap has no duplicate loc URLs', async ({ page }) => {
      const response = await page.goto('/sitemap.xml');
      const body = await response.text();
      const locMatches = body.match(/<loc>(.*?)<\/loc>/g);

      if (locMatches) {
        const urls = locMatches.map(m => m.replace(/<\/?loc>/g, ''));
        const uniqueUrls = [...new Set(urls)];
        expect(urls.length).toBe(uniqueUrls.length);
      }
    });
  });

  // =========================================================================
  // e) Robots.txt 검증
  // =========================================================================
  test.describe('Robots.txt validation', () => {

    test('Robots.txt has sitemap reference and proper rules', async ({ page }) => {
      const response = await page.goto('/robots.txt');
      const body = await response.text();

      expect(body).toContain('User-agent:');
      expect(body).toContain('Sitemap:');
      expect(body).toContain('sitemap.xml');
      expect(body).toContain('Allow: /');
    });
  });
});

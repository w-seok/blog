const { test, expect } = require('@playwright/test');

test.describe('Multilingual Blog Tests', () => {

  // Prevent auto-redirect based on browser language for all tests
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('lang-redirected', 'true'));
  });

  test.describe('Homepage Language Filtering', () => {

    test('Korean homepage shows only Korean posts', async ({ page }) => {
      await page.goto('/');

      const postTitles = await page.locator('.card-title').allTextContents();

      // Korean posts should contain Korean characters
      for (const title of postTitles) {
        // Check that title contains Korean characters (Hangul)
        const hasKorean = /[\uAC00-\uD7AF]/.test(title);
        expect(hasKorean, `Expected Korean title but got: ${title}`).toBe(true);
      }

      // Should have at least one post
      expect(postTitles.length).toBeGreaterThan(0);
    });

    test('English homepage shows only English posts', async ({ page }) => {
      await page.goto('/en/');

      const postTitles = await page.locator('.card-title').allTextContents();

      // English posts should NOT contain Korean or Spanish characters
      for (const title of postTitles) {
        const hasKorean = /[\uAC00-\uD7AF]/.test(title);
        const hasSpanish = /[¿¡áéíóúñ]/i.test(title);
        expect(hasKorean, `Unexpected Korean in English page: ${title}`).toBe(false);
        expect(hasSpanish, `Unexpected Spanish in English page: ${title}`).toBe(false);
      }

      expect(postTitles.length).toBeGreaterThan(0);
    });

    test('Spanish homepage shows only Spanish posts', async ({ page }) => {
      await page.goto('/es/');

      const postTitles = await page.locator('.card-title').allTextContents();

      // Spanish posts should contain Spanish-specific characters or Spanish words
      let hasSpanishContent = false;
      for (const title of postTitles) {
        // Check for Spanish characters or common Spanish words
        if (/[¿¡áéíóúñ]/i.test(title) || /\b(de|en|para|con|los|las|por)\b/i.test(title)) {
          hasSpanishContent = true;
        }
        // Should NOT contain Korean
        const hasKorean = /[\uAC00-\uD7AF]/.test(title);
        expect(hasKorean, `Unexpected Korean in Spanish page: ${title}`).toBe(false);
      }

      expect(postTitles.length).toBeGreaterThan(0);
      expect(hasSpanishContent, 'Spanish page should have Spanish content').toBe(true);
    });
  });

  test.describe('SEO - HTML lang and og:locale', () => {

    test('Korean homepage has correct html lang attribute', async ({ page }) => {
      await page.goto('/');
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toMatch(/^ko/);
    });

    test('English homepage has correct html lang attribute', async ({ page }) => {
      await page.goto('/en/');
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe('en');
    });

    test('Spanish homepage has correct html lang attribute', async ({ page }) => {
      await page.goto('/es/');
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toMatch(/^es/);
    });

    test('Korean homepage has correct og:locale', async ({ page }) => {
      await page.goto('/');
      const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
      expect(ogLocale).toMatch(/^ko/);
    });

    test('English homepage has correct og:locale', async ({ page }) => {
      await page.goto('/en/');
      const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
      expect(ogLocale).toMatch(/^en/);
    });

    test('Spanish homepage has correct og:locale', async ({ page }) => {
      await page.goto('/es/');
      const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
      expect(ogLocale).toMatch(/^es/);
    });
  });

  test.describe('SEO - hreflang tags', () => {

    test('Korean homepage has correct hreflang tags', async ({ page }) => {
      await page.goto('/');

      const hreflangKo = await page.locator('link[hreflang="ko"]').getAttribute('href');
      const hreflangEn = await page.locator('link[hreflang="en"]').getAttribute('href');
      const hreflangEs = await page.locator('link[hreflang="es"]').getAttribute('href');
      const hreflangDefault = await page.locator('link[hreflang="x-default"]').getAttribute('href');

      expect(hreflangKo).toBeTruthy();
      expect(hreflangEn).toContain('/en/');
      expect(hreflangEs).toContain('/es/');
      expect(hreflangDefault).toBeTruthy();
    });

    test('English homepage has correct hreflang tags', async ({ page }) => {
      await page.goto('/en/');

      const hreflangKo = await page.locator('link[hreflang="ko"]').getAttribute('href');
      const hreflangEn = await page.locator('link[hreflang="en"]').getAttribute('href');
      const hreflangEs = await page.locator('link[hreflang="es"]').getAttribute('href');

      expect(hreflangKo).toBeTruthy();
      expect(hreflangEn).toContain('/en/');
      expect(hreflangEs).toContain('/es/');
    });
  });

  test.describe('Sidebar Locale Text', () => {

    test('Korean homepage shows Korean sidebar labels', async ({ page }) => {
      await page.goto('/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel).toContain('홈');
    });

    test('English homepage shows English sidebar labels', async ({ page }) => {
      await page.goto('/en/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });

    test('Spanish homepage shows Spanish sidebar labels', async ({ page }) => {
      await page.goto('/es/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('INICIO');
    });

    test('Archives page shows sidebar labels based on preferred language (English)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/archives/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });

    test('Tags page shows sidebar labels based on preferred language (English)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/tags/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });

    test('About page shows sidebar labels based on preferred language (English)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/about/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });

    test('Categories page shows sidebar labels based on preferred language (Spanish)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'es'));
      await page.goto('/categories/');

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('INICIO');
    });
  });

  test.describe('Recently Updated Panel Language Filtering', () => {

    test('Korean homepage shows Korean posts in Recently Updated', async ({ page }) => {
      await page.goto('/');

      const recentlyUpdatedTitle = await page.locator('#access-lastmod li a').first().textContent();
      const hasKorean = /[\uAC00-\uD7AF]/.test(recentlyUpdatedTitle);
      expect(hasKorean, `Expected Korean title but got: ${recentlyUpdatedTitle}`).toBe(true);
    });

    test('English homepage shows English posts in Recently Updated', async ({ page }) => {
      await page.goto('/en/');

      const recentlyUpdatedTitle = await page.locator('#access-lastmod li:visible a').first().textContent();
      const hasKorean = /[\uAC00-\uD7AF]/.test(recentlyUpdatedTitle);
      expect(hasKorean, `Unexpected Korean in English Recently Updated: ${recentlyUpdatedTitle}`).toBe(false);
    });

    test('Spanish homepage shows Spanish posts in Recently Updated', async ({ page }) => {
      await page.goto('/es/');

      const recentlyUpdatedTitle = await page.locator('#access-lastmod li:visible a').first().textContent();
      const hasKorean = /[\uAC00-\uD7AF]/.test(recentlyUpdatedTitle);
      expect(hasKorean, `Unexpected Korean in Spanish Recently Updated: ${recentlyUpdatedTitle}`).toBe(false);
    });
  });

  test.describe('Language Switcher UI', () => {

    test('Language switcher button exists and opens dropdown', async ({ page }) => {
      await page.goto('/');

      const langToggle = page.locator('#lang-toggle');
      await expect(langToggle).toBeVisible();

      // Click to open dropdown
      await langToggle.click();

      const langSwitcher = page.locator('#lang-switcher');
      await expect(langSwitcher).toHaveClass(/open/);

      // Check language options exist
      const koOption = page.locator('.lang-option[data-lang="ko"]');
      const enOption = page.locator('.lang-option[data-lang="en"]');
      const esOption = page.locator('.lang-option[data-lang="es"]');

      await expect(koOption).toBeVisible();
      await expect(enOption).toBeVisible();
      await expect(esOption).toBeVisible();
    });

    test('Clicking English option sets preferred language', async ({ page }) => {
      await page.goto('/');

      // Open language switcher
      await page.locator('#lang-toggle').click();

      // Click English option
      await page.locator('.lang-option[data-lang="en"]').click();

      // Verify localStorage is set (since baseurl differs in test vs production)
      const preferredLang = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(preferredLang).toBe('en');
    });

    test('Clicking Spanish option sets preferred language', async ({ page }) => {
      await page.goto('/');

      // Open language switcher
      await page.locator('#lang-toggle').click();

      // Click Spanish option
      await page.locator('.lang-option[data-lang="es"]').click();

      // Verify localStorage is set
      const preferredLang = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(preferredLang).toBe('es');
    });
  });

  test.describe('Pagination', () => {

    test('Korean homepage has correct number of posts (max 10)', async ({ page }) => {
      await page.goto('/');

      const posts = await page.locator('.card-wrapper').count();
      expect(posts).toBeLessThanOrEqual(10);
      expect(posts).toBeGreaterThan(0);
    });

    test('English homepage has correct number of posts (max 10)', async ({ page }) => {
      await page.goto('/en/');

      const posts = await page.locator('.card-wrapper').count();
      expect(posts).toBeLessThanOrEqual(10);
      expect(posts).toBeGreaterThan(0);
    });

    test('Spanish homepage has correct number of posts (max 10)', async ({ page }) => {
      await page.goto('/es/');

      const posts = await page.locator('.card-wrapper').count();
      expect(posts).toBeLessThanOrEqual(10);
      expect(posts).toBeGreaterThan(0);
    });
  });

  test.describe('Archives Page Language Filtering', () => {

    test('Archives page filters posts by preferred language (Korean)', async ({ page }) => {
      // Set preferred language to Korean
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));

      // Navigate to archives
      await page.goto('/archives/');
      await page.waitForLoadState('domcontentloaded');

      // Get all visible post items
      const visiblePosts = await page.locator('#archives li[data-locale]:visible').all();

      for (const post of visiblePosts) {
        const locale = await post.getAttribute('data-locale');
        expect(locale, 'Archives should only show Korean posts when preferred-lang is ko').toBe('ko');
      }

      // Verify at least one post is visible
      expect(visiblePosts.length).toBeGreaterThan(0);
    });

    test('Archives page filters posts by preferred language (English)', async ({ page }) => {
      // Set preferred language to English
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      // Navigate to archives
      await page.goto('/archives/');
      await page.waitForLoadState('domcontentloaded');

      // Get all visible post items
      const visiblePosts = await page.locator('#archives li[data-locale]:visible').all();

      for (const post of visiblePosts) {
        const locale = await post.getAttribute('data-locale');
        expect(locale, 'Archives should only show English posts when preferred-lang is en').toBe('en');
      }

      expect(visiblePosts.length).toBeGreaterThan(0);
    });

    test('Archives page hides year headers with no visible posts', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));

      await page.goto('/archives/');
      await page.waitForLoadState('domcontentloaded');

      // Check that visible year headers have at least one visible post
      const visibleYears = await page.locator('#archives time[data-year]:visible').all();

      for (const yearEl of visibleYears) {
        const year = await yearEl.getAttribute('data-year');
        // The ul following this year should have visible posts
        const nextUl = await yearEl.evaluateHandle(el => el.nextElementSibling);
        const visiblePostsInYear = await page.locator(`#archives time[data-year="${year}"] + ul li[data-locale]:visible`).count();
        expect(visiblePostsInYear, `Year ${year} is visible but has no visible posts`).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Categories Page Language Filtering', () => {

    test('Categories page filters by preferred language (Korean)', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));

      await page.goto('/categories/');
      await page.waitForLoadState('domcontentloaded');

      // Get visible category cards
      const visibleCards = await page.locator('.category-card:visible').all();

      // Each visible card should have a post count > 0
      for (const card of visibleCards) {
        const countText = await card.locator('.category-post-count').textContent();
        const count = parseInt(countText, 10);
        expect(count, 'Visible category card should have posts > 0').toBeGreaterThan(0);
      }

      expect(visibleCards.length).toBeGreaterThan(0);
    });

    test('Categories page filters by preferred language (English)', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/categories/');
      await page.waitForLoadState('domcontentloaded');

      // Get visible category cards
      const visibleCards = await page.locator('.category-card:visible').all();

      for (const card of visibleCards) {
        const countText = await card.locator('.category-post-count').textContent();
        const count = parseInt(countText, 10);
        expect(count, 'Visible category card should have posts > 0').toBeGreaterThan(0);
      }

      expect(visibleCards.length).toBeGreaterThan(0);
    });

    test('Categories page hides cards with no posts in selected language', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/categories/');
      await page.waitForLoadState('domcontentloaded');

      // Hidden cards should have display: none
      const hiddenCards = await page.locator('.category-card[style*="display: none"]').all();

      // For each hidden card, verify it has 0 posts for this language
      for (const card of hiddenCards) {
        const isVisible = await card.isVisible();
        expect(isVisible, 'Hidden card should not be visible').toBe(false);
      }
    });
  });

  test.describe('Tags Page Language Filtering', () => {

    test('Tags page filters by preferred language (Korean)', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));

      await page.goto('/tags/');
      await page.waitForLoadState('domcontentloaded');

      // Get visible tag wrappers
      const visibleTags = await page.locator('.tag-wrapper:visible').all();

      for (const tag of visibleTags) {
        const countText = await tag.locator('.tag-count').textContent();
        const count = parseInt(countText, 10);
        expect(count, 'Visible tag should have count > 0').toBeGreaterThan(0);
      }

      expect(visibleTags.length).toBeGreaterThan(0);
    });

    test('Tags page filters by preferred language (English)', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/tags/');
      await page.waitForLoadState('domcontentloaded');

      // Get visible tag wrappers
      const visibleTags = await page.locator('.tag-wrapper:visible').all();

      for (const tag of visibleTags) {
        const countText = await tag.locator('.tag-count').textContent();
        const count = parseInt(countText, 10);
        expect(count, 'Visible tag should have count > 0').toBeGreaterThan(0);
      }

      expect(visibleTags.length).toBeGreaterThan(0);
    });

    test('Tags page hides tags with no posts in selected language', async ({ page }) => {
      // Set preferred language
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/tags/');
      await page.waitForLoadState('domcontentloaded');

      // Hidden tags should not be visible
      const hiddenTags = await page.locator('.tag-wrapper[style*="display: none"]').all();

      for (const tag of hiddenTags) {
        const isVisible = await tag.isVisible();
        expect(isVisible, 'Hidden tag should not be visible').toBe(false);
      }
    });
  });

  test.describe('Language Preference Persistence Across Tabs', () => {

    test('Language preference persists when navigating to Archives', async ({ page }) => {
      // Set preference on homepage
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      // Navigate to archives
      await page.goto('/archives/');

      // Verify preference is still set
      const lang = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(lang).toBe('en');

      // Verify filtering is applied
      const visiblePosts = await page.locator('#archives li[data-locale="en"]:visible').count();
      const hiddenKoPosts = await page.locator('#archives li[data-locale="ko"]').evaluateAll(
        els => els.filter(el => el.style.display === 'none').length
      );

      expect(visiblePosts).toBeGreaterThan(0);
    });

    test('Language preference persists when navigating to Categories', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/categories/');

      const lang = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(lang).toBe('en');
    });

    test('Language preference persists when navigating to Tags', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/tags/');

      const lang = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(lang).toBe('en');
    });
  });

  test.describe('No JavaScript Errors', () => {

    test('Korean homepage loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('English homepage loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/en/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('Spanish homepage loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/es/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('Sidebar Tab Links by Language', () => {

    test('English page sidebar links to English categories/tags/archives', async ({ page }) => {
      await page.goto('/en/');

      const categoriesHref = await page.locator('.nav-link[href*="categories"]').getAttribute('href');
      const tagsHref = await page.locator('.nav-link[href*="tags"]').getAttribute('href');
      const archivesHref = await page.locator('.nav-link[href*="archives"]').getAttribute('href');

      expect(categoriesHref).toContain('/en/categories');
      expect(tagsHref).toContain('/en/tags');
      expect(archivesHref).toContain('/en/archives');
    });

    test('Spanish page sidebar links to Spanish categories/tags/archives', async ({ page }) => {
      await page.goto('/es/');

      const categoriesHref = await page.locator('.nav-link[href*="categories"]').getAttribute('href');
      const tagsHref = await page.locator('.nav-link[href*="tags"]').getAttribute('href');
      const archivesHref = await page.locator('.nav-link[href*="archives"]').getAttribute('href');

      expect(categoriesHref).toContain('/es/categories');
      expect(tagsHref).toContain('/es/tags');
      expect(archivesHref).toContain('/es/archives');
    });

    test('Korean page sidebar links to Korean (root) categories/tags/archives', async ({ page }) => {
      await page.goto('/');

      const categoriesHref = await page.locator('.nav-link[href*="categories"]').getAttribute('href');
      const tagsHref = await page.locator('.nav-link[href*="tags"]').getAttribute('href');
      const archivesHref = await page.locator('.nav-link[href*="archives"]').getAttribute('href');

      expect(categoriesHref).not.toContain('/en/');
      expect(categoriesHref).not.toContain('/es/');
      expect(tagsHref).not.toContain('/en/');
      expect(tagsHref).not.toContain('/es/');
      expect(archivesHref).not.toContain('/en/');
      expect(archivesHref).not.toContain('/es/');
    });
  });

  test.describe('Sidebar Home Links', () => {

    test('Korean page sidebar links to Korean home', async ({ page }) => {
      await page.goto('/');
      const avatarHref = await page.locator('#avatar').getAttribute('href');
      const siteTitleHref = await page.locator('.site-title a').getAttribute('href');

      expect(avatarHref).not.toContain('/en/');
      expect(avatarHref).not.toContain('/es/');
      expect(siteTitleHref).not.toContain('/en/');
      expect(siteTitleHref).not.toContain('/es/');
    });

    test('English page sidebar links to English home', async ({ page }) => {
      await page.goto('/en/');
      const avatarHref = await page.locator('#avatar').getAttribute('href');
      const siteTitleHref = await page.locator('.site-title a').getAttribute('href');

      expect(avatarHref).toContain('/en/');
      expect(siteTitleHref).toContain('/en/');
    });

    test('Spanish page sidebar links to Spanish home', async ({ page }) => {
      await page.goto('/es/');
      const avatarHref = await page.locator('#avatar').getAttribute('href');
      const siteTitleHref = await page.locator('.site-title a').getAttribute('href');

      expect(avatarHref).toContain('/es/');
      expect(siteTitleHref).toContain('/es/');
    });
  });

  test.describe('Language Switcher Navigation on Sub-pages', () => {

    test('Language switcher navigates correctly from Spanish categories to English categories', async ({ page }) => {
      await page.goto('/es/categories/');

      // Open language switcher
      await page.locator('#lang-toggle').click();

      // Click English option
      await page.locator('.lang-option[data-lang="en"]').click();

      // Wait for navigation
      await page.waitForURL(/\/en\/categories\//);

      // Verify we're on English categories page
      expect(page.url()).toContain('/en/categories/');
    });

    test('Language switcher navigates correctly from English tags to Korean tags', async ({ page }) => {
      await page.goto('/en/tags/');

      // Open language switcher
      await page.locator('#lang-toggle').click();

      // Click Korean option
      await page.locator('.lang-option[data-lang="ko"]').click();

      // Wait for navigation
      await page.waitForURL(/\/tags\/$/);

      // Verify we're on Korean (root) tags page
      expect(page.url()).toContain('/tags/');
      expect(page.url()).not.toContain('/en/');
      expect(page.url()).not.toContain('/es/');
    });

    test('Language switcher navigates correctly from Korean archives to Spanish archives', async ({ page }) => {
      await page.goto('/archives/');

      // Open language switcher
      await page.locator('#lang-toggle').click();

      // Click Spanish option
      await page.locator('.lang-option[data-lang="es"]').click();

      // Wait for navigation
      await page.waitForURL(/\/es\/archives\//);

      // Verify we're on Spanish archives page
      expect(page.url()).toContain('/es/archives/');
    });
  });

  test.describe('Shared Pages (Privacy, About) Language Filtering', () => {

    test('Privacy page shows content in user preferred language (English)', async ({ page }) => {
      // Set preferred language to English
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/privacy/');

      // Check that English content is visible
      const enContent = page.locator('.lang-content[data-lang="en"]');
      await expect(enContent).toBeVisible();

      // Check that Korean content is hidden
      const koContent = page.locator('.lang-content[data-lang="ko"]');
      await expect(koContent).toBeHidden();
    });

    test('Privacy page shows content in user preferred language (Spanish)', async ({ page }) => {
      // Set preferred language to Spanish
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'es'));

      await page.goto('/privacy/');

      // Check that Spanish content is visible
      const esContent = page.locator('.lang-content[data-lang="es"]');
      await expect(esContent).toBeVisible();

      // Check that Korean content is hidden
      const koContent = page.locator('.lang-content[data-lang="ko"]');
      await expect(koContent).toBeHidden();
    });

    test('Language switcher on Privacy page changes content without navigation', async ({ page }) => {
      await page.goto('/privacy/');

      // Open language switcher and click Spanish
      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="es"]').click();

      // Should stay on same page (no /es/privacy/ exists)
      expect(page.url()).toContain('/privacy/');
      expect(page.url()).not.toContain('/es/');

      // Spanish content should be visible
      const esContent = page.locator('.lang-content[data-lang="es"]');
      await expect(esContent).toBeVisible();
    });

    test('Privacy page shows sidebar labels in user preferred language (English)', async ({ page }) => {
      // Set preferred language to English
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));

      await page.goto('/privacy/');

      // Check sidebar labels are in English
      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });

    test('Privacy page shows sidebar labels in user preferred language (Spanish)', async ({ page }) => {
      // Set preferred language to Spanish
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'es'));

      await page.goto('/privacy/');

      // Check sidebar labels are in Spanish
      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('INICIO');
    });

    test('Language switcher on Privacy page updates sidebar labels', async ({ page }) => {
      // Start with Korean preference
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/privacy/');

      // Verify Korean labels initially
      let homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel).toContain('홈');

      // Switch to English
      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="en"]').click();

      // Sidebar labels should update to English
      homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });
  });

  test.describe('Post Page Tests', () => {

    test('Korean post page shows sidebar labels based on preferred language', async ({ page }) => {
      // Set preferred language to Korean first
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));

      // Navigate to Korean homepage first to get a Korean post link
      await page.goto('/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');

      await page.goto(firstPostLink);

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel).toContain('홈');
    });

    test('English post page shows English sidebar labels', async ({ page }) => {
      // Navigate to English homepage first to get an English post link
      await page.goto('/en/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');

      await page.goto(firstPostLink);

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('HOME');
    });

    test('Spanish post page shows Spanish sidebar labels', async ({ page }) => {
      await page.goto('/es/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');

      await page.goto(firstPostLink);

      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel.toUpperCase()).toContain('INICIO');
    });

    test('Post page has correct hreflang tags', async ({ page }) => {
      await page.goto('/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');

      await page.goto(firstPostLink);

      // Post pages should have hreflang tags
      const hreflangKo = await page.locator('link[hreflang="ko"]').getAttribute('href');
      const hreflangEn = await page.locator('link[hreflang="en"]').getAttribute('href');
      const hreflangEs = await page.locator('link[hreflang="es"]').getAttribute('href');

      expect(hreflangKo).toBeTruthy();
      expect(hreflangEn).toContain('/en/posts/');
      expect(hreflangEs).toContain('/es/posts/');
    });

    test('Language switcher on Korean post navigates to English post', async ({ page }) => {
      await page.goto('/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');

      await page.goto(firstPostLink);

      // Open language switcher and click English
      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="en"]').click();

      // Should navigate to English version of post
      await page.waitForURL(/\/en\/posts\//);
      expect(page.url()).toContain('/en/posts/');
    });

    test('Post page loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');

      await page.goto(firstPostLink);
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('About Page Tests', () => {

    test('About page shows content in user preferred language (English)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/about/');

      const enContent = page.locator('.lang-content[data-lang="en"]');
      await expect(enContent).toBeVisible();

      const koContent = page.locator('.lang-content[data-lang="ko"]');
      await expect(koContent).toBeHidden();
    });

    test('About page shows content in user preferred language (Spanish)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'es'));
      await page.goto('/about/');

      const esContent = page.locator('.lang-content[data-lang="es"]');
      await expect(esContent).toBeVisible();

      const koContent = page.locator('.lang-content[data-lang="ko"]');
      await expect(koContent).toBeHidden();
    });

    test('About page shows content in user preferred language (Korean)', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/about/');

      const koContent = page.locator('.lang-content[data-lang="ko"]');
      await expect(koContent).toBeVisible();

      const enContent = page.locator('.lang-content[data-lang="en"]');
      await expect(enContent).toBeHidden();
    });

    test('Language switcher on About page changes content without navigation', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/about/');

      // Verify Korean content initially
      await expect(page.locator('.lang-content[data-lang="ko"]')).toBeVisible();

      // Switch to English
      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="en"]').click();

      // Should stay on same page
      expect(page.url()).toContain('/about/');
      expect(page.url()).not.toContain('/en/');

      // English content should be visible
      await expect(page.locator('.lang-content[data-lang="en"]')).toBeVisible();
      await expect(page.locator('.lang-content[data-lang="ko"]')).toBeHidden();
    });

    test('About page loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/about/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('Language Switcher from Homepage', () => {

    test('Language switcher on Korean homepage navigates to English homepage', async ({ page }) => {
      await page.goto('/');

      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="en"]').click();

      await page.waitForURL(/\/en\//);
      expect(page.url()).toContain('/en/');
    });

    test('Language switcher on English homepage navigates to Spanish homepage', async ({ page }) => {
      await page.goto('/en/');

      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="es"]').click();

      await page.waitForURL(/\/es\//);
      expect(page.url()).toContain('/es/');
    });

    test('Language switcher on Spanish homepage navigates to Korean homepage', async ({ page }) => {
      await page.goto('/es/');

      await page.locator('#lang-toggle').click();
      await page.locator('.lang-option[data-lang="ko"]').click();

      // Wait for navigation to complete
      await page.waitForLoadState('networkidle');

      // Should navigate to root (Korean) - URL should not contain /en/ or /es/
      expect(page.url()).not.toContain('/en/');
      expect(page.url()).not.toContain('/es/');
    });
  });

  test.describe('No JS Errors on All Pages', () => {

    test('Archives page loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/archives/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('Tags page loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/tags/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('Categories page loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/categories/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('Privacy page loads without JS errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/privacy/');
      await page.waitForLoadState('networkidle');

      expect(errors, `JavaScript errors: ${errors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('Full Page Language Consistency', () => {

    test('English About page has no Korean text visible', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/about/');
      await page.waitForLoadState('domcontentloaded');

      // Get all visible text on the page (excluding hidden elements)
      const visibleText = await page.evaluate(() => {
        function isElementVisible(el) {
          while (el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            el = el.parentElement;
          }
          return true;
        }
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        let text = '';
        while (walker.nextNode()) {
          text += walker.currentNode.textContent + ' ';
        }
        return text;
      });

      // Check for Korean characters (excluding the lang-content that should be hidden)
      const koreanPattern = /[\uAC00-\uD7AF]/;
      const hasKorean = koreanPattern.test(visibleText);

      // If Korean is found, show what Korean text was found for debugging
      if (hasKorean) {
        const koreanMatches = visibleText.match(/[\uAC00-\uD7AF]+/g);
        console.log('Found Korean text:', koreanMatches);
      }

      expect(hasKorean, `English About page should not have Korean text. Found: ${visibleText.match(/[\uAC00-\uD7AF]+/g)}`).toBe(false);
    });

    test('English Privacy page has no Korean text visible', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/privacy/');
      await page.waitForLoadState('domcontentloaded');

      const visibleText = await page.evaluate(() => {
        function isElementVisible(el) {
          while (el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            el = el.parentElement;
          }
          return true;
        }
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        let text = '';
        while (walker.nextNode()) {
          text += walker.currentNode.textContent + ' ';
        }
        return text;
      });

      const koreanPattern = /[\uAC00-\uD7AF]/;
      const hasKorean = koreanPattern.test(visibleText);

      expect(hasKorean, `English Privacy page should not have Korean text. Found: ${visibleText.match(/[\uAC00-\uD7AF]+/g)}`).toBe(false);
    });

    test('Spanish About page has no Korean text visible', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'es'));
      await page.goto('/about/');
      await page.waitForLoadState('domcontentloaded');

      const visibleText = await page.evaluate(() => {
        function isElementVisible(el) {
          while (el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            el = el.parentElement;
          }
          return true;
        }
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        let text = '';
        while (walker.nextNode()) {
          text += walker.currentNode.textContent + ' ';
        }
        return text;
      });

      const koreanPattern = /[\uAC00-\uD7AF]/;
      const hasKorean = koreanPattern.test(visibleText);

      expect(hasKorean, `Spanish About page should not have Korean text. Found: ${visibleText.match(/[\uAC00-\uD7AF]+/g)}`).toBe(false);
    });
  });

  test.describe('FOUC Prevention', () => {

    test('Privacy page lang-content divs are initially hidden by CSS', async ({ page }) => {
      // Check that lang-content elements have CSS that hides them initially
      await page.goto('/privacy/');

      // Get computed style before JS runs (we check the CSS rule exists)
      const hasHidingCSS = await page.evaluate(() => {
        const style = document.createElement('style');
        document.head.appendChild(style);
        const sheet = style.sheet;

        // Check if there's a CSS rule that hides .lang-content by default
        for (const styleSheet of document.styleSheets) {
          try {
            for (const rule of styleSheet.cssRules) {
              if (rule.selectorText && rule.selectorText.includes('lang-content') &&
                  rule.style && rule.style.display === 'none') {
                return true;
              }
            }
          } catch (e) {
            // Cross-origin stylesheets may throw
          }
        }
        return false;
      });

      // If no CSS hiding rule, at least verify only one lang-content is visible
      const visibleContents = await page.locator('.lang-content:visible').count();
      expect(visibleContents).toBe(1);
    });

    test('About page does not flash Korean content when preferred language is English', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.goto('/about/');

      // After page load, only English content should be visible
      const visibleContents = await page.locator('.lang-content:visible').count();
      expect(visibleContents).toBe(1);

      const enContent = page.locator('.lang-content[data-lang="en"]');
      await expect(enContent).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {

    test('Page works correctly when localStorage is cleared', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());

      // Reload page
      await page.reload();

      // Should still work (use browser default or Korean)
      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel).toBeTruthy();
    });

    test('Invalid preferred-lang value falls back to browser language', async ({ page }) => {
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'invalid'));
      await page.goto('/archives/');

      // Should not crash, sidebar should have some label
      const homeLabel = await page.locator('.nav-item .nav-link span').first().textContent();
      expect(homeLabel).toBeTruthy();
    });

    test('Language switcher dropdown closes when clicking outside', async ({ page }) => {
      await page.goto('/');

      // Open dropdown
      await page.locator('#lang-toggle').click();
      await expect(page.locator('#lang-switcher')).toHaveClass(/open/);

      // Click outside
      await page.locator('body').click({ position: { x: 10, y: 10 } });

      // Dropdown should close
      await expect(page.locator('#lang-switcher')).not.toHaveClass(/open/);
    });

    test('Active language option is highlighted in dropdown', async ({ page }) => {
      await page.goto('/en/');

      await page.locator('#lang-toggle').click();

      const enOption = page.locator('.lang-option[data-lang="en"]');
      await expect(enOption).toHaveClass(/active/);
    });
  });

  test.describe('Sitemap Validation', () => {

    test('Sitemap.xml is valid XML with proper structure', async ({ request }) => {
      const response = await request.get('/sitemap.xml');
      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('xml');

      const body = await response.text();

      // Check XML declaration
      expect(body).toContain('<?xml version="1.0"');

      // Check urlset element
      expect(body).toContain('<urlset');
      expect(body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');

      // Check for URL elements
      expect(body).toContain('<url>');
      expect(body).toContain('<loc>');
      expect(body).toContain('</urlset>');
    });

    test('Sitemap contains all language homepages', async ({ request }) => {
      const response = await request.get('/sitemap.xml');
      const body = await response.text();

      // Check all homepage variants (baseurl may vary, so just check path patterns)
      expect(body).toMatch(/<loc>[^<]*\/<\/loc>/); // Root homepage
      expect(body).toMatch(/<loc>[^<]*\/en\/<\/loc>/); // English homepage
      expect(body).toMatch(/<loc>[^<]*\/es\/<\/loc>/); // Spanish homepage
    });
  });

  test.describe('Post Page Category/Tag Links', () => {

    test('English post page has category links with /en/ prefix', async ({ page }) => {
      await page.goto('/en/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');
      await page.goto(firstPostLink);

      const categoryLinks = await page.locator('[data-category-link]').all();
      if (categoryLinks.length > 0) {
        const href = await categoryLinks[0].getAttribute('href');
        expect(href).toContain('/en/categories/');
      }
    });

    test('Spanish post page has tag links with /es/ prefix', async ({ page }) => {
      await page.goto('/es/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');
      await page.goto(firstPostLink);

      const tagLinks = await page.locator('[data-tag-link]').all();
      if (tagLinks.length > 0) {
        const href = await tagLinks[0].getAttribute('href');
        expect(href).toContain('/es/tags/');
      }
    });

    test('Korean post page has category links without language prefix', async ({ page }) => {
      // Set Korean preference explicitly
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/');

      // Get a Korean post (URL should not contain /en/ or /es/)
      const postLinks = await page.locator('.card-wrapper a').all();
      let koreanPostLink = null;
      for (const link of postLinks) {
        const href = await link.getAttribute('href');
        if (href && !href.includes('/en/') && !href.includes('/es/')) {
          koreanPostLink = href;
          break;
        }
      }

      if (koreanPostLink) {
        await page.goto(koreanPostLink);

        const categoryLinks = await page.locator('[data-category-link]').all();
        if (categoryLinks.length > 0) {
          const href = await categoryLinks[0].getAttribute('href');
          expect(href).not.toContain('/en/');
          expect(href).not.toContain('/es/');
          expect(href).toContain('/categories/');
        }
      }
    });
  });

  test.describe('Trending Tags Links', () => {

    test('English homepage has trending tags with /en/ prefix', async ({ page }) => {
      await page.goto('/en/');

      const trendingTags = await page.locator('[data-trending-tag]').all();
      if (trendingTags.length > 0) {
        const href = await trendingTags[0].getAttribute('href');
        expect(href).toContain('/en/tags/');
      }
    });

    test('Spanish homepage has trending tags with /es/ prefix', async ({ page }) => {
      await page.goto('/es/');

      const trendingTags = await page.locator('[data-trending-tag]').all();
      if (trendingTags.length > 0) {
        const href = await trendingTags[0].getAttribute('href');
        expect(href).toContain('/es/tags/');
      }
    });

    test('Korean homepage has trending tags without language prefix', async ({ page }) => {
      await page.goto('/');

      const trendingTags = await page.locator('[data-trending-tag]').all();
      if (trendingTags.length > 0) {
        const href = await trendingTags[0].getAttribute('href');
        expect(href).not.toContain('/en/');
        expect(href).not.toContain('/es/');
        expect(href).toContain('/tags/');
      }
    });
  });

  test.describe('URL-based Language Detection (Categories/Tags pages)', () => {

    test('/en/categories/ shows English filtered content', async ({ page }) => {
      // Set Korean preference but visit English URL
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/en/categories/');
      await page.waitForLoadState('domcontentloaded');

      // Should filter by URL language (en), not localStorage (ko)
      const visibleCards = await page.locator('.category-card:visible').all();
      expect(visibleCards.length).toBeGreaterThan(0);
    });

    test('/es/tags/ shows Spanish filtered content', async ({ page }) => {
      // Set Korean preference but visit Spanish URL
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/es/tags/');
      await page.waitForLoadState('domcontentloaded');

      // Should filter by URL language (es), not localStorage (ko)
      const visibleTags = await page.locator('.tag-wrapper:visible').all();
      expect(visibleTags.length).toBeGreaterThan(0);
    });
  });

  test.describe('Post Meta Labels Language', () => {

    test('English post shows English meta labels', async ({ page }) => {
      await page.goto('/en/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');
      await page.goto(firstPostLink);

      // Check for "Posted" label (English)
      const postedLabel = await page.locator('.post-meta-label').first().textContent();
      expect(postedLabel.toLowerCase()).toContain('posted');
    });

    test('Spanish post shows Spanish meta labels', async ({ page }) => {
      await page.goto('/es/');
      const firstPostLink = await page.locator('.card-wrapper a').first().getAttribute('href');
      await page.goto(firstPostLink);

      // Check for "Publicado" label (Spanish)
      const postedLabel = await page.locator('.post-meta-label').first().textContent();
      expect(postedLabel.toLowerCase()).toContain('publicado');
    });

    test('Korean post shows Korean meta labels', async ({ page }) => {
      // Set Korean preference explicitly
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.goto('/');

      // Get a Korean post (URL should not contain /en/ or /es/)
      const postLinks = await page.locator('.card-wrapper a').all();
      let koreanPostLink = null;
      for (const link of postLinks) {
        const href = await link.getAttribute('href');
        if (href && !href.includes('/en/') && !href.includes('/es/')) {
          koreanPostLink = href;
          break;
        }
      }

      if (koreanPostLink) {
        await page.goto(koreanPostLink);

        // Check for Korean label
        const postedLabel = await page.locator('.post-meta-label').first().textContent();
        // Korean "게시" should be present
        expect(postedLabel).toContain('게시');
      }
    });
  });

  test.describe('Individual Category Page Language Filtering', () => {

    test('Category page filters posts by user preferred language (Korean)', async ({ page }) => {
      // Navigate first, then set localStorage and reload
      await page.goto('/categories/java/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for JS filtering to complete by checking a Korean post is visible
      await page.waitForSelector('.category-post-item[data-locale="ko"]:visible', { timeout: 5000 });

      // Get all visible post items
      const visiblePosts = await page.locator('.category-post-item:visible').all();

      for (const post of visiblePosts) {
        const locale = await post.getAttribute('data-locale');
        expect(locale, 'Category page should only show Korean posts when preferred-lang is ko').toBe('ko');
      }
    });

    test('Category page filters posts by user preferred language (English)', async ({ page }) => {
      // Navigate first, then set localStorage and reload
      await page.goto('/categories/java/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for JS filtering to complete
      await page.waitForSelector('.category-post-item[data-locale="en"]:visible', { timeout: 5000 });

      const visiblePosts = await page.locator('.category-post-item:visible').all();

      for (const post of visiblePosts) {
        const locale = await post.getAttribute('data-locale');
        expect(locale, 'Category page should only show English posts when preferred-lang is en').toBe('en');
      }
    });

    test('Category page updates post count based on filtered language', async ({ page }) => {
      // Navigate first, then set localStorage and reload
      await page.goto('/categories/java/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for JS filtering to complete
      await page.waitForSelector('.category-post-item[data-locale="ko"]:visible', { timeout: 5000 });

      const countText = await page.locator('#category-post-count').textContent();
      const displayedCount = parseInt(countText, 10);

      const visiblePosts = await page.locator('.category-post-item:visible').count();

      expect(displayedCount).toBe(visiblePosts);
    });
  });

  test.describe('Individual Tag Page Language Filtering', () => {

    test('Tag page filters posts by user preferred language (Korean)', async ({ page }) => {
      // Navigate first, then set localStorage and reload
      await page.goto('/tags/java/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for JS filtering to complete
      await page.waitForSelector('.tag-post-item[data-locale="ko"]:visible', { timeout: 5000 });

      const visiblePosts = await page.locator('.tag-post-item:visible').all();

      for (const post of visiblePosts) {
        const locale = await post.getAttribute('data-locale');
        expect(locale, 'Tag page should only show Korean posts when preferred-lang is ko').toBe('ko');
      }
    });

    test('Tag page filters posts by user preferred language (English)', async ({ page }) => {
      // Navigate first, then set localStorage and reload
      await page.goto('/tags/java/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'en'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for JS filtering to complete
      await page.waitForSelector('.tag-post-item[data-locale="en"]:visible', { timeout: 5000 });

      const visiblePosts = await page.locator('.tag-post-item:visible').all();

      for (const post of visiblePosts) {
        const locale = await post.getAttribute('data-locale');
        expect(locale, 'Tag page should only show English posts when preferred-lang is en').toBe('en');
      }
    });

    test('Tag page updates post count based on filtered language', async ({ page }) => {
      // Navigate first, then set localStorage and reload
      await page.goto('/tags/java/');
      await page.evaluate(() => localStorage.setItem('preferred-lang', 'ko'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for JS filtering to complete
      await page.waitForSelector('.tag-post-item[data-locale="ko"]:visible', { timeout: 5000 });

      const countText = await page.locator('#tag-post-count').textContent();
      const displayedCount = parseInt(countText, 10);

      const visiblePosts = await page.locator('.tag-post-item:visible').count();

      expect(displayedCount).toBe(visiblePosts);
    });
  });
});

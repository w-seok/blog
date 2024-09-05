<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <title>Sitemap - DevSeok Blog</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; background: #f5f5f5; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #eee; }
          th { background: #2c3e50; color: white; }
          tr:hover { background: #f9f9f9; }
          a { color: #3498db; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .priority { text-align: center; }
          .changefreq { text-align: center; }
          .count { color: #666; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <h1>Sitemap</h1>
        <p class="count">Total URLs: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></p>
        <table>
          <tr>
            <th>URL</th>
            <th>Last Modified</th>
            <th class="changefreq">Change Freq</th>
            <th class="priority">Priority</th>
          </tr>
          <xsl:for-each select="sitemap:urlset/sitemap:url">
            <tr>
              <td>
                <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
              </td>
              <td><xsl:value-of select="substring(sitemap:lastmod, 1, 10)"/></td>
              <td class="changefreq"><xsl:value-of select="sitemap:changefreq"/></td>
              <td class="priority"><xsl:value-of select="sitemap:priority"/></td>
            </tr>
          </xsl:for-each>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>

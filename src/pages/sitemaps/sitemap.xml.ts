import { getCollection } from "astro:content";

export async function GET() {
  const site = import.meta.env.SITE; // must be set in astro.config.mjs
  const posts = await getCollection("posts"); // collection folder: src/content/posts/

  const urls = [
    // static pages
    { loc: `${site}/` },
    { loc: `${site}/posts/` },

    // dynamic posts
    ...posts.map((entry) => {
      return {
        loc: `${site}/posts/${entry.slug}/`,
      };
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => {
    return `  <url>
    <loc>${url.loc}</loc>
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

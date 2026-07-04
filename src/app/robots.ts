import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pichat3932.builtwithrocket.new';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/social-feed', '/communities', '/reels', '/search'],
        disallow: ['/api/', '/profile', '/messages', '/chats-screen', '/notifications'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

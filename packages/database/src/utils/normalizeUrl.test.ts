import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeUrl, detectPlatform, isValidUrl } from './normalizeUrl';

describe('normalizeUrl', () => {
  describe('Basic URL normalization', () => {
    it('removes tracking parameters and trailing slashes', () => {
      const url =
        'https://www.example.com/news/article/?utm_source=twitter&utm_medium=social&utm_campaign=summer&fbclid=123456&ref=share';
      const expected = 'https://example.com/news/article';
      assert.strictEqual(normalizeUrl(url), expected);
    });

    it('lowercases the hostname and removes www.', () => {
      const url = 'HTTPS://WWW.EXAMPLE.COM/Some/Path';
      const expected = 'https://example.com/Some/Path';
      assert.strictEqual(normalizeUrl(url), expected);
    });

    it('removes URL fragments', () => {
      const url = 'https://example.com/article#heading-1';
      const expected = 'https://example.com/article';
      assert.strictEqual(normalizeUrl(url), expected);
    });

    it('sorts remaining query parameters alphabetically', () => {
      const url = 'https://example.com/search?z=last&a=first&m=middle&utm_content=strip';
      const expected = 'https://example.com/search?a=first&m=middle&z=last';
      assert.strictEqual(normalizeUrl(url), expected);
    });

    it('removes trailing slash from root domain', () => {
      assert.strictEqual(normalizeUrl('https://example.com/'), 'https://example.com');
      assert.strictEqual(normalizeUrl('https://example.com'), 'https://example.com');
    });

    it('handles URLs without protocol by defaulting to https', () => {
      assert.strictEqual(
        normalizeUrl('example.com/path/?utm_source=test'),
        'https://example.com/path'
      );
    });

    it('removes various tracking parameters like igshid, si, feature, t', () => {
      const url =
        'https://example.com/video?id=42&si=spotify123&feature=related&t=100&igshid=ig123';
      const expected = 'https://example.com/video?id=42';
      assert.strictEqual(normalizeUrl(url), expected);
    });
  });

  describe('Instagram URL normalization', () => {
    it('normalizes Instagram post URLs with shortcodes', () => {
      const url = 'https://www.instagram.com/p/Cx890ABC/?utm_source=ig_web_copy_link';
      assert.strictEqual(normalizeUrl(url), 'https://instagram.com/p/Cx890ABC/');
    });

    it('normalizes Instagram reel URLs', () => {
      const url = 'https://www.instagram.com/reel/C-xyz123/?igshid=abc123';
      assert.strictEqual(normalizeUrl(url), 'https://instagram.com/reel/C-xyz123/');
    });

    it('normalizes Instagram reels plural to /reel/', () => {
      const url = 'https://instagram.com/reels/C-xyz123/';
      assert.strictEqual(normalizeUrl(url), 'https://instagram.com/reel/C-xyz123/');
    });

    it('normalizes instagr.am short domain to instagram.com', () => {
      const url = 'https://instagr.am/p/Cx890ABC';
      assert.strictEqual(normalizeUrl(url), 'https://instagram.com/p/Cx890ABC/');
    });

    it('normalizes IGTV URLs to /p/', () => {
      const url = 'https://www.instagram.com/tv/Cx890ABC/?ref=share';
      assert.strictEqual(normalizeUrl(url), 'https://instagram.com/p/Cx890ABC/');
    });

    it('normalizes Instagram profile URLs', () => {
      const url = 'https://www.instagram.com/someuser/?utm_medium=copy_link';
      assert.strictEqual(normalizeUrl(url), 'https://instagram.com/someuser');
    });
  });

  describe('TikTok URL normalization', () => {
    it('normalizes TikTok video URL with @ username', () => {
      const url =
        'https://www.tiktok.com/@creator123/video/7123456789012345678?is_from_webapp=1&sender_device=pc&t=abc';
      assert.strictEqual(
        normalizeUrl(url),
        'https://tiktok.com/@creator123/video/7123456789012345678'
      );
    });

    it('normalizes TikTok video URL without leading @', () => {
      const url = 'https://tiktok.com/creator123/video/7123456789012345678/';
      assert.strictEqual(
        normalizeUrl(url),
        'https://tiktok.com/@creator123/video/7123456789012345678'
      );
    });

    it('normalizes mobile TikTok URL', () => {
      const url = 'https://m.tiktok.com/@creator123/video/7123456789012345678';
      assert.strictEqual(
        normalizeUrl(url),
        'https://tiktok.com/@creator123/video/7123456789012345678'
      );
    });

    it('normalizes TikTok profile URL', () => {
      const url = 'https://www.tiktok.com/@creator123/?lang=en';
      assert.strictEqual(normalizeUrl(url), 'https://tiktok.com/@creator123?lang=en');
    });
  });

  describe('Twitter/X URL normalization', () => {
    it('normalizes x.com to twitter.com and extracts /status/{id}', () => {
      const url = 'https://x.com/jack/status/20?s=20&t=abcdef';
      assert.strictEqual(normalizeUrl(url), 'https://twitter.com/jack/status/20');
    });

    it('strips extra sub-paths like /photo/1 after status id', () => {
      const url = 'https://x.com/user/status/1234567890/photo/1';
      assert.strictEqual(normalizeUrl(url), 'https://twitter.com/user/status/1234567890');
    });

    it('handles mobile.twitter.com and www.x.com', () => {
      const url1 = 'https://mobile.twitter.com/jack/status/20/';
      assert.strictEqual(normalizeUrl(url1), 'https://twitter.com/jack/status/20');

      const url2 = 'https://www.x.com/jack/status/20';
      assert.strictEqual(normalizeUrl(url2), 'https://twitter.com/jack/status/20');
    });

    it('handles /i/status/{id} URLs', () => {
      const url = 'https://x.com/i/status/9876543210?ref_src=twsrc';
      assert.strictEqual(normalizeUrl(url), 'https://twitter.com/i/status/9876543210');
    });

    it('normalizes non-status Twitter/X profile URLs', () => {
      const url = 'https://x.com/elonmusk/';
      assert.strictEqual(normalizeUrl(url), 'https://twitter.com/elonmusk');
    });
  });

  describe('Platform detection', () => {
    it('detects Instagram URLs', () => {
      assert.strictEqual(detectPlatform('https://instagram.com/p/123'), 'instagram');
      assert.strictEqual(detectPlatform('https://www.instagram.com/reel/123'), 'instagram');
      assert.strictEqual(detectPlatform('https://instagr.am/p/123'), 'instagram');
      assert.strictEqual(detectPlatform('instagram.com/username'), 'instagram');
    });

    it('detects TikTok URLs', () => {
      assert.strictEqual(detectPlatform('https://tiktok.com/@user/video/123'), 'tiktok');
      assert.strictEqual(detectPlatform('https://www.tiktok.com/@user'), 'tiktok');
      assert.strictEqual(detectPlatform('https://vm.tiktok.com/ZM8abc/'), 'tiktok');
    });

    it('detects Twitter/X URLs', () => {
      assert.strictEqual(detectPlatform('https://twitter.com/user/status/123'), 'twitter');
      assert.strictEqual(detectPlatform('https://x.com/user/status/123'), 'twitter');
      assert.strictEqual(detectPlatform('https://mobile.twitter.com/user'), 'twitter');
      assert.strictEqual(detectPlatform('x.com/i/status/123'), 'twitter');
    });

    it('detects other URLs', () => {
      assert.strictEqual(detectPlatform('https://example.com/article'), 'other');
      assert.strictEqual(detectPlatform('https://youtube.com/watch?v=123'), 'other');
      assert.strictEqual(detectPlatform('https://facebook.com/post/123'), 'other');
      assert.strictEqual(detectPlatform('invalid-string'), 'other');
      assert.strictEqual(detectPlatform(''), 'other');
    });
  });

  describe('Invalid URL handling', () => {
    it('identifies valid URLs correctly', () => {
      assert.strictEqual(isValidUrl('https://example.com'), true);
      assert.strictEqual(isValidUrl('http://example.com/path?a=1'), true);
      assert.strictEqual(isValidUrl('example.com/path'), true);
      assert.strictEqual(isValidUrl('https://sub.domain.co.id/test'), true);
    });

    it('identifies invalid URLs correctly', () => {
      assert.strictEqual(isValidUrl(''), false);
      assert.strictEqual(isValidUrl('   '), false);
      assert.strictEqual(isValidUrl('not a url'), false);
      assert.strictEqual(isValidUrl('invalid_string_without_dot'), false);
      assert.strictEqual(isValidUrl('http://'), false);
      assert.strictEqual(isValidUrl('https://'), false);
      assert.strictEqual(isValidUrl('ftp://example.com'), false);
      assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
      assert.strictEqual(isValidUrl('https://.com'), false);
    });

    it('throws error when normalizing invalid URLs', () => {
      assert.throws(() => normalizeUrl(''), /Invalid URL/);
      assert.throws(() => normalizeUrl('not a valid url'), /Invalid URL/);
      assert.throws(() => normalizeUrl('ftp://example.com'), /Invalid URL/);
    });
  });

  describe('Idempotency', () => {
    it('normalizing twice gives the exact same result for general URLs', () => {
      const url = 'https://www.example.com/path/?utm_source=fb&z=1&a=2#tag';
      const first = normalizeUrl(url);
      const second = normalizeUrl(first);
      assert.strictEqual(second, first);
    });

    it('normalizing twice gives the exact same result for Instagram URLs', () => {
      const url = 'https://www.instagram.com/reel/C-xyz123/?igshid=abc';
      const first = normalizeUrl(url);
      const second = normalizeUrl(first);
      assert.strictEqual(second, first);
      assert.strictEqual(second, 'https://instagram.com/reel/C-xyz123/');
    });

    it('normalizing twice gives the exact same result for TikTok URLs', () => {
      const url = 'https://www.tiktok.com/@creator/video/1234567890?t=123';
      const first = normalizeUrl(url);
      const second = normalizeUrl(first);
      assert.strictEqual(second, first);
      assert.strictEqual(second, 'https://tiktok.com/@creator/video/1234567890');
    });

    it('normalizing twice gives the exact same result for Twitter URLs', () => {
      const url = 'https://x.com/jack/status/20?s=20';
      const first = normalizeUrl(url);
      const second = normalizeUrl(first);
      assert.strictEqual(second, first);
      assert.strictEqual(second, 'https://twitter.com/jack/status/20');
    });
  });
});

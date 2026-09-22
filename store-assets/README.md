# UptimeMonke — store submission assets

Generated from the source images in `promo-resources/` for the App Store and
Google Play listings.

## Privacy policy — resolved

`https://uptimemonke.com/privacy` is live and serves a real policy, written
from an audit of what the code stores rather than a template. It is linked from
the landing and dashboard footers. Verified in production on 23 September 2026.

The policy describes exactly what the Data safety section in
`copy/google-play.md` declares: email address, display name and photo URL,
Firebase account id, monitor configuration, alert contact destinations, check
results and incidents, the FCM device token, and GA4 analytics carrying an
opaque workspace id. **If you change what the app collects, change the policy in
the same commit** — a store listing whose declaration and policy disagree is
rejected, and the disagreement is what gets noticed.

## Layout

```
store-assets/
  google-play/
    icon/icon-512.png                          512 x 512, no alpha
    feature-graphic/
      feature-graphic-1024x500.png             exact Play spec (primary)
      feature-graphic-alt-1024x500.png         exact Play spec (alternate)
      feature-graphic-2x-2048x990.png          high-res master
    screenshots/
      raw-1080x1920/                           clean screens
      captioned-1080x1920/                     branded + headline
  apple-app-store/
    icon/icon-1024.png                        1024 x 1024, no alpha
    screenshots/
      raw-6.7-1290x2796/
      raw-6.5-1242x2688/
      captioned-6.7-1290x2796/
  copy/
    apple-app-store.md                        titles, description, keywords
    google-play.md                            description, data safety
```

## Asset spec conformance

| Store | Asset | Required | Produced | Alpha |
|---|---|---|---|---|
| Play | Icon | 512 x 512 | 512 x 512 | none |
| Play | Feature graphic | 1024 x 500 | 1024 x 500 | none |
| Play | Screenshots | 2–8, 320–3840 px, 16:9 or 9:16 | 1080 x 1920 (9:16) | none |
| Apple | Icon | 1024 x 1024 | 1024 x 1024 | none |
| Apple | 6.7" screenshots | 1290 x 2796 | 1290 x 2796 | none |
| Apple | 6.5" screenshots | 1242 x 2688 | 1242 x 2688 | none |

Apple's required 6.7"/6.9" slot needs the 1290 x 2796 set; the 1242 x 2688 set
covers the 6.5" slot. Both are provided because Apple requires specific sizes
per display class and will not accept arbitrary dimensions.

## Which screenshots to use

Source images that drove the set:

| File | Content |
|---|---|
| `IMG_7124.PNG` | Dashboard — 99.83% uptime, 10 monitors, monitor list |
| `Screenshot 2026-09-20 at 00.19.21.png` | Monitor detail — history, latency chart, incident log |
| `IMG_7125.PNG` | Sign-in screen — **not used**, a login screen is a weak first impression |

Two source screens plus one branded feature panel make up the three-screenshot
recommended set.

## Notes on the images

- Feature graphics come from the two 1024 x 500 `Gemini_Generated_Image_*` files,
  which already match Play's spec exactly. The 2976 x 1440 hero is retained as a
  high-resolution master and cropped for the branded screenshot panel.
- All output images are stripped of metadata and flattened to remove alpha.
  Apple rejects screenshots with transparency, and Play rejects a transparent
  icon.

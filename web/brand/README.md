# Brand assets

`mascot-source.jpeg` is the original mascot artwork. Every icon in the app is
derived from it, so re-crop from here rather than from a generated PNG.

Regenerate the full set:

```bash
BG="#0b131e"
# Head and shoulders, padded at the TOP so the jaw is never sliced. Cropping
# tighter cuts through the lower face and leaves a flat-bottomed head.
magick brand/mascot-source.jpeg -crop 1800x1536+340+0 +repage \
  -background "$BG" -gravity south -extent 1800x1800 /tmp/bust.png

magick /tmp/bust.png -resize 512x512 -strip -colors 256 src/app/icon.png
magick /tmp/bust.png -resize 512x512 -strip -colors 256 public/mascot.png
magick /tmp/bust.png -resize 192x192 -strip -colors 256 public/mascot-128.png
magick /tmp/bust.png -resize 180x180 -strip -colors 256 src/app/apple-icon.png
magick /tmp/bust.png -define icon:auto-resize=48,32,16 public/favicon.ico
```

The 256-colour quantisation is visually lossless on flat-shaded artwork and
cuts the icon from ~220 KB to ~55 KB — it is fetched on every page load.

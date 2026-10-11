# Brilliancy Research brand assets

`source/` contains the agency's original logo files, preserved without modification, including Illustrator artwork and all supplied exports. These files are not shipped in the application container.

`public/brand/wordmark.png` is an exact copy of `source/Brilliancy Research-01.png`. The transparent white/red horizontal wordmark is used on charcoal backgrounds in the sidebar and authentication screens. Using the supplied PNG preserves the lettering: the original wordmark SVGs reference Red Hat Display without embedding the font or outlining the text.

`public/brand/mark.svg` is an exact copy of `source/Brilliancy Research-04.svg`. This path-only monogram includes its original black background so the white lettering remains visible in light and dark browser tabs.

The artwork's red is `#F71B1B`. The interface pairs it with charcoal `#18181B`, white, neutral grays, and a darker action red `#C81717` for white button-label contrast. Success, warning, and error indicators retain distinct semantic colors. Portfolio theme controls remain independent of agency dashboard branding.

UI colors live in `src/app/globals.css`; the shared logo component is `src/components/brand-logo.tsx`. Deployment copies `public/` into the standalone container.

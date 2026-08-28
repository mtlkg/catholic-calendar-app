const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ICON = path.resolve("assets/icon.png"); // flat, no alpha, cream bg
const FG = path.resolve("assets/icon-foreground.png"); // padded logo, transparent
const BG = path.resolve("assets/icon-background.png"); // solid cream, 1024x1024
const OUT = path.resolve("public/icons");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  for (const size of [192, 512]) {
    await sharp(ICON).resize(size, size).png().toFile(path.join(OUT, `icon-${size}.png`));
  }

  // Maskable: padded foreground composited on the background so Android/PWA
  // installers can safely crop it to a circle without clipping the cross.
  for (const size of [192, 512]) {
    const bg = await sharp(BG).resize(size, size).toBuffer();
    const fg = await sharp(FG).resize(size, size).toBuffer();
    await sharp(bg)
      .composite([{ input: fg }])
      .png()
      .toFile(path.join(OUT, `maskable-${size}.png`));
  }

  await sharp(ICON).resize(180, 180).png().toFile(path.resolve("public/apple-touch-icon.png"));

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

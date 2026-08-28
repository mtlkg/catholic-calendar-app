const sharp = require("sharp");
const path = require("path");

const SRC = path.resolve("src/assets/logo.png");
const OUT_DIR = path.resolve("assets");
const CREAM = { r: 248, g: 246, b: 241, alpha: 1 }; // #f8f6f1

async function main() {
  // App icon: flatten transparency onto brand cream so iOS (which forbids
  // alpha in icons) and Android both get a clean square.
  await sharp(SRC)
    .resize(1024, 1024, { fit: "contain", background: CREAM })
    .flatten({ background: CREAM })
    .png()
    .toFile(path.join(OUT_DIR, "icon.png"));

  // Android adaptive icon: logo shrunk with padding on a transparent
  // foreground layer + solid background layer, so the OS mask doesn't clip it.
  await sharp(SRC)
    .resize(680, 680, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 172, bottom: 172, left: 172, right: 172, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT_DIR, "icon-foreground.png"));

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: CREAM },
  })
    .png()
    .toFile(path.join(OUT_DIR, "icon-background.png"));

  // Splash screen: logo centered on brand cream, generous padding so it
  // reads well once system-cropped to each device's aspect ratio.
  await sharp(SRC)
    .resize(900, 900, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
    .then((logoBuf) =>
      sharp({
        create: { width: 2732, height: 2732, channels: 4, background: CREAM },
      })
        .composite([{ input: logoBuf, gravity: "center" }])
        .png()
        .toFile(path.join(OUT_DIR, "splash.png"))
    );

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

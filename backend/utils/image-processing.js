const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const IMAGE_MAX_WIDTH = 1500;
const IMAGE_QUALITY = 80;

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function deleteLocalFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(`Failed to delete local file: ${filePath}`, error);
  }
}

function formatWatermarkTimestamp(timestamp) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::\d{2})?$/.exec(timestamp);

  if (!match) {
    return `${timestamp} WIB`;
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute} WIB`;
}

function buildWatermarkText({ username, actionLabel, timestamp }) {
  const safeUsername = String(username || "user").trim() || "user";
  return `"${safeUsername}" ${actionLabel} - ${formatWatermarkTimestamp(timestamp)}`;
}

function buildWatermarkSvg({ width, height, watermarkText }) {
  const fontSize = Math.max(20, Math.round(width * 0.022));
  const paddingX = Math.max(18, Math.round(width * 0.02));
  const paddingY = Math.max(16, Math.round(height * 0.025));
  const boxHeight = fontSize + paddingY * 2;
  const boxWidth = Math.min(
    width - paddingX * 2,
    Math.max(360, Math.round(width * 0.78)),
  );
  const boxX = width - boxWidth - paddingX;
  const boxY = height - boxHeight - paddingY;
  const textX = boxX + paddingX;
  const textY = boxY + boxHeight / 2 + fontSize * 0.35;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(fontSize * 0.45)}" fill="rgba(0, 0, 0, 0.68)" />
      <text
        x="${textX}"
        y="${textY}"
        fill="#ffffff"
        font-size="${fontSize}"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
      >${escapeXml(watermarkText)}</text>
    </svg>
  `;
}

async function processUploadedImage({
  inputPath,
  outputPath,
  maxWidth = IMAGE_MAX_WIDTH,
  watermarkText = null,
}) {
  ensureDirectoryExists(path.dirname(outputPath));
  const resolvedInputPath = path.resolve(inputPath);
  const resolvedOutputPath = path.resolve(outputPath);
  const tempOutputPath =
    resolvedInputPath === resolvedOutputPath
      ? `${resolvedOutputPath}.tmp.jpg`
      : resolvedOutputPath;

  const inputImage = sharp(resolvedInputPath, { failOnError: false }).rotate();
  const metadata = await inputImage.metadata();
  const targetWidth = metadata.width
    ? Math.min(metadata.width, maxWidth)
    : maxWidth;
  const targetHeight =
    metadata.width && metadata.height
      ? Math.round(metadata.height * (targetWidth / metadata.width))
      : maxWidth;

  let pipeline = sharp(resolvedInputPath, { failOnError: false })
    .rotate()
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" });

  if (watermarkText) {
    pipeline = pipeline.composite([
      {
        input: Buffer.from(
          buildWatermarkSvg({
            width: targetWidth,
            height: targetHeight,
            watermarkText,
          }),
        ),
        left: 0,
        top: 0,
      },
    ]);
  }

  await pipeline
    .jpeg({
      quality: IMAGE_QUALITY,
      mozjpeg: true,
    })
    .toFile(tempOutputPath);

  if (resolvedInputPath === resolvedOutputPath) {
    deleteLocalFile(resolvedInputPath);
  }

  fs.renameSync(tempOutputPath, resolvedOutputPath);

  if (resolvedInputPath !== resolvedOutputPath) {
    deleteLocalFile(resolvedInputPath);
  }
}

module.exports = {
  IMAGE_MAX_WIDTH,
  buildWatermarkText,
  deleteLocalFile,
  ensureDirectoryExists,
  processUploadedImage,
};

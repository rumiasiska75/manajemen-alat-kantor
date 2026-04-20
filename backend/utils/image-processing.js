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
  return `"${safeUsername}" ${actionLabel}\n${formatWatermarkTimestamp(timestamp)}`;
}

function buildWatermarkSvg({ width, watermarkText }) {
  const lines = String(watermarkText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fontSize = Math.max(18, Math.round(width * 0.021));
  const lineGap = Math.max(8, Math.round(fontSize * 0.35));
  const paddingX = Math.max(18, Math.round(width * 0.024));
  const paddingY = Math.max(14, Math.round(fontSize * 0.7));
  const outerMargin = Math.max(14, Math.round(width * 0.018));
  const textBlockHeight =
    lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;
  const boxHeight = textBlockHeight + paddingY * 2;
  const boxWidth = Math.min(
    Math.max(280, Math.round(width * 0.48)),
    Math.max(320, width - outerMargin * 2),
  );
  const overlayWidth = boxWidth + outerMargin * 2;
  const overlayHeight = boxHeight + outerMargin * 2;
  const boxX = outerMargin;
  const boxY = outerMargin;
  const textX = boxX + paddingX;
  const firstLineY = boxY + paddingY + fontSize;
  const textSpans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : fontSize + lineGap;
      return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `
    <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(fontSize * 0.45)}" fill="rgba(0, 0, 0, 0.68)" />
      <text
        x="${textX}"
        y="${firstLineY}"
        fill="#ffffff"
        font-size="${fontSize}"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
      >${textSpans}</text>
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
            watermarkText,
          }),
        ),
        gravity: "southwest",
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

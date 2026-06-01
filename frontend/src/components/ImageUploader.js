import React, { useState } from "react";
import { useT } from "../i18n";

const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;
const DEFAULT_MAX_IMAGES = 6;
const KEY_TAIL_LENGTH = 24;

export default function ImageUploader({ images, onChange, max = DEFAULT_MAX_IMAGES }) {
  const t = useT();
  const [error, setError] = useState("");

  const handleFiles = async (files) => {
    setError("");
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= max) break;
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(t("img.tooLarge", { mb: MAX_FILE_SIZE_MB }));
        continue;
      }
      next.push(await fileToCompressedB64(file));
    }
    onChange(next);
  };

  const remove = (i) => {
    const next = images.slice();
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((src, i) => (
          <Thumbnail key={imageKey(src, i)} src={src} index={i} onRemove={remove} />
        ))}
        {images.length < max && <AddPhotoButton onFiles={handleFiles} label={t("img.addPhoto")} />}
      </div>
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
      <div className="text-xs text-slate-500 mt-2">
        {t("img.photosCount", { n: images.length, max, mb: MAX_FILE_SIZE_MB })}
      </div>
    </div>
  );
}

function Thumbnail({ src, index, onRemove }) {
  return (
    <div className="relative w-24 h-24 rounded-md overflow-hidden border border-slate-700">
      <img src={src} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={() => onRemove(index)}
        data-testid={`remove-image-${index}`}
        className="absolute top-1 right-1 bg-black/70 text-white text-xs w-5 h-5 rounded-full"
      >
        ×
      </button>
    </div>
  );
}

function AddPhotoButton({ onFiles, label }) {
  return (
    <label
      className="w-24 h-24 rounded-md border border-dashed border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:text-accent text-slate-500 text-xs"
      data-testid="image-upload-input-label"
    >
      <span className="text-xl leading-none">+</span>
      <span>{label}</span>
      <input
        data-testid="image-upload-input"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </label>
  );
}

function imageKey(src, i) {
  if (!src) return `img-${i}`;
  return `img-${src.length}-${src.slice(-KEY_TAIL_LENGTH)}`;
}

function fitInside(width, height, max) {
  if (width <= max && height <= max) return { w: width, h: height };
  if (width >= height) return { w: max, h: Math.round((height * max) / width) };
  return { w: Math.round((width * max) / height), h: max };
}

function fileToCompressedB64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const { w, h } = fitInside(img.width, img.height, MAX_IMAGE_DIMENSION);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

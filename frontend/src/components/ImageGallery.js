import React, { useState } from "react";

function galleryKey(src, i) {
  if (!src) return `gal-${i}`;
  return `gal-${src.length}-${src.slice(-24)}`;
}

export default function ImageGallery({ images = [] }) {
  const [open, setOpen] = useState(null);
  if (!images.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <button
            key={galleryKey(src, i)}
            type="button"
            onClick={() => setOpen(i)}
            className="w-20 h-20 rounded-md overflow-hidden border border-slate-700 hover:border-accent transition"
            data-testid={`gallery-image-${i}`}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <img src={images[open]} alt="" className="max-h-[90vh] max-w-full rounded-md" />
          <button
            className="absolute top-6 right-6 text-white text-3xl"
            onClick={() => setOpen(null)}
            data-testid="gallery-close-button"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

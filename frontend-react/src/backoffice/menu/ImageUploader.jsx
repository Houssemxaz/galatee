import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function validate(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Formats acceptés: JPEG, PNG, WebP.";
  if (file.size > MAX_BYTES) return "Image trop lourde (5 Mo maximum).";
  return "";
}

export default function ImageUploader({ imageUrl, onUpload, onRemove, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    setError("");
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    try {
      await onUpload(file);
    } catch (uploadError) {
      setError(uploadError.message || "L'envoi de l'image a échoué.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const displaySrc = preview || imageUrl;

  return (
    <div className="bo-image-uploader">
      {displaySrc ? (
        <div className="bo-image-preview">
          <img src={displaySrc} alt="" loading="lazy" />
          <div className="bo-image-actions">
            <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? "Envoi..." : "Remplacer"}
            </Button>
            {imageUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={onRemove}>
                Supprimer
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`bo-image-dropzone ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
        >
          {uploading ? "Envoi en cours..." : "Glissez une image ici, ou choisissez un fichier"}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        disabled={disabled || uploading}
        onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); event.target.value = ""; }}
      />
      {error && <p className="bo-image-error" role="alert">{error}</p>}
    </div>
  );
}

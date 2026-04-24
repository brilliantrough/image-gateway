import type { InvocationImageInputKind } from "../../types/invocation.js";

type InputAssetsPanelProps = {
  requiresImage: boolean;
  requiresMask: boolean;
  imageInputKind: InvocationImageInputKind;
  imageUrl: string;
  imageDataUrl: string;
  imageFileName: string;
  maskDataUrl: string;
  maskFileName: string;
  onImageInputKindChange: (kind: InvocationImageInputKind) => void;
  onImageUrlChange: (value: string) => void;
  onImageFileChange: (file: File | null) => void;
  onMaskFileChange: (file: File | null) => void;
};

export function InputAssetsPanel(props: InputAssetsPanelProps) {
  const {
    requiresImage,
    requiresMask,
    imageInputKind,
    imageUrl,
    imageDataUrl,
    imageFileName,
    maskDataUrl,
    maskFileName,
    onImageInputKindChange,
    onImageUrlChange,
    onImageFileChange,
    onMaskFileChange,
  } = props;
  const sourceImage = imageInputKind === "url" ? imageUrl.trim() : imageDataUrl;

  return (
    <section id="assets" className="panel invocation-panel">
      <div className="invocation-panel__header">
        <div>
          <h2>Reference Assets</h2>
          <p>
            Optional source images for image-to-image or edit modes. Text-to-image can ignore this section.
          </p>
        </div>
        <span className={`invocation-assets-badge ${requiresImage ? "is-required" : ""}`}>
          {requiresImage ? "Required for this mode" : "Optional"}
        </span>
      </div>

      <div className="test-bench__mode-switch">
        <button
          type="button"
          className={imageInputKind === "upload" ? "is-active" : ""}
          onClick={() => onImageInputKindChange("upload")}
        >
          Upload file
        </button>
        <button
          type="button"
          className={imageInputKind === "url" ? "is-active" : ""}
          onClick={() => onImageInputKindChange("url")}
        >
          Image URL
        </button>
      </div>

      {requiresImage ? (
        imageInputKind === "upload" ? (
          <label>
            Source Image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onImageFileChange(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <label>
            Source Image URL
            <input
              value={imageUrl}
              onChange={(event) => onImageUrlChange(event.target.value)}
              placeholder="https://example.com/cat.png"
            />
          </label>
        )
      ) : (
        <p className="invocation-empty">This mode does not require a source image.</p>
      )}

      {sourceImage ? (
        <div className="test-bench__source-preview">
          <img src={sourceImage} alt="Invocation source" />
          <span>{imageInputKind === "url" ? imageUrl : imageFileName}</span>
        </div>
      ) : null}

      {requiresMask ? (
        <>
          <label>
            Mask Image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onMaskFileChange(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
          {maskDataUrl ? (
            <div className="test-bench__source-preview">
              <img src={maskDataUrl} alt="Invocation mask" />
              <span>{maskFileName}</span>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

import { CurlPreviewCard } from "./curl-preview-card.js";
import { RequestPreviewCard } from "./request-preview-card.js";
import type { InvocationResponse } from "../../types/invocation.js";

type InvocationResultPanelProps = {
  isRunning: boolean;
  runError: string;
  payloadError: string;
  previewSrc: string;
  requestPreview: string;
  curlPreview: string;
  runResult: InvocationResponse | null;
  minimalMode?: boolean;
};

export function InvocationResultPanel(props: InvocationResultPanelProps) {
  const { isRunning, runError, payloadError, previewSrc, requestPreview, curlPreview, runResult, minimalMode = false } =
    props;
  const firstImage = runResult?.response.data[0] ?? null;
  const outputMimeType = firstImage?.mime_type ?? inferMimeType(previewSrc);

  return (
    <section
      id="result"
      className={`panel invocation-panel ${minimalMode ? "invocation-panel--minimal" : ""}`}
    >
      <div className="invocation-panel__header">
        <div>
          <h2>Result</h2>
          {minimalMode ? null : <p>Review output, request preview, and a curl version of the invocation.</p>}
        </div>
        {previewSrc ? (
          <button
            type="button"
            className="invocation-download-button"
            onClick={() => {
              void downloadOutputImage(previewSrc, outputMimeType);
            }}
          >
            Download output
          </button>
        ) : null}
      </div>

      {runError ? <p className="field-error">{runError}</p> : null}

      {previewSrc ? (
        <img src={previewSrc} alt="Invocation output" className="test-bench__image" />
      ) : (
        <div className="test-bench__empty invocation-bundle-state">
          <strong>{isRunning ? "Invocation in progress…" : "No result yet"}</strong>
          <p>Run the invocation to render the first returned image here.</p>
        </div>
      )}

      {minimalMode ? null : (
        <>
          <RequestPreviewCard requestPreview={requestPreview} payloadError={payloadError} />
          <CurlPreviewCard curlPreview={curlPreview} />

          <label>
            Raw Response
            <textarea
              readOnly
              className="invocation-json"
              value={runResult ? JSON.stringify(runResult, null, 2) : ""}
            />
          </label>
        </>
      )}
    </section>
  );
}

async function downloadOutputImage(src: string, mimeType: string) {
  const extension = extensionFromMimeType(mimeType);
  const filename = `output.${extension}`;

  if (src.startsWith("data:")) {
    triggerDownload(src, filename);
    return;
  }

  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error("Failed to fetch output image.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, `output.${extensionFromMimeType(blob.type || mimeType)}`);
    URL.revokeObjectURL(objectUrl);
  } catch {
    triggerDownload(src, filename);
  }
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
}

function inferMimeType(src: string) {
  if (src.startsWith("data:")) {
    return src.slice(5, src.indexOf(";")) || "image/png";
  }

  const lower = src.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }
  if (mimeType.includes("webp")) {
    return "webp";
  }
  if (mimeType.includes("gif")) {
    return "gif";
  }

  return "png";
}

type RequestPreviewCardProps = {
  requestPreview: string;
  payloadError: string;
};

export function RequestPreviewCard(props: RequestPreviewCardProps) {
  return (
    <label>
      Request Preview
      {props.payloadError ? <small className="field-error">{props.payloadError}</small> : null}
      <textarea readOnly className="invocation-json" value={props.requestPreview} />
    </label>
  );
}

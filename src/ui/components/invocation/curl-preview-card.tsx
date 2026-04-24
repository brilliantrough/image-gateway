type CurlPreviewCardProps = {
  curlPreview: string;
};

export function CurlPreviewCard(props: CurlPreviewCardProps) {
  return (
    <label>
      Curl Preview
      <textarea readOnly className="invocation-json" value={props.curlPreview} />
    </label>
  );
}

/** Renders `code` spans written in contract descriptions; everything else stays plain text. */
export default function InlineMd({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? <code key={index}>{part.slice(1, -1)}</code> : part,
      )}
    </>
  );
}

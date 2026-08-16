interface BusinessWriteNoticeProps {
  message: string;
}

export function BusinessWriteNotice({ message }: BusinessWriteNoticeProps) {
  return (
    <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-text-secondary">
      {message}
    </div>
  );
}

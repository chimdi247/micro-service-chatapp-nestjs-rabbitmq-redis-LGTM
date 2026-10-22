import { type FormEvent, type KeyboardEvent, useState } from "react";
import { SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
}

export const MessageComposer = ({ onSend, disabled }: MessageComposerProps) => {
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await onSend(trimmed);
      setBody("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send, Shift+Enter for a new line)"
        rows={1}
        maxLength={2000}
        disabled={disabled || isSending}
        className="max-h-40 min-h-9 resize-none"
      />
      <Button type="submit" size="icon" disabled={disabled || isSending || body.trim().length === 0}>
        <SendHorizonal className="h-4 w-4" />
      </Button>
    </form>
  );
};

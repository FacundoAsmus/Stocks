import { AlertTriangle } from "lucide-react";

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-md border border-negative/30 bg-negative/10 p-6">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden />
        <div>
          <h2 className="font-semibold text-text-primary">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">{message}</p>
        </div>
      </div>
    </section>
  );
}

import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

export default function ConversationsPage() {
  return (
    <>
      <div className="hidden lg:flex h-[calc(100dvh-var(--header-height,0px))] w-full">
        <aside className="desktop-alert-glass desktop-list-holder m-3 flex w-[23%] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/15">
          <div className="shrink-0 px-6 pb-4 pt-6">
            <p className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">Your Chats</p>
            <h1 className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Conversations</h1>
          </div>
          <div role="status" className="flex flex-1 flex-col items-center justify-center gap-2 px-3 text-center text-sm font-medium text-negative">
            <OptionalSvgIcon name="empty-list" className="h-8 w-8" colorClassName="text-negative" />
            <span>The list is empty.</span>
          </div>
        </aside>
      </div>

      <div className="min-h-screen pb-24 lg:hidden">
        <header className="sticky top-0 z-30 flex items-end px-4 pb-4" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
          <div className="absolute inset-x-0 top-0 -z-10 h-[calc(100%-0.75rem)]" style={{ backdropFilter: "blur(var(--phone-list-header-blur))", WebkitBackdropFilter: "blur(var(--phone-list-header-blur))", backgroundColor: "var(--color-background)" }} />
          <div>
            <h1 className="text-4xl font-bold text-text-primary">Your Chats</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-accent">Conversations</p>
          </div>
        </header>
        <div role="status" className="flex min-h-[45vh] flex-col items-center justify-center gap-2 px-3 text-center text-sm font-medium text-negative">
          <OptionalSvgIcon name="empty-list" className="h-8 w-8" colorClassName="text-negative" />
          <span>The list is empty.</span>
        </div>
      </div>
    </>
  );
}

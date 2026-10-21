import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

export function AIUnavailableNotice() {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 self-center py-4 text-center text-sm text-negative">
      <OptionalSvgIcon name="server-error" className="h-8 w-8" colorClassName="text-negative" />
      <span>An error occurred with the server.</span>
    </div>
  );
}
